import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

import Database from "better-sqlite3";

import { BlockService } from "~/domain/blocks/block.service";
import type { ProtectionHooks } from "~/domain/blocks/validate";
import type { ProjectResolvers } from "~/domain/library/library.service";
import { LibraryService } from "~/domain/library/library.service";
import { ChoreService } from "~/domain/chores/chore.service";
import { choresSection, DashboardRegistry, DashboardService, registerCoreSections } from "~/domain/projects/dashboard";
import { ProjectService, projectProtection } from "~/domain/projects/project.service";
import { PROJECT_OWNER_KIND } from "~/domain/projects/types";
import { plainText } from "~/domain/blocks/text";
import type { ContentRepository } from "~/domain/content/content.repository";
import { CommentService, commentProtection } from "~/domain/comments/comment.service";
import { COMMENT_OWNER_KIND } from "~/domain/comments/types";
import type { ReferenceableKinds } from "~/domain/tasks/referenceable";
import { SuggestionService } from "~/domain/suggestions/suggestion.service";
import { TaskService, taskProtection } from "~/domain/tasks/task.service";
import { TASK_OWNER_KIND } from "~/domain/tasks/types";
import type { UnitOfWork } from "~/domain/unit-of-work";
import { FsContentRepository } from "~/infra/fs/fs-content.repository";
import { MemoryBlockRepository } from "~/infra/memory/memory-block.repository";
import { MemoryCommentRepository } from "~/infra/memory/memory-comment.repository";
import { MemoryContentRepository } from "~/infra/memory/memory-content.repository";
import { MemoryProjectRepository } from "~/infra/memory/memory-project.repository";
import { MemorySuggestionRepository } from "~/infra/memory/memory-suggestion.repository";
import { MemoryTaskRepository } from "~/infra/memory/memory-task.repository";
import { MemoryUnitOfWork } from "~/infra/memory/memory-unit-of-work";
import { migrate } from "~/infra/sqlite/migrate";
import { SqliteBlockRepository } from "~/infra/sqlite/sqlite-block.repository";
import { SqliteCommentRepository } from "~/infra/sqlite/sqlite-comment.repository";
import { SqliteProjectRepository } from "~/infra/sqlite/sqlite-project.repository";
import { SqliteSuggestionRepository } from "~/infra/sqlite/sqlite-suggestion.repository";
import { SqliteTaskRepository } from "~/infra/sqlite/sqlite-task.repository";
import { SqliteUnitOfWork } from "~/infra/sqlite/sqlite-unit-of-work";

/** Protection hooks registered by owning domains, keyed by owner kind. */
const hooks: ProtectionHooks = {
  [PROJECT_OWNER_KIND]: projectProtection,
  [TASK_OWNER_KIND]: taskProtection,
  [COMMENT_OWNER_KIND]: commentProtection,
};

export type AppServices = {
  blocks: BlockService;
  projects: ProjectService;
  library: LibraryService;
  tasks: TaskService;
  comments: CommentService;
  suggestions: SuggestionService;
  chores: ChoreService;
  dashboard: DashboardService;
  /** Uploaded images and other binary content. */
  content: ContentRepository;
  /** Where later changes add dashboard sections. */
  dashboardSections: DashboardRegistry;
  close(): void;
};

/**
 * Overrides for tests (deterministic IDs and clock), the workspace time zone,
 * and the path the app is served under (for content URLs).
 */
export type ServiceOptions = { newId?: () => string; now?: () => string; timeZone?: string; basePath?: string };

function buildServices(uow: UnitOfWork, content: ContentRepository, close: () => void, options: ServiceOptions): AppServices {
  const blocks = new BlockService(uow.repositories.blocks);
  const projects = new ProjectService(uow, options.newId, options.now);
  const { repositories } = uow;
  const resolvers: ProjectResolvers = {
    [PROJECT_OWNER_KIND]: (ownerId) => (repositories.projects.get(ownerId) ? ownerId : undefined),
    [TASK_OWNER_KIND]: (ownerId) => repositories.tasks.get(ownerId)?.projectId,
  };
  const comments = new CommentService(uow, options.newId, options.now);
  const tasks: TaskService = new TaskService(uow, referenceable(), {
    newId: options.newId,
    now: options.now,
    timeZone: options.timeZone,
    // Returning work posts the reason, plus any extra blocks, as a comment by the same actor.
    onReturn: (repos, { task, actor, reason, commentId, commentBlocks, at }) => {
      const id = commentId ?? crypto.randomUUID();
      const reasonBlock = { id: `${id}-reason`, type: "paragraph" as const, content: [{ text: reason }] };
      comments.addWithin(repos, { id, taskId: task.id, author: actor, blocks: [reasonBlock, ...commentBlocks] }, at);
    },
  });
  const suggestions = new SuggestionService(uow, options.newId, options.now);
  const library = new LibraryService(blocks, projects, resolvers);
  const dashboardSections = new DashboardRegistry();
  const chores = new ChoreService(uow, tasks, options.now);
  registerCoreSections(dashboardSections, { tasks, blocks, projects });
  dashboardSections.replace(choresSection(tasks, chores));
  const dashboard = new DashboardService(dashboardSections, projects);
  return { blocks, projects, library, tasks, comments, suggestions, chores, dashboard, content, dashboardSections, close };

  /** Entity kinds a task can reference. Later domains (comments, subtasks) add theirs. */
  function referenceable(): ReferenceableKinds {
    return {
      task: (id) => {
        const task = tasks.get(id);
        return task && { title: task.title };
      },
      block: (id) => {
        const block = repositories.blocks.getBlock(id);
        return block && { title: plainText(block.content) };
      },
      comment: (id) => comments.summary(id),
    };
  }
}

/**
 * The application's services, backed by SQLite, with content as files beside
 * the database (`CONTENT_PATH`, default `<database folder>/content`). The only
 * place concrete repositories are chosen.
 */
export function createServices(
  dbPath = process.env.DATABASE_PATH ?? "data/app.sqlite",
  options: ServiceOptions = { timeZone: process.env.TIME_ZONE || undefined },
  contentPath = process.env.CONTENT_PATH || join(dirname(dbPath), "content"),
): AppServices {
  if (dbPath !== ":memory:") mkdirSync(dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  migrate(db);
  const uow = new SqliteUnitOfWork(db, {
    blocks: new SqliteBlockRepository(db, hooks),
    projects: new SqliteProjectRepository(db),
    tasks: new SqliteTaskRepository(db),
    comments: new SqliteCommentRepository(db),
    suggestions: new SqliteSuggestionRepository(db),
  });
  const content =
    dbPath === ":memory:" ? new MemoryContentRepository(options.basePath) : new FsContentRepository(contentPath, options.basePath);
  return buildServices(uow, content, () => db.close(), options);
}

/** The same services backed by memory, for tests and spikes. */
export function createInMemoryServices(options: ServiceOptions = {}): AppServices {
  const blocks = new MemoryBlockRepository(hooks);
  const projects = new MemoryProjectRepository();
  const tasks = new MemoryTaskRepository();
  const comments = new MemoryCommentRepository();
  const suggestions = new MemorySuggestionRepository();
  const uow = new MemoryUnitOfWork({ blocks, projects, tasks, comments, suggestions }, [blocks, projects, tasks, comments, suggestions]);
  return buildServices(uow, new MemoryContentRepository(options.basePath), () => {}, options);
}
