import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

import Database from "better-sqlite3";

import { BlockService } from "~/domain/blocks/block.service";
import type { ProtectionHooks } from "~/domain/blocks/validate";
import type { ProjectResolvers } from "~/domain/library/library.service";
import { LibraryService } from "~/domain/library/library.service";
import { ProjectService, projectProtection } from "~/domain/projects/project.service";
import { PROJECT_OWNER_KIND } from "~/domain/projects/types";
import { plainText } from "~/domain/blocks/text";
import type { ReferenceableKinds } from "~/domain/tasks/referenceable";
import { TaskService, taskProtection } from "~/domain/tasks/task.service";
import { TASK_OWNER_KIND } from "~/domain/tasks/types";
import type { UnitOfWork } from "~/domain/unit-of-work";
import { MemoryBlockRepository } from "~/infra/memory/memory-block.repository";
import { MemoryProjectRepository } from "~/infra/memory/memory-project.repository";
import { MemoryTaskRepository } from "~/infra/memory/memory-task.repository";
import { MemoryUnitOfWork } from "~/infra/memory/memory-unit-of-work";
import { migrate } from "~/infra/sqlite/migrate";
import { SqliteBlockRepository } from "~/infra/sqlite/sqlite-block.repository";
import { SqliteProjectRepository } from "~/infra/sqlite/sqlite-project.repository";
import { SqliteTaskRepository } from "~/infra/sqlite/sqlite-task.repository";
import { SqliteUnitOfWork } from "~/infra/sqlite/sqlite-unit-of-work";

/** Protection hooks registered by owning domains, keyed by owner kind. */
const hooks: ProtectionHooks = {
  [PROJECT_OWNER_KIND]: projectProtection,
  [TASK_OWNER_KIND]: taskProtection,
};

export type AppServices = {
  blocks: BlockService;
  projects: ProjectService;
  library: LibraryService;
  tasks: TaskService;
  close(): void;
};

/** Overrides for tests: deterministic IDs. */
export type ServiceOptions = { newId?: () => string };

function buildServices(uow: UnitOfWork, close: () => void, options: ServiceOptions): AppServices {
  const blocks = new BlockService(uow.repositories.blocks);
  const projects = new ProjectService(uow, options.newId);
  const { repositories } = uow;
  const resolvers: ProjectResolvers = {
    [PROJECT_OWNER_KIND]: (ownerId) => (repositories.projects.get(ownerId) ? ownerId : undefined),
    [TASK_OWNER_KIND]: (ownerId) => repositories.tasks.get(ownerId)?.projectId,
  };
  const tasks: TaskService = new TaskService(uow, referenceable(), options.newId);
  return { blocks, projects, library: new LibraryService(blocks, projects, resolvers), tasks, close };

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
    };
  }
}

/** The application's services, backed by SQLite. The only place concrete repositories are chosen. */
export function createServices(
  dbPath = process.env.DATABASE_PATH ?? "data/app.sqlite",
  options: ServiceOptions = {},
): AppServices {
  if (dbPath !== ":memory:") mkdirSync(dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  migrate(db);
  const uow = new SqliteUnitOfWork(db, {
    blocks: new SqliteBlockRepository(db, hooks),
    projects: new SqliteProjectRepository(db),
    tasks: new SqliteTaskRepository(db),
  });
  return buildServices(uow, () => db.close(), options);
}

/** The same services backed by memory, for tests and spikes. */
export function createInMemoryServices(options: ServiceOptions = {}): AppServices {
  const blocks = new MemoryBlockRepository(hooks);
  const projects = new MemoryProjectRepository();
  const tasks = new MemoryTaskRepository();
  return buildServices(new MemoryUnitOfWork({ blocks, projects, tasks }, [blocks, projects, tasks]), () => {}, options);
}
