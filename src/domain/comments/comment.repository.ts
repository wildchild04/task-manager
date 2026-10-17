import type { Comment } from "./types";

export interface CommentRepository {
  insert(comment: Comment): void;
  get(id: string): Comment | undefined;
  /** A task's comments, oldest first. */
  listByTask(taskId: string): Comment[];
  setEdited(id: string, editedAt: string): void;
  delete(id: string): void;
}
