import type { CommentRepository } from "~/domain/comments/comment.repository";
import type { Comment } from "~/domain/comments/types";

/** Writes replace the map, so unit-of-work snapshots are never mutated. Insertion order is creation order. */
export class MemoryCommentRepository implements CommentRepository {
  private comments = new Map<string, Comment>();

  insert(comment: Comment): void {
    this.comments = new Map(this.comments).set(comment.id, comment);
  }

  get(id: string): Comment | undefined {
    return this.comments.get(id);
  }

  listByTask(taskId: string): Comment[] {
    return [...this.comments.values()].filter((comment) => comment.taskId === taskId);
  }

  setEdited(id: string, editedAt: string): void {
    const comment = this.comments.get(id);
    if (comment) this.insert({ ...comment, editedAt });
  }

  delete(id: string): void {
    const comments = new Map(this.comments);
    comments.delete(id);
    this.comments = comments;
  }

  snapshot(): Map<string, Comment> {
    return this.comments;
  }

  restore(snapshot: Map<string, Comment>): void {
    this.comments = snapshot;
  }
}
