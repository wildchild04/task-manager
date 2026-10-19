import type { Batch, NewBlock, SuggestionAction } from "../blocks/types";

export type SuggestionStatus = "pending" | "approved" | "rejected" | "withdrawn";

/** The record of a suggestion; the `suggestion` block with the same ID holds the proposed blocks while it's on the page. */
export type Suggestion = {
  id: string;
  /** The page whose own content holds the suggestion: a workspace page, a library document or a task's body page. */
  pageId: string;
  action: SuggestionAction;
  /** The block a replace or delete acts on. */
  targetId: string | null;
  note: string | null;
  /** The agent that made it. */
  author: string;
  /** The target as it was when suggested (a replace: the block itself; a delete: its subtree), to tell when it changed. */
  base: string | null;
  status: SuggestionStatus;
  /** Puts the page back as it was before an approval or rejection. */
  undo: Batch | null;
  createdAt: string;
  resolvedAt: string | null;
};

/** A suggestion's status as reported: a pending replace or delete whose target changed is `outdated`. */
export type SuggestionState = SuggestionStatus | "outdated";

/** A proposed block, with nested content. */
export type SuggestionBlockInput = NewBlock & { children?: SuggestionBlockInput[] };
