export const BLOCK_TYPES = [
  "page",
  "paragraph",
  "heading",
  "todo",
  "bulleted_list_item",
  "numbered_list_item",
  "toggle",
  "quote",
  "divider",
  "reference",
  "comment",
  "suggestion",
] as const;

export type BlockType = (typeof BLOCK_TYPES)[number];

/** Types whose content is rich text. For a `page`, the content is its title. */
export const TEXT_TYPES = [
  "page",
  "paragraph",
  "heading",
  "todo",
  "bulleted_list_item",
  "numbered_list_item",
  "toggle",
  "quote",
] as const satisfies readonly BlockType[];

/** Types that can never have children. */
export const LEAF_TYPES = ["divider", "reference"] as const satisfies readonly BlockType[];

/** Types that may have no parent. */
export const ROOT_TYPES = ["page", "comment"] as const satisfies readonly BlockType[];

/** What a suggestion proposes; `targetId` is the block a replace or delete acts on. */
export type SuggestionAction = "insert" | "replace" | "delete";
export type SuggestionProps = { action: "insert" } | { action: "replace" | "delete"; targetId: string };

export type SimpleMark = "bold" | "italic" | "underline" | "strikethrough" | "code";
export type LinkMark = { type: "link"; href: string };
export type Mark = SimpleMark | LinkMark;

/** The single placeholder character a mention span holds (U+FFFC, "object replacement"). */
export const MENTION_TEXT = "\uFFFC";

/**
 * A run of text with marks, or a mention: a pointer at a page that counts as one
 * character (its text is always `MENTION_TEXT`) and shows the page's current title.
 */
export type TextSpan = { text: string; marks?: Mark[]; mention?: { pageId: string } };
export type RichText = TextSpan[];

export type PropsByType = {
  page: Record<string, never>;
  paragraph: Record<string, never>;
  heading: { level: 1 | 2 | 3 };
  todo: { checked: boolean };
  bulleted_list_item: Record<string, never>;
  numbered_list_item: Record<string, never>;
  toggle: Record<string, never>;
  quote: Record<string, never>;
  divider: Record<string, never>;
  reference: { targetId: string };
  comment: Record<string, never>;
  suggestion: SuggestionProps;
};

/** An entity outside the block tree that owns a root block, e.g. `{ kind: "task", id }`. */
export type Owner = { kind: string; id: string };

type BlockOf<T extends BlockType> = {
  id: string;
  type: T;
  props: PropsByType[T];
  content: RichText;
  /** Parent block, or `null` for a root. */
  parentId: string | null;
  /** Set only on owned roots. */
  owner: Owner | null;
  createdAt: string;
  updatedAt: string;
};

export type Block = { [T in BlockType]: BlockOf<T> }[BlockType];

/** A block as given to `insert`. Props and content default when omitted. */
export type NewBlock = {
  id: string;
  type: BlockType;
  props?: Record<string, unknown>;
  content?: RichText;
};

export type InsertOperation =
  | {
      op: "insert";
      block: NewBlock;
      /** `null` inserts a workspace root page. */
      parentId: string | null;
      /** Sibling to insert after; omitted or `null` inserts first. */
      afterId?: string | null;
    }
  | {
      op: "insert";
      block: NewBlock;
      /** Inserts an owned root. */
      owner: Owner;
    };

export type UpdateOperation = {
  op: "update";
  id: string;
  type?: BlockType;
  props?: Record<string, unknown>;
  content?: RichText;
};

export type MoveOperation = {
  op: "move";
  id: string;
  parentId: string | null;
  afterId?: string | null;
};

export type DeleteOperation = { op: "delete"; id: string };

export type Operation = InsertOperation | UpdateOperation | MoveOperation | DeleteOperation;

export type Batch = readonly Operation[];

/**
 * A node of a loaded tree. `children` is `null` for a nested page, which is a
 * separate page loaded on its own.
 */
export type TreeNode = { block: Block; children: TreeNode[] | null };

export function isTextType(type: BlockType): boolean {
  return (TEXT_TYPES as readonly BlockType[]).includes(type);
}

export function isLeafType(type: BlockType): boolean {
  return (LEAF_TYPES as readonly BlockType[]).includes(type);
}

export function isRootType(type: BlockType): boolean {
  return (ROOT_TYPES as readonly BlockType[]).includes(type);
}
