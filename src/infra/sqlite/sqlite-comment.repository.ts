import type Database from "better-sqlite3";

import type { CommentRepository } from "~/domain/comments/comment.repository";
import type { Comment } from "~/domain/comments/types";

type CommentRow = {
  id: string;
  task_id: string;
  body_block_id: string;
  actor_kind: "human" | "agent";
  actor_name: string | null;
  created_at: string;
  edited_at: string | null;
};

const toComment = (row: CommentRow): Comment => ({
  id: row.id,
  taskId: row.task_id,
  bodyBlockId: row.body_block_id,
  author: row.actor_kind === "agent" ? { kind: "agent", name: row.actor_name! } : { kind: "human" },
  createdAt: row.created_at,
  editedAt: row.edited_at,
});

export class SqliteCommentRepository implements CommentRepository {
  private readonly s;

  constructor(db: Database.Database) {
    this.s = {
      insert: db.prepare(
        `INSERT INTO comments (id, task_id, body_block_id, actor_kind, actor_name, created_at, edited_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ),
      get: db.prepare<[string], CommentRow>("SELECT * FROM comments WHERE id = ?"),
      listByTask: db.prepare<[string], CommentRow>(
        "SELECT * FROM comments WHERE task_id = ? ORDER BY created_at, rowid",
      ),
      setEdited: db.prepare("UPDATE comments SET edited_at = ? WHERE id = ?"),
      delete: db.prepare("DELETE FROM comments WHERE id = ?"),
    };
  }

  insert(c: Comment): void {
    this.s.insert.run(
      c.id,
      c.taskId,
      c.bodyBlockId,
      c.author.kind,
      c.author.kind === "agent" ? c.author.name : null,
      c.createdAt,
      c.editedAt,
    );
  }

  get(id: string): Comment | undefined {
    const row = this.s.get.get(id);
    return row && toComment(row);
  }

  listByTask(taskId: string): Comment[] {
    return this.s.listByTask.all(taskId).map(toComment);
  }

  setEdited(id: string, editedAt: string): void {
    this.s.setEdited.run(editedAt, id);
  }

  delete(id: string): void {
    this.s.delete.run(id);
  }
}
