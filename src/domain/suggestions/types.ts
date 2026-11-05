import type { Batch, NewBlock, SuggestionAction } from "../blocks/types";
import type { Schedule } from "../chores/schedule";

export type SuggestionStatus = "pending" | "approved" | "rejected" | "withdrawn";

/** What an action suggestion acts on. */
export type SubjectKind = "project" | "page" | "task";
export type Subject = { kind: SubjectKind; id: string };

/** The actions an agent can suggest, besides block changes. */
export type ActionKind = "rename" | "delete" | "schedule" | "transition";

/** The ending transitions, which agents can only suggest. */
export type EndingTransition = "cancel" | "tombstone";

/** What an action proposes. */
export type ActionPayload =
  | { action: "rename"; title: string }
  | { action: "delete" }
  | { action: "schedule"; schedule: Schedule | null }
  | { action: "transition"; name: EndingTransition; scope?: "series" };

type Record = {
  id: string;
  /** A block suggestion: the page whose own content holds it. An action: its subject's place page. */
  pageId: string;
  note: string | null;
  /** The agent that made it. */
  author: string;
  /**
   * What it was checked against, to tell when it changed: a replace, the block itself; a block delete, its
   * subtree; an action, what it depends on (see `SuggestedActions.baseOf`).
   */
  base: string | null;
  status: SuggestionStatus;
  createdAt: string;
  resolvedAt: string | null;
  /** 1 when made, one more with each revision by its agent. */
  revision: number;
  /** When its agent last revised it; null until then. */
  revisedAt: string | null;
};

/** A proposed change to a page's own content; the `suggestion` block with the same ID holds the proposed blocks while it's on the page. */
export type BlockSuggestion = Record & {
  subject: null;
  action: SuggestionAction;
  /** The block a replace or delete acts on. */
  targetId: string | null;
  /** Puts the page back as it was before an approval or rejection. */
  undo: Batch | null;
};

/** A proposed action on a project, page or task. */
export type ActionSuggestion = Record & {
  subject: Subject;
  action: ActionKind;
  payload: ActionPayload;
  targetId: null;
  undo: null;
};

export type Suggestion = BlockSuggestion | ActionSuggestion;

/**
 * A suggestion's status as reported: a pending one with open feedback is `changes_requested`, and otherwise,
 * when its target or subject changed, `outdated`.
 */
export type SuggestionState = SuggestionStatus | "outdated" | "changes_requested";

/** The human's request for changes, given on one revision of a suggestion; open while that is still the current one. */
export type SuggestionFeedback = {
  id: string;
  suggestionId: string;
  text: string;
  revision: number;
  createdAt: string;
};

/** A proposed block, with nested content. */
export type SuggestionBlockInput = NewBlock & { children?: SuggestionBlockInput[] };
