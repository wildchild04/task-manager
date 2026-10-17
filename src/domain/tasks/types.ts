export const TASK_KINDS = ["exploration", "update", "work", "chore"] as const;
export type TaskKind = (typeof TASK_KINDS)[number];

/** Owner kind of a task's body page. */
export const TASK_OWNER_KIND = "task";

/** Who did something: the single human user, or an agent identified by name. */
export type Actor = { kind: "human" } | { kind: "agent"; name: string };

export const HUMAN: Actor = { kind: "human" };

export type Task = {
  id: string;
  projectId: string;
  kind: TaskKind;
  state: string;
  bodyPageId: string;
  attributes: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

/** A task with its title read from the body page. */
export type TaskSummary = Task & { title: string };

/** One applied transition. History entries are never changed or deleted. */
export type TransitionRecord = {
  id: string;
  taskId: string;
  name: string;
  fromState: string;
  toState: string;
  actor: Actor;
  note: string | null;
  at: string;
};

export const RELATION_TYPES = ["born_from", "iterates_on", "references"] as const;
export type RelationType = (typeof RELATION_TYPES)[number];

/** A reference to anything referenceable: a kind registered by its domain, plus an ID. */
export type EntityRef = { kind: string; id: string };

export type Relation = {
  id: string;
  type: RelationType;
  fromTaskId: string;
  to: EntityRef;
  createdAt: string;
};

export type ResolvedEntity = { status: "ok"; kind: string; id: string; title: string } | { status: "missing"; kind: string; id: string };

/** A relation with its target resolved. */
export type ResolvedRelation = Relation & { target: ResolvedEntity };

export type LineageNode = { task: TaskSummary; children: LineageNode[] };
