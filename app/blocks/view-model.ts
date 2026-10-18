import type { PropsByType, RichText } from "~/domain/blocks/types";

/** Content block types the viewer renders directly. */
export type ContentBlockType = Exclude<keyof PropsByType, "page" | "reference" | "comment">;

/** What a page's loader sends to the browser: plain, serializable data. `projectId` is set for project pages. */
/** The current title of every page mentioned in a view, by page ID; `null` when the page no longer exists. */
export type MentionTitles = Record<string, string | null>;

export type PageView = { id: string; title: RichText; blocks: ViewBlock[]; mentions: MentionTitles; projectId?: string };

export type ViewBlock =
  | {
      kind: "content";
      id: string;
      type: ContentBlockType;
      props: Record<string, unknown>;
      content: RichText;
      children: ViewBlock[];
    }
  | { kind: "subpage"; id: string; title: RichText }
  | { kind: "reference"; id: string; target: ReferenceView };

export type ReferenceView =
  | { status: "page"; pageId: string; title: RichText }
  | { status: "block"; block: ViewBlock }
  | { status: "missing" }
  | { status: "cycle" };

export type PageLink = { id: string; title: string };

export function plainText(text: RichText): string {
  return text.map((span) => span.text).join("");
}
