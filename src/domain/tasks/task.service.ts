import { batchStaysWithin } from "../blocks/batch-scope";
import { plainText } from "../blocks/text";
import type { Batch, NewBlock, TreeNode } from "../blocks/types";
import type { ProtectionHook } from "../blocks/validate";
import type { Repositories, UnitOfWork } from "../unit-of-work";
import { TaskError } from "./errors";
import { kinds } from "./kinds";
import type { ReferenceableKinds } from "./referenceable";
import { resolveEntity } from "./referenceable";
import type { TaskFilter } from "./task.repository";
import type {
  Actor,
  EntityRef,
  LineageNode,
  Relation,
  RelationType,
  ResolvedRelation,
  Task,
  TaskKind,
  TaskSummary,
  TransitionRecord,
} from "./types";
import { HUMAN, TASK_KINDS, TASK_OWNER_KIND } from "./types";

/** A task's body page can be edited through block batches but never deleted. */
export const taskProtection: ProtectionHook = ({ op, targetIsRoot }) =>
  op.op === "delete" && targetIsRoot ? "A task's body page cannot be deleted" : undefined;

export type CreateTaskInput = {
  id: string;
  projectId: string;
  kind: TaskKind;
  title: string;
  attributes?: Record<string, unknown>;
  /** Required for updates: the done work task this update iterates on. */
  iteratesOn?: string;
  /** Anything this task draws on: tombstoned ideas, other tasks, pages, single blocks. */
  references?: EntityRef[];
};

export type TransitionOptions = { actor?: Actor; note?: string; input?: unknown };

/** What `return` hands to the comments domain, inside the transition's unit of work. */
export type ReturnedWork = {
  task: Task;
  actor: Actor;
  reason: string;
  commentId?: string;
  commentBlocks: NewBlock[];
  at: string;
};

export type TaskServiceOptions = {
  newId?: () => string;
  now?: () => string;
  /** The workspace time zone for wall-clock schedules; defaults to the server's. */
  timeZone?: string;
  /** Called when work is returned, to post the return comment. Throwing rolls the return back. */
  onReturn?: (repositories: Repositories, returned: ReturnedWork) => void;
};

type ReturnInput = { reason: string; bodyBatch?: Batch; commentBlocks?: NewBlock[]; commentId?: string };

const fail = (code: TaskError["code"], message: string): never => {
  throw new TaskError(code, message);
};

export class TaskService {
  private readonly newId: () => string;
  private readonly now: () => string;
  readonly timeZone: string;

  constructor(
    private readonly uow: UnitOfWork,
    private readonly referenceable: ReferenceableKinds,
    private readonly options: TaskServiceOptions = {},
  ) {
    this.newId = options.newId ?? (() => crypto.randomUUID());
    this.now = options.now ?? (() => new Date().toISOString());
    this.timeZone = options.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  }

  private get repos(): Repositories {
    return this.uow.repositories;
  }

  // ----- Tasks -----

  create(input: CreateTaskInput): TaskSummary {
    const at = this.now();
    const task = this.uow.run((repos) => {
      const task = this.insertTask(repos, input, at);
      if (input.kind === "update") {
        if (!input.iteratesOn) fail("invalid_relation", "An update must iterate on a done work task");
        this.insertRelation(repos, "iterates_on", task, { kind: "task", id: input.iteratesOn! }, at);
      } else if (input.iteratesOn) {
        fail("invalid_relation", "Only updates iterate on work");
      }
      for (const ref of input.references ?? []) this.insertRelation(repos, "references", task, ref, at);
      return task;
    });
    return this.summarize(task);
  }

  get(id: string): TaskSummary | undefined {
    const task = this.repos.tasks.get(id);
    return task && this.summarize(task);
  }

  list(projectId: string, filter: TaskFilter = {}): TaskSummary[] {
    return this.repos.tasks.list(projectId, filter).map((task) => this.summarize(task));
  }

  /**
   * Inserts a task and its body page. Must run inside a unit of work.
   * `initialize: false` keeps derived attributes as given (for chore occurrences).
   */
  private insertTask(repos: Repositories, input: CreateTaskInput, at: string, initialize = true): Task {
    if (!input.id) fail("validation", "A task needs an ID");
    if (!(TASK_KINDS as readonly string[]).includes(input.kind)) fail("validation", `Unknown task kind: ${input.kind}`);
    if (repos.tasks.get(input.id)) fail("duplicate_id", `Task ${input.id} already exists`);
    if (!repos.projects.get(input.projectId)) fail("not_found", `Project ${input.projectId} does not exist`);

    const definition = kinds[input.kind];
    const attributes = definition.attributes.safeParse(input.attributes ?? {});
    if (!attributes.success) {
      fail("validation", `Invalid attributes for ${input.kind}: ${attributes.error.issues[0]?.message ?? "invalid"}`);
    }

    const initialized =
      initialize && definition.initialize
        ? definition.initialize(attributes.data!, { id: input.id, now: new Date(at), timeZone: this.timeZone })
        : attributes.data!;
    const task: Task = {
      id: input.id,
      projectId: input.projectId,
      kind: input.kind,
      state: definition.initial,
      bodyPageId: this.newId(),
      attributes: initialized,
      createdAt: at,
      updatedAt: at,
    };
    repos.blocks.apply([
      {
        op: "insert",
        block: { id: task.bodyPageId, type: "page", content: [{ text: input.title }] },
        owner: { kind: TASK_OWNER_KIND, id: task.id },
      },
    ]);
    repos.tasks.insert(task);
    return task;
  }

  private summarize(task: Task): TaskSummary {
    const page = this.repos.blocks.getBlock(task.bodyPageId);
    return { ...task, title: page ? plainText(page.content) : "" };
  }

  // ----- Lifecycle -----

  /** Applies a named transition, its effect and its history entry in one unit of work. */
  transition(taskId: string, name: string, options: TransitionOptions = {}): TaskSummary {
    const actor = options.actor ?? HUMAN;
    if (actor.kind === "agent" && !actor.name) fail("validation", "An agent actor needs a name");

    const task = this.uow.run((repos) => {
      const task = repos.tasks.get(taskId) ?? fail("not_found", `Task ${taskId} does not exist`);
      const definition = kinds[task.kind];
      const transition = definition.transitions[name];
      if (!transition) fail("invalid_transition", `A ${task.kind} has no transition "${name}"`);
      if (!transition!.from.includes(task.state)) {
        fail("invalid_transition", `Cannot ${name} a ${task.kind} that is ${task.state}`);
      }

      let input: unknown = undefined;
      if (transition!.input) {
        const parsed = transition!.input.safeParse(options.input ?? {});
        if (!parsed.success) fail("validation", parsed.error.issues[0]?.message ?? `Invalid input for ${name}`);
        input = parsed.data;
      }

      const at = this.now();
      transition!.effect?.({
        task,
        input,
        actor,
        at,
        repositories: repos,
        timeZone: this.timeZone,
        newId: this.newId,
        createTask: ({ id, projectId, kind, title, attributes }) =>
          this.insertTask(repos, { id, projectId, kind, title, attributes }, at, attributes === undefined),
        copyBody: (fromTaskId, toTaskId) => this.copyBody(repos, fromTaskId, toTaskId),
      });
      if (task.kind === "work" && name === "return") {
        const { reason, bodyBatch, commentBlocks, commentId } = input as ReturnInput;
        this.applyBodyBatch(repos, task, bodyBatch);
        this.options.onReturn?.(repos, { task, actor, reason, commentId, commentBlocks: commentBlocks ?? [], at });
      }

      repos.tasks.updateState(task.id, transition!.to, at);
      const record: TransitionRecord = {
        id: this.newId(),
        taskId: task.id,
        name,
        fromState: task.state,
        toState: transition!.to,
        actor,
        note: transition!.note?.(input) ?? options.note ?? null,
        at,
      };
      repos.tasks.appendTransition(record);
      return { ...task, state: transition!.to, updatedAt: at };
    });
    return this.summarize(task);
  }

  /**
   * Copies the content of one task's body page into another's, with fresh
   * block IDs, keeping order and nesting. Nested pages are copied without
   * their own content; references keep pointing at the same targets.
   */
  private copyBody(repos: Repositories, fromTaskId: string, toTaskId: string) {
    const from = repos.tasks.get(fromTaskId) ?? fail("not_found", `Task ${fromTaskId} does not exist`);
    const to = repos.tasks.get(toTaskId) ?? fail("not_found", `Task ${toTaskId} does not exist`);
    const ops: Batch[number][] = [];
    const copy = (nodes: readonly TreeNode[], parentId: string) => {
      let afterId: string | null = null;
      for (const node of nodes) {
        const id = this.newId();
        const { type, props, content } = node.block;
        ops.push({ op: "insert", block: { id, type, props, content }, parentId, afterId });
        copy(node.children ?? [], id);
        afterId = id;
      }
    };
    copy(repos.blocks.loadTree(from.bodyPageId)?.children ?? [], to.bodyPageId);
    if (ops.length > 0) repos.blocks.apply(ops);
  }

  /** Applies a batch that must stay inside the task's body page. */
  private applyBodyBatch(repos: Repositories, task: Task, batch: Batch | undefined) {
    if (!batch || batch.length === 0) return;
    const tree = repos.blocks.loadTree(task.bodyPageId);
    const ids = new Set<string>();
    const collect = (node: NonNullable<typeof tree>) => {
      ids.add(node.block.id);
      node.children?.forEach(collect);
    };
    if (tree) collect(tree);
    if (!batchStaysWithin(ids, batch)) fail("validation", "The body update must only change the task's body page");
    repos.blocks.apply(batch);
  }

  history(taskId: string): TransitionRecord[] {
    return this.repos.tasks.history(taskId);
  }

  // ----- Relations -----

  /** Adds a relation. Only `references` can be added this way; lineage relations come from create and promote. */
  addRelation(type: RelationType, fromTaskId: string, to: EntityRef): Relation {
    if (type === "born_from") fail("invalid_relation", "born_from is created only by promote");
    if (type === "iterates_on") fail("invalid_relation", "iterates_on is given when an update is created");
    return this.uow.run((repos) => {
      const from = repos.tasks.get(fromTaskId) ?? fail("not_found", `Task ${fromTaskId} does not exist`);
      return this.insertRelation(repos, type, from, to, this.now());
    });
  }

  addReference(fromTaskId: string, to: EntityRef): Relation {
    return this.addRelation("references", fromTaskId, to);
  }

  /** Removes a relation. Lineage relations are permanent. */
  removeRelation(relationId: string): void {
    this.uow.run((repos) => {
      const relation = repos.tasks.getRelation(relationId) ?? fail("not_found", `Relation ${relationId} does not exist`);
      if (relation.type !== "references") fail("invalid_relation", `${relation.type} relations are permanent`);
      repos.tasks.deleteRelation(relationId);
    });
  }

  removeReference(fromTaskId: string, to: EntityRef): void {
    const relation = this.repos.tasks
      .outgoing(fromTaskId, "references")
      .find((r) => r.to.kind === to.kind && r.to.id === to.id);
    if (!relation) fail("not_found", `Task ${fromTaskId} does not reference ${to.kind}:${to.id}`);
    this.removeRelation(relation!.id);
  }

  /** Relations from a task, with their targets resolved (a deleted block resolves as missing). */
  relations(taskId: string, type?: RelationType): ResolvedRelation[] {
    return this.repos.tasks.outgoing(taskId, type).map((relation) => ({
      ...relation,
      target: resolveEntity(this.referenceable, relation.to) ?? { status: "missing", ...relation.to },
    }));
  }

  /** Relations pointing at an entity, for example the updates of a work task or the tasks referencing an idea. */
  incoming(to: EntityRef, type?: RelationType): Relation[] {
    return this.repos.tasks.incoming(to, type);
  }

  private insertRelation(repos: Repositories, type: RelationType, from: Task, to: EntityRef, at: string): Relation {
    if (type === "iterates_on") {
      const target = repos.tasks.get(to.id);
      if (to.kind !== "task" || !target) fail("invalid_relation", "An update must iterate on an existing work task");
      if (target!.kind !== "work" || target!.state !== "done") {
        fail("invalid_relation", "An update must iterate on work that is done");
      }
      if (target!.projectId !== from.projectId) fail("invalid_relation", "An update must stay in its work's project");
    }
    if (type === "references") {
      if (to.kind === "task" && to.id === from.id) fail("invalid_relation", "A task cannot reference itself");
      const resolved = resolveEntity(this.referenceable, to);
      if (!resolved) fail("invalid_relation", `Unknown entity kind: ${to.kind}`);
      if (resolved!.status === "missing") fail("not_found", `${to.kind} ${to.id} does not exist`);
      if (repos.tasks.outgoing(from.id, "references").some((r) => r.to.kind === to.kind && r.to.id === to.id)) {
        fail("invalid_relation", `Task ${from.id} already references ${to.kind}:${to.id}`);
      }
    }
    const relation: Relation = { id: this.newId(), type, fromTaskId: from.id, to, createdAt: at };
    repos.tasks.insertRelation(relation);
    return relation;
  }

  // ----- Lineage -----

  /**
   * The feature's history around a task: from its root exploration (or the
   * first work, if none) through every work and update that follows.
   */
  lineage(taskId: string): LineageNode | undefined {
    const start = this.repos.tasks.get(taskId);
    if (!start || start.kind === "chore") return undefined;

    // Walk back: work → the idea it was born from; update → the work it iterates on.
    let root = start;
    const seen = new Set<string>();
    for (;;) {
      seen.add(root.id);
      const back = root.kind === "work" ? "born_from" : root.kind === "update" ? "iterates_on" : undefined;
      const parentId = back && this.repos.tasks.outgoing(root.id, back)[0]?.to.id;
      const parent = parentId ? this.repos.tasks.get(parentId) : undefined;
      if (!parent || seen.has(parent.id)) break;
      root = parent;
    }

    // Walk forward: idea → work born from it; work → updates iterating on it.
    const build = (task: Task): LineageNode => {
      const forward = task.kind === "work" ? "iterates_on" : "born_from";
      const children = this.repos.tasks
        .incoming({ kind: "task", id: task.id }, forward)
        .map((relation) => this.repos.tasks.get(relation.fromTaskId))
        .filter((child): child is Task => child !== undefined);
      return { task: this.summarize(task), children: children.map(build) };
    };
    return build(root);
  }
}
