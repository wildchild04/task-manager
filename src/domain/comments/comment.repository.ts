import type { Comment, CommentKind } from "./types";

export interface CommentRepository {
  insert(comment: Comment): void;
  get(id: string): Comment | undefined;
  /** A task's records of `kind` (all of them when omitted), oldest first. */
  listByTask(taskId: string, kind?: CommentKind): Comment[];
  setEdited(id: string, editedAt: string): void;
  delete(id: string): void;
}
