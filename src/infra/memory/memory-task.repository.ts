import type { TaskFilter, TaskRepository } from "~/domain/tasks/task.repository";
import type { EntityRef, Relation, RelationType, Task, TransitionRecord } from "~/domain/tasks/types";

type State = {
  tasks: Map<string, Task>;
  transitions: TransitionRecord[];
  relations: Map<string, Relation>;
};

/**
 * Every write replaces the state with a new copy, so a snapshot taken by the
 * unit of work is never mutated afterwards. Insertion order is creation order.
 */
export class MemoryTaskRepository implements TaskRepository {
  private state: State = { tasks: new Map(), transitions: [], relations: new Map() };

  insert(task: Task): void {
    this.state = { ...this.state, tasks: new Map(this.state.tasks).set(task.id, task) };
  }

  get(id: string): Task | undefined {
    return this.state.tasks.get(id);
  }

  list(projectId: string, filter: TaskFilter = {}): Task[] {
    return [...this.state.tasks.values()].filter(
      (task) =>
        task.projectId === projectId &&
        (filter.kind === undefined || task.kind === filter.kind) &&
        (filter.state === undefined || task.state === filter.state),
    );
  }

  updateState(id: string, state: string, updatedAt: string): void {
    const task = this.state.tasks.get(id);
    if (task) this.insert({ ...task, state, updatedAt });
  }

  appendTransition(record: TransitionRecord): void {
    this.state = { ...this.state, transitions: [...this.state.transitions, record] };
  }

  history(taskId: string): TransitionRecord[] {
    return this.state.transitions.filter((record) => record.taskId === taskId);
  }

  insertRelation(relation: Relation): void {
    this.state = { ...this.state, relations: new Map(this.state.relations).set(relation.id, relation) };
  }

  getRelation(id: string): Relation | undefined {
    return this.state.relations.get(id);
  }

  deleteRelation(id: string): void {
    const relations = new Map(this.state.relations);
    relations.delete(id);
    this.state = { ...this.state, relations };
  }

  outgoing(taskId: string, type?: RelationType): Relation[] {
    return [...this.state.relations.values()].filter(
      (r) => r.fromTaskId === taskId && (type === undefined || r.type === type),
    );
  }

  incoming(to: EntityRef, type?: RelationType): Relation[] {
    return [...this.state.relations.values()].filter(
      (r) => r.to.kind === to.kind && r.to.id === to.id && (type === undefined || r.type === type),
    );
  }

  snapshot(): State {
    return this.state;
  }

  restore(snapshot: State): void {
    this.state = snapshot;
  }
}
