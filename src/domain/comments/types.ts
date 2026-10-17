import type { NewBlock } from "../blocks/types";
import type { Actor } from "../tasks/types";

/** Owner kind of a comment's body. */
export const COMMENT_OWNER_KIND = "comment";

export type Comment = {
  id: string;
  taskId: string;
  /** The `comment` root block; its children are the comment's content. */
  bodyBlockId: string;
  author: Actor;
  createdAt: string;
  /** Empty until the first edit. */
  editedAt: string | null;
};

/** A block of a new comment's body, with nested content. */
export type CommentBlockInput = NewBlock & { children?: CommentBlockInput[] };
