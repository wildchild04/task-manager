import { z } from "zod";

import type { AppServices } from "~/composition";
import {
  fromMarkdown,
  MARKDOWN_GUIDE,
  type MarkdownReader,
  type MarkdownWriter,
  SUGGESTION_TAG,
  toMarkdown,
} from "~/domain/blocks/markdown";
import { plainText } from "~/domain/blocks/text";
import type { Batch, TreeNode } from "~/domain/blocks/types";
import { urgencySchema } from "~/domain/chores/schedule";
import { SuggestionError } from "~/domain/suggestions/errors";
import { NOTE_MAX } from "~/domain/suggestions/suggestion.service";
import { TaskError } from "~/domain/tasks/errors";
import { kinds } from "~/domain/tasks/kinds";
import { TASK_KINDS, TASK_OWNER_KIND, type Actor, type TaskSummary } from "~/domain/tasks/types";

import { allPages } from "../page-search.server";
import { AgentError, cut, limitSchema, maxCharsSchema, offsetSchema, pageOf, parse, resolveId, short } from "./support.server";

/** The changes agents may make to work tasks. Everything else is read-only for them. */
const AGENT_TRANSITIONS = ["start", "pause", "complete", "return"];

/** An agent acting through the API. */
export type AgentActor = Extract<Actor, { kind: "agent" }>;

// ----- Lookups -----

const allTasks = (services: AppServices): TaskSummary[] => services.projects.list().flatMap((p) => services.tasks.list(p.id));

function findTask(services: AppServices, id: string): TaskSummary {
  return services.tasks.get(
    resolveId(
      id,
      allTasks(services).map((t) => t.id),
      "task",
    ),
  )!;
}

/** The agent holding a work task: whoever started it, while it's in progress. Humans don't hold tasks. */
function holder(services: AppServices, task: TaskSummary): string | undefined {
  if (task.kind !== "work" || task.state !== "in_progress") return undefined;
  const start = services.tasks
    .history(task.id)
    .filter((record) => record.name === "start")
    .at(-1);
  return start?.actor.kind === "agent" ? start.actor.name : undefined;
}

/** Refuses changes to a work task held by another agent. */
function checkHeld(services: AppServices, task: TaskSummary, actor: AgentActor) {
  const heldBy = holder(services, task);
  if (heldBy && heldBy !== actor.name) throw new AgentError(409, "claimed", `This task is held by ${heldBy}, who started it`);
}

/** Refuses changes to anything but work tasks. */
function checkWork(task: TaskSummary) {
  if (task.kind !== "work") throw new AgentError(403, "forbidden", `Agents can only change work tasks; this is a ${task.kind}`);
}

const toAgentError = (error: unknown): never => {
  if (error instanceof TaskError) {
    if (error.code === "invalid_transition") throw new AgentError(409, "invalid_transition", error.message);
    if (error.code === "not_found") throw new AgentError(404, "not_found", error.message);
    throw new AgentError(422, "validation", error.message);
  }
  throw error;
};

// ----- Markdown -----

/** Where a page's content lives, as agents name it: a task (its description) or a page. */
function placeOf(services: AppServices, pageId: string): string {
  const owner = services.blocks.getBlock(pageId)?.owner;
  return owner?.kind === TASK_OWNER_KIND ? `task:${short(owner.id)}` : `page:${short(pageId)}`;
}

function reader(services: AppServices, anchors = false): MarkdownReader {
  return {
    ...(anchors ? { anchor: short } : {}),
    suggestion: (id) => {
      const suggestion = services.suggestions.get(id);
      return suggestion
        ? {
            id: short(suggestion.id),
            by: suggestion.author,
            action: suggestion.action,
            target: suggestion.targetId ? short(suggestion.targetId) : undefined,
            status: suggestion.state,
            note: suggestion.note ?? undefined,
          }
        : null;
    },
    mentionTarget: (pageId) => {
      const page = services.blocks.getBlock(pageId);
      if (page?.type !== "page") return null;
      const title = plainText(page.content) || "Untitled";
      return page.owner?.kind === TASK_OWNER_KIND
        ? { kind: "task", id: short(page.owner.id), title }
        : { kind: "page", id: short(page.id), title };
    },
    referenceTarget: (targetId) => {
      const target = services.blocks.getBlock(targetId);
      if (!target) return null;
      if (target.type === "page") return { kind: "page", id: short(target.id), title: plainText(target.content) || "Untitled" };
      return { kind: "block", text: plainText(target.content) };
    },
    appLink: (href) => {
      const app = /^\/(pages|tasks)\/([^/?#]+)$/.exec(href);
      return app ? `${app[1] === "pages" ? "page" : "task"}:${short(app[2]!)}` : undefined;
    },
    pageId: short,
    contentUrl: (id) => services.content.url(id),
  };
}

function writer(services: AppServices): MarkdownWriter {
  return {
    findTarget: (kind, id) => {
      try {
        if (kind === "task") {
          const task = findTask(services, id);
          return { pageId: task.bodyPageId, href: `/tasks/${task.id}` };
        }
        const pageId = resolveId(
          id,
          allPages(services).map((p) => p.id),
          "page",
        );
        return { pageId, href: `/pages/${pageId}` };
      } catch {
        return null;
      }
    },
    newId: () => crypto.randomUUID(),
  };
}

const markdownOf = (services: AppServices, tree: TreeNode | undefined, anchors = false) =>
  toMarkdown(tree?.children ?? [], reader(services, anchors));

/** How agents' Markdown is read and written, for tools that convert content as agents see it. */
export const agentMarkdown = (services: AppServices) => ({ reader: reader(services), writer: writer(services) });

/**
 * Markdown an agent wrote, as blocks, with what it held that isn't supported
 * (kept as text). Suggestions are read, never written as Markdown.
 */
function blocksOf(services: AppServices, markdown: string) {
  if (SUGGESTION_TAG.test(markdown))
    throw new AgentError(422, "validation", "Suggestions can't be written as Markdown; use `suggest`");
  const warnings: string[] = [];
  return { blocks: fromMarkdown(markdown, writer(services), warnings), warnings };
}

/** A write's answer with its warnings, only when there are any. */
const withWarnings = <T extends object>(answer: T, warnings: readonly string[]) =>
  warnings.length > 0 ? { ...answer, warnings: [...warnings] } : answer;

/** The Markdown agents may write, and what isn't supported. */
export function markdownGuide() {
  return MARKDOWN_GUIDE;
}

// ----- Reads -----

export function listProjects(services: AppServices) {
  return { projects: services.projects.list().map((p) => ({ id: short(p.id), title: p.title })) };
}

const tasksQuery = z.object({
  project: z.string().optional(),
  kind: z.enum(TASK_KINDS).optional(),
  state: z.string().optional(),
  query: z.string().optional(),
  limit: limitSchema(10),
  cursor: z.string().optional(),
});

export function listTasks(services: AppServices, input: unknown) {
  const q = parse(tasksQuery, input);
  const projectId = q.project
    ? resolveId(
        q.project,
        services.projects.list().map((p) => p.id),
        "project",
      )
    : undefined;
  const needle = q.query?.toLowerCase();
  const tasks = (projectId ? services.tasks.list(projectId) : allTasks(services))
    .filter(
      (t) =>
        (!q.kind || t.kind === q.kind) &&
        (!q.state || t.state === q.state) &&
        (!needle || t.title.toLowerCase().includes(needle)),
    )
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id));
  const page = pageOf(tasks, (t) => t.id, q.limit, q.cursor);
  return {
    tasks: page.items.map((t) => ({ id: short(t.id), kind: t.kind, state: t.state, title: t.title })),
    more: page.more,
    ...(page.cursor ? { cursor: page.cursor } : {}),
  };
}

/** The transitions this agent may apply to the task now. */
function allowedTransitions(services: AppServices, task: TaskSummary, actor: AgentActor): string[] {
  if (task.kind !== "work") return [];
  const heldBy = holder(services, task);
  if (heldBy && heldBy !== actor.name) return [];
  return Object.entries(kinds.work.transitions)
    .filter(([name, transition]) => AGENT_TRANSITIONS.includes(name) && transition.from.includes(task.state))
    .map(([name]) => name);
}

export function getTask(services: AppServices, actor: AgentActor, id: string) {
  const task = findTask(services, id);
  const heldBy = holder(services, task);
  return {
    id: short(task.id),
    kind: task.kind,
    state: task.state,
    title: task.title,
    project: short(task.projectId),
    ...(heldBy ? { heldBy } : {}),
    transitions: allowedTransitions(services, task, actor),
    counts: {
      comments: services.comments.list(task.id).length,
      references: services.tasks.relations(task.id, "references").length,
    },
  };
}

const flag = z.union([z.boolean(), z.enum(["true", "false"]).transform((v) => v === "true")]).default(false);
const textQuery = (fallback: number) => z.object({ maxChars: maxCharsSchema(fallback), offset: offsetSchema, anchors: flag });

export function readDescription(services: AppServices, id: string, input: unknown) {
  const q = parse(textQuery(2000), input);
  const task = findTask(services, id);
  return cut(markdownOf(services, services.blocks.loadTree(task.bodyPageId), q.anchors), q.maxChars, q.offset);
}

const commentsQuery = z.object({ limit: limitSchema(5), cursor: z.string().optional(), maxChars: maxCharsSchema(1000) });

export function listComments(services: AppServices, id: string, input: unknown) {
  const q = parse(commentsQuery, input);
  const task = findTask(services, id);
  const comments = services.comments
    .list(task.id)
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id));
  const page = pageOf(comments, (c) => c.id, q.limit, q.cursor);
  return {
    comments: page.items.map((c) => ({
      id: short(c.id),
      author: c.author.kind === "agent" ? c.author.name : "human",
      markdown: cut(markdownOf(services, services.comments.body(c.id)), q.maxChars).markdown,
    })),
    more: page.more,
    ...(page.cursor ? { cursor: page.cursor } : {}),
  };
}

export function listReferences(services: AppServices, id: string, input: unknown) {
  const q = parse(z.object({ limit: limitSchema(10) }), input);
  const task = findTask(services, id);
  const relations = services.tasks.relations(task.id, "references");
  return {
    references: relations
      .slice(0, q.limit)
      .map(({ target }) =>
        target.status === "ok"
          ? { kind: target.kind, id: short(target.id), title: target.title }
          : { kind: target.kind, id: short(target.id), missing: true },
      ),
    more: relations.length > q.limit,
  };
}

export function searchPages(services: AppServices, input: unknown) {
  const q = parse(z.object({ query: z.string().default(""), limit: limitSchema(10) }), input);
  const needle = q.query.trim().toLowerCase();
  const pages = allPages(services).filter((p) => p.title.toLowerCase().includes(needle));
  return {
    pages: pages.slice(0, q.limit).map((p) => ({ id: short(p.id), title: p.title, place: p.place })),
    more: pages.length > q.limit,
  };
}

export function readPage(services: AppServices, id: string, input: unknown) {
  const q = parse(textQuery(2000), input);
  const pageId = resolveId(
    id,
    allPages(services).map((p) => p.id),
    "page",
  );
  const page = services.blocks.getBlock(pageId)!;
  return {
    title: plainText(page.content) || "Untitled",
    ...cut(markdownOf(services, services.blocks.loadTree(pageId), q.anchors), q.maxChars, q.offset),
  };
}

// ----- Writes -----

const createBody = z.object({
  project: z.string().min(1),
  kind: z.enum(TASK_KINDS),
  title: z.string(),
  description: z.string().optional(),
  urgency: urgencySchema.optional(),
  schedule: z.unknown().optional(),
  iteratesOn: z.string().optional(),
});

/** Creates a task as the web forms do, with an optional Markdown description. */
export function createTask(services: AppServices, input: unknown) {
  const body = parse(createBody, input);
  const title = body.title.trim();
  if (!title) throw new AgentError(422, "validation", "A task needs a title");
  if (body.kind !== "chore" && (body.urgency || body.schedule !== undefined))
    throw new AgentError(422, "validation", "Only chores take urgency and a schedule");
  if (body.kind !== "update" && body.iteratesOn) throw new AgentError(422, "validation", "Only updates iterate on work");
  if (body.kind === "update" && !body.iteratesOn)
    throw new AgentError(422, "validation", "An update needs `iteratesOn`: the done work it iterates on");

  const projectId = resolveId(
    body.project,
    services.projects.list().map((p) => p.id),
    "project",
  );
  const iteratesOn = body.iteratesOn ? findTask(services, body.iteratesOn).id : undefined;
  const { blocks, warnings } = body.description ? blocksOf(services, body.description) : { blocks: [], warnings: [] };
  try {
    const task = services.tasks.create({
      id: crypto.randomUUID(),
      projectId,
      kind: body.kind,
      title,
      ...(iteratesOn ? { iteratesOn } : {}),
      ...(body.kind === "chore"
        ? {
            attributes: {
              urgency: body.urgency ?? "normal",
              ...(body.schedule !== undefined ? { schedule: body.schedule } : {}),
            },
          }
        : {}),
    });
    if (blocks.length > 0) appendBlocks(services, task.bodyPageId, blocks);
    return withWarnings({ ok: true as const, id: short(task.id), state: task.state }, warnings);
  } catch (error) {
    return toAgentError(error);
  }
}

const pageBody = z.object({
  title: z.string(),
  project: z.string().optional(),
  parent: z.string().optional(),
  markdown: z.string().optional(),
});

/**
 * Creates a page as the web forms do: a workspace page by default, a document
 * at the top of `project`'s library, or a page inside `parent` (any page),
 * after the existing ones, with optional Markdown content.
 */
export function createPage(services: AppServices, input: unknown) {
  const body = parse(pageBody, input);
  const title = body.title.trim();
  if (!title) throw new AgentError(422, "validation", "A page needs a title");
  if (body.project && body.parent)
    throw new AgentError(422, "validation", "Give `project` or `parent`, not both: a parent page already sets the place");

  let parentId: string | null = null;
  if (body.parent) {
    parentId = resolveId(
      body.parent,
      allPages(services).map((p) => p.id),
      "page",
    );
  } else if (body.project) {
    const projectId = resolveId(
      body.project,
      services.projects.list().map((p) => p.id),
      "project",
    );
    parentId = services.projects.get(projectId)!.libraryRootId;
  }
  const siblings = parentId ? services.blocks.getChildren(parentId) : services.blocks.listRootPages();
  const { blocks, warnings } = body.markdown ? blocksOf(services, body.markdown) : { blocks: [], warnings: [] };
  const id = crypto.randomUUID();
  try {
    services.blocks.apply([
      { op: "insert", block: { id, type: "page", content: [{ text: title }] }, parentId, afterId: siblings.at(-1)?.id ?? null },
      ...insertOps(blocks, id, null),
    ]);
  } catch (error) {
    throw new AgentError(422, "validation", error instanceof Error ? error.message : "The page couldn't be created");
  }
  return withWarnings({ ok: true as const, id: short(id) }, warnings);
}

const transitionBody = z.object({ name: z.string().min(1), reason: z.string().optional() });

export function transition(services: AppServices, actor: AgentActor, id: string, input: unknown) {
  const body = parse(transitionBody, input);
  const task = findTask(services, id);
  checkWork(task);
  if (!AGENT_TRANSITIONS.includes(body.name)) throw new AgentError(403, "forbidden", `Agents can't ${body.name} work`);
  if (body.name !== "start") checkHeld(services, task, actor);
  if (body.name === "return" && !body.reason?.trim()) throw new AgentError(422, "validation", "A return needs a reason");
  try {
    const result = services.tasks.transition(task.id, body.name, {
      actor,
      ...(body.name === "return" ? { input: { reason: body.reason } } : {}),
    });
    return { ok: true as const, state: result.state };
  } catch (error) {
    return toAgentError(error);
  }
}

const markdownBody = z.object({ markdown: z.string() });

export function comment(services: AppServices, actor: AgentActor, id: string, input: unknown) {
  const { markdown } = parse(markdownBody, input);
  const task = findTask(services, id);
  checkWork(task);
  checkHeld(services, task, actor);
  const { blocks, warnings } = blocksOf(services, markdown);
  if (blocks.length === 0) throw new AgentError(422, "validation", "The comment is empty");
  try {
    const added = services.comments.add({ id: crypto.randomUUID(), taskId: task.id, author: actor, blocks });
    return withWarnings({ ok: true as const, id: short(added.id) }, warnings);
  } catch (error) {
    return toAgentError(error);
  }
}

export function appendDescription(services: AppServices, actor: AgentActor, id: string, input: unknown) {
  const { markdown } = parse(markdownBody, input);
  const task = findTask(services, id);
  checkWork(task);
  checkHeld(services, task, actor);
  const { blocks, warnings } = blocksOf(services, markdown);
  if (blocks.length === 0) throw new AgentError(422, "validation", "Nothing to add");
  appendBlocks(services, task.bodyPageId, blocks);
  return withWarnings({ ok: true as const }, warnings);
}

// ----- Suggestions -----

const suggestBody = z.object({
  page: z.string().optional(),
  task: z.string().optional(),
  action: z.enum(["insert", "replace", "delete"]),
  after: z.string().optional(),
  inside: z.string().optional(),
  target: z.string().optional(),
  markdown: z.string().optional(),
  note: z.string().max(NOTE_MAX).optional(),
});

const fromSuggestionError = (error: unknown): never => {
  if (error instanceof SuggestionError) {
    const status = { not_found: 404, validation: 422, outdated: 409, resolved: 409, forbidden: 403 }[error.code];
    throw new AgentError(status, error.code, error.message);
  }
  throw error;
};

/** The block IDs in a page's tree, to resolve the short IDs an agent gives. */
function blockIds(services: AppServices, pageId: string): string[] {
  const ids: string[] = [];
  const visit = (node: TreeNode) => {
    for (const child of node.children ?? []) {
      ids.push(child.block.id);
      visit(child);
    }
  };
  const tree = services.blocks.loadTree(pageId);
  if (tree) visit(tree);
  return ids;
}

/** Proposes a change to a page or a task's description, for a human to approve or reject. */
export function suggest(services: AppServices, actor: AgentActor, input: unknown) {
  const body = parse(suggestBody, input);
  if (!body.page === !body.task) throw new AgentError(422, "validation", "Give `page` or `task`: where the suggestion goes");
  const pageId = body.task
    ? findTask(services, body.task).bodyPageId
    : resolveId(
        body.page!,
        allPages(services).map((p) => p.id),
        "page",
      );
  const ids = blockIds(services, pageId);
  const block = (id: string | undefined) => (id === undefined ? undefined : resolveId(id, ids, "block"));
  const { blocks, warnings } = body.markdown ? blocksOf(services, body.markdown) : { blocks: [], warnings: [] };
  try {
    const suggestion = services.suggestions.suggest({
      pageId,
      action: body.action,
      afterId: block(body.after),
      insideId: block(body.inside),
      targetId: block(body.target),
      blocks,
      note: body.note,
      author: actor.name,
    });
    return withWarnings({ ok: true as const, id: short(suggestion.id) }, warnings);
  } catch (error) {
    return fromSuggestionError(error);
  }
}

const findSuggestion = (services: AppServices, id: string) =>
  services.suggestions.get(resolveId(id, services.suggestions.idsStartingWith(id), "suggestion"))!;

export function getSuggestion(services: AppServices, id: string) {
  const suggestion = findSuggestion(services, id);
  return {
    id: short(suggestion.id),
    action: suggestion.action,
    status: suggestion.state,
    place: placeOf(services, suggestion.pageId),
    ...(suggestion.resolvedAt ? { resolvedAt: suggestion.resolvedAt } : {}),
  };
}

/** Takes back the agent's own pending suggestion. */
export function withdrawSuggestion(services: AppServices, actor: AgentActor, id: string) {
  const suggestion = findSuggestion(services, id);
  try {
    services.suggestions.withdraw(suggestion.id, actor.name);
    return { ok: true as const };
  } catch (error) {
    return fromSuggestionError(error);
  }
}

/** Approving and rejecting are for humans. */
export function resolveSuggestion(): never {
  throw new AgentError(403, "forbidden", "Only a human approves or rejects suggestions");
}

/** Inserts blocks (and their children) after a page's last block. */
function appendBlocks(services: AppServices, pageId: string, blocks: ReturnType<typeof fromMarkdown>) {
  const ops = insertOps(blocks, pageId, services.blocks.getChildren(pageId).at(-1)?.id ?? null);
  try {
    services.blocks.apply(ops);
  } catch (error) {
    throw new AgentError(422, "validation", error instanceof Error ? error.message : "The description couldn't be changed");
  }
}

/** The operations inserting blocks (and their children) into `parentId`, starting after `afterId`. */
function insertOps(blocks: ReturnType<typeof fromMarkdown>, parentId: string, afterId: string | null): Batch[number][] {
  const ops: Batch[number][] = [];
  const add = (list: typeof blocks, parent: string, after: string | null) => {
    let previous = after;
    for (const { children, ...block } of list) {
      ops.push({ op: "insert", block, parentId: parent, afterId: previous });
      if (children?.length) add(children, block.id, null);
      previous = block.id;
    }
  };
  add(blocks, parentId, afterId);
  return ops;
}
