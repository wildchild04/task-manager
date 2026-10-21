import type { PropsByType, RichText } from "~/domain/blocks/types";

/** Content block types the viewer renders directly. */
export type ContentBlockType = Exclude<keyof PropsByType, "page" | "reference" | "comment" | "suggestion">;

/** What a page's loader sends to the browser: plain, serializable data. `projectId` is set for project pages. */
/** What a mention shows and opens: a page, or the task whose description page it is. */
export type MentionTarget = { title: string; href: string };

/** Every page mentioned in a view, by page ID, resolved to what it shows; `null` when it no longer exists. */
export type MentionTargets = Record<string, MentionTarget | null>;

export type PageView = { id: string; title: RichText; blocks: ViewBlock[]; mentions: MentionTargets; projectId?: string };

export type ViewBlock =
  | {
      kind: "content";
      id: string;
      type: ContentBlockType;
      props: Record<string, unknown>;
      content: RichText;
      children: ViewBlock[];
      /** An image's source, resolved to the URL the browser loads it from. */
      src?: string;
    }
  | { kind: "subpage"; id: string; title: RichText }
  | { kind: "reference"; id: string; target: ReferenceView }
  | SuggestionBlockView;

/** An agent's pending suggestion, with the blocks it proposes and, for a replace or delete, its target as it is now. */
export type SuggestionBlockView = {
  kind: "suggestion";
  id: string;
  author: string;
  action: "insert" | "replace" | "delete";
  note: string | null;
  outdated: boolean;
  targetId: string | null;
  blocks: ViewBlock[];
  removed: ViewBlock | null;
};

/** The suggestions among blocks, at any depth, in document order. */
export function suggestionsIn(blocks: readonly ViewBlock[]): SuggestionBlockView[] {
  return blocks.flatMap((block) =>
    block.kind === "suggestion" ? [block] : block.kind === "content" ? suggestionsIn(block.children) : [],
  );
}

export type ReferenceView =
  | { status: "page"; pageId: string; title: RichText }
  | { status: "block"; block: ViewBlock }
  | { status: "missing" }
  | { status: "cycle" };

export type PageLink = { id: string; title: string };

export function plainText(text: RichText): string {
  return text.map((span) => span.text).join("");
}
