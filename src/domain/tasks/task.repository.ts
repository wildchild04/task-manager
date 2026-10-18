import type { EntityRef, Relation, RelationType, Task, TaskKind, TransitionRecord } from "./types";

export type TaskFilter = { kind?: TaskKind; state?: string };

export interface TaskRepository {
  insert(task: Task): void;
  get(id: string): Task | undefined;
  /** A project's tasks, oldest first, optionally filtered. */
  list(projectId: string, filter?: TaskFilter): Task[];
  updateState(id: string, state: string, updatedAt: string): void;
  updateAttributes(id: string, attributes: Record<string, unknown>, updatedAt: string): void;

  appendTransition(record: TransitionRecord): void;
  /** A task's transitions, oldest first. */
  history(taskId: string): TransitionRecord[];

  insertRelation(relation: Relation): void;
  getRelation(id: string): Relation | undefined;
  deleteRelation(id: string): void;
  /** Removes a task with its transition history and the relations from it. Relations to it are kept. */
  delete(id: string): void;
  /** Relations from a task, oldest first. */
  outgoing(taskId: string, type?: RelationType): Relation[];
  /** Relations pointing at an entity, oldest first. */
  incoming(to: EntityRef, type?: RelationType): Relation[];
}
