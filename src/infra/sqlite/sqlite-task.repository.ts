import type Database from "better-sqlite3";

import type { TaskFilter, TaskRepository } from "~/domain/tasks/task.repository";
import type { EntityRef, Relation, RelationType, Task, TaskKind, TransitionRecord } from "~/domain/tasks/types";

type TaskRow = {
  id: string;
  project_id: string;
  kind: TaskKind;
  state: string;
  body_page_id: string;
  attributes: string;
  created_at: string;
  updated_at: string;
};

type TransitionRow = {
  id: string;
  task_id: string;
  name: string;
  from_state: string;
  to_state: string;
  actor_kind: "human" | "agent";
  actor_name: string | null;
  note: string | null;
  at: string;
};

type RelationRow = {
  id: string;
  type: RelationType;
  from_task_id: string;
  to_kind: string;
  to_id: string;
  created_at: string;
};

const toTask = (row: TaskRow): Task => ({
  id: row.id,
  projectId: row.project_id,
  kind: row.kind,
  state: row.state,
  bodyPageId: row.body_page_id,
  attributes: JSON.parse(row.attributes),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const toTransition = (row: TransitionRow): TransitionRecord => ({
  id: row.id,
  taskId: row.task_id,
  name: row.name,
  fromState: row.from_state,
  toState: row.to_state,
  actor: row.actor_kind === "agent" ? { kind: "agent", name: row.actor_name! } : { kind: "human" },
  note: row.note,
  at: row.at,
});

const toRelation = (row: RelationRow): Relation => ({
  id: row.id,
  type: row.type,
  fromTaskId: row.from_task_id,
  to: { kind: row.to_kind, id: row.to_id },
  createdAt: row.created_at,
});

export class SqliteTaskRepository implements TaskRepository {
  private readonly s;

  constructor(db: Database.Database) {
    this.s = {
      insert: db.prepare(
        `INSERT INTO tasks (id, project_id, kind, state, body_page_id, attributes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ),
      get: db.prepare<[string], TaskRow>("SELECT * FROM tasks WHERE id = ?"),
      list: db.prepare<[{ projectId: string; kind: string | null; state: string | null }], TaskRow>(
        `SELECT * FROM tasks
         WHERE project_id = @projectId AND (@kind IS NULL OR kind = @kind) AND (@state IS NULL OR state = @state)
         ORDER BY created_at, rowid`,
      ),
      updateState: db.prepare("UPDATE tasks SET state = ?, updated_at = ? WHERE id = ?"),
      updateAttributes: db.prepare("UPDATE tasks SET attributes = ?, updated_at = ? WHERE id = ?"),
      appendTransition: db.prepare(
        `INSERT INTO task_transitions (id, task_id, name, from_state, to_state, actor_kind, actor_name, note, at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ),
      history: db.prepare<[string], TransitionRow>(
        "SELECT * FROM task_transitions WHERE task_id = ? ORDER BY at, rowid",
      ),
      insertRelation: db.prepare(
        "INSERT INTO task_relations (id, type, from_task_id, to_kind, to_id, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      ),
      getRelation: db.prepare<[string], RelationRow>("SELECT * FROM task_relations WHERE id = ?"),
      deleteRelation: db.prepare("DELETE FROM task_relations WHERE id = ?"),
      outgoing: db.prepare<[{ taskId: string; type: string | null }], RelationRow>(
        `SELECT * FROM task_relations WHERE from_task_id = @taskId AND (@type IS NULL OR type = @type)
         ORDER BY created_at, rowid`,
      ),
      incoming: db.prepare<[{ kind: string; id: string; type: string | null }], RelationRow>(
        `SELECT * FROM task_relations WHERE to_kind = @kind AND to_id = @id AND (@type IS NULL OR type = @type)
         ORDER BY created_at, rowid`,
      ),
    };
  }

  insert(task: Task): void {
    this.s.insert.run(
      task.id,
      task.projectId,
      task.kind,
      task.state,
      task.bodyPageId,
      JSON.stringify(task.attributes),
      task.createdAt,
      task.updatedAt,
    );
  }

  get(id: string): Task | undefined {
    const row = this.s.get.get(id);
    return row && toTask(row);
  }

  list(projectId: string, filter: TaskFilter = {}): Task[] {
    return this.s.list.all({ projectId, kind: filter.kind ?? null, state: filter.state ?? null }).map(toTask);
  }

  updateState(id: string, state: string, updatedAt: string): void {
    this.s.updateState.run(state, updatedAt, id);
  }

  updateAttributes(id: string, attributes: Record<string, unknown>, updatedAt: string): void {
    this.s.updateAttributes.run(JSON.stringify(attributes), updatedAt, id);
  }

  appendTransition(r: TransitionRecord): void {
    this.s.appendTransition.run(
      r.id,
      r.taskId,
      r.name,
      r.fromState,
      r.toState,
      r.actor.kind,
      r.actor.kind === "agent" ? r.actor.name : null,
      r.note,
      r.at,
    );
  }

  history(taskId: string): TransitionRecord[] {
    return this.s.history.all(taskId).map(toTransition);
  }

  insertRelation(r: Relation): void {
    this.s.insertRelation.run(r.id, r.type, r.fromTaskId, r.to.kind, r.to.id, r.createdAt);
  }

  getRelation(id: string): Relation | undefined {
    const row = this.s.getRelation.get(id);
    return row && toRelation(row);
  }

  deleteRelation(id: string): void {
    this.s.deleteRelation.run(id);
  }

  outgoing(taskId: string, type?: RelationType): Relation[] {
    return this.s.outgoing.all({ taskId, type: type ?? null }).map(toRelation);
  }

  incoming(to: EntityRef, type?: RelationType): Relation[] {
    return this.s.incoming.all({ kind: to.kind, id: to.id, type: type ?? null }).map(toRelation);
  }
}
