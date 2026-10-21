import type { BlockType } from "~/domain/blocks/types";

/**
 * What Enter does: create a block after this one (or before it, at its start), add a line (code), or move to
 * the cell below (a table cell).
 */
export type EnterRule = "paragraph" | "same-type" | "unchecked-todo" | "first-child-when-open" | "line-break" | "cell-below";

/** What a block becomes on Enter when it is empty, or on Backspace at its start. */
export type EmptyRule = "new-block" | "becomes-paragraph" | "line-break" | "cell-below";
export type BackspaceRule = "merge" | "becomes-paragraph" | "paragraph-when-empty" | "nothing";

/** How a block type behaves in the editor. */
export type BlockTypeBehavior = {
  type: BlockType;
  /** Holds editable rich text (and the caret). */
  text: boolean;
  /** Other blocks can be nested under it in the editor. */
  children: boolean;
  enter: EnterRule;
  enterWhenEmpty: EmptyRule;
  backspaceAtStart: BackspaceRule;
};

/** Helper that keeps definitions complete. */
export function defineBlockType(behavior: BlockTypeBehavior): BlockTypeBehavior {
  return behavior;
}

const textBlock = (
  type: BlockType,
  rules: Pick<BlockTypeBehavior, "enter" | "enterWhenEmpty" | "backspaceAtStart">,
  children = true,
) => defineBlockType({ type, text: true, children, ...rules });

const nonText = (type: BlockType) =>
  defineBlockType({ type, text: false, children: false, enter: "paragraph", enterWhenEmpty: "new-block", backspaceAtStart: "merge" });

/** Every block type's editing behavior, in one place. Commands read these; nothing else is type-specific. */
export const BLOCK_TYPES: Readonly<Partial<Record<BlockType, BlockTypeBehavior>>> = {
  paragraph: textBlock("paragraph", { enter: "paragraph", enterWhenEmpty: "new-block", backspaceAtStart: "merge" }),
  heading: textBlock("heading", { enter: "paragraph", enterWhenEmpty: "new-block", backspaceAtStart: "becomes-paragraph" }),
  bulleted_list_item: textBlock("bulleted_list_item", {
    enter: "same-type",
    enterWhenEmpty: "becomes-paragraph",
    backspaceAtStart: "becomes-paragraph",
  }),
  numbered_list_item: textBlock("numbered_list_item", {
    enter: "same-type",
    enterWhenEmpty: "becomes-paragraph",
    backspaceAtStart: "becomes-paragraph",
  }),
  todo: textBlock("todo", { enter: "unchecked-todo", enterWhenEmpty: "becomes-paragraph", backspaceAtStart: "becomes-paragraph" }),
  toggle: textBlock("toggle", {
    enter: "first-child-when-open",
    enterWhenEmpty: "becomes-paragraph",
    backspaceAtStart: "becomes-paragraph",
  }),
  quote: textBlock("quote", { enter: "paragraph", enterWhenEmpty: "becomes-paragraph", backspaceAtStart: "becomes-paragraph" }),
  callout: textBlock("callout", { enter: "paragraph", enterWhenEmpty: "becomes-paragraph", backspaceAtStart: "becomes-paragraph" }),
  code: textBlock("code", { enter: "line-break", enterWhenEmpty: "line-break", backspaceAtStart: "paragraph-when-empty" }, false),
  table_cell: textBlock("table_cell", { enter: "cell-below", enterWhenEmpty: "cell-below", backspaceAtStart: "nothing" }, false),
  table: nonText("table"),
  table_row: nonText("table_row"),
  divider: nonText("divider"),
  image: nonText("image"),
  reference: nonText("reference"),
  page: nonText("page"),
  suggestion: nonText("suggestion"),
};

/** A block type's behavior; unknown types behave as non-text blocks. */
export const behaviorOf = (type: BlockType): BlockTypeBehavior => BLOCK_TYPES[type] ?? nonText(type);

/** A block type change: the type and its props. */
export type TypeChange = { type: BlockType; props: Record<string, unknown> };

/** Typed at the start of a paragraph and followed by a space, these change its type. */
export const MARKDOWN_SHORTCUTS: Readonly<Record<string, TypeChange>> = {
  "#": { type: "heading", props: { level: 1 } },
  "##": { type: "heading", props: { level: 2 } },
  "###": { type: "heading", props: { level: 3 } },
  "####": { type: "heading", props: { level: 4 } },
  "#####": { type: "heading", props: { level: 5 } },
  "######": { type: "heading", props: { level: 6 } },
  "-": { type: "bulleted_list_item", props: {} },
  "*": { type: "bulleted_list_item", props: {} },
  "1.": { type: "numbered_list_item", props: {} },
  "[]": { type: "todo", props: { checked: false } },
  ">": { type: "quote", props: {} },
};

/** Typed as the whole content of a paragraph, this turns it into a divider. */
export const DIVIDER_SHORTCUT = "---";

/** A paragraph holding only ```` ``` ```` and a language becomes, on Enter, an empty code block of that language. */
export const CODE_SHORTCUT = /^```([^\s`]{0,32})$/;

/** A new table's size, and the props a new callout starts with. */
export const NEW_TABLE = { rows: 3, columns: 3 } as const;
export const NEW_CALLOUT = { emoji: "💡", tone: "default" } as const;

/** A slash menu command: turn the block into a type, or add a divider, a table or a sub-page. */
export type SlashCommand = {
  value: string;
  label: string;
  description: string;
  /** Extra words the filter matches. */
  keywords: readonly string[];
  action: TypeChange | "divider" | "table" | "page";
};

export const SLASH_COMMANDS: readonly SlashCommand[] = [
  { value: "text", label: "Text", description: "Plain paragraph", keywords: ["paragraph", "plain"], action: { type: "paragraph", props: {} } },
  { value: "heading-1", label: "Heading 1", description: "Big section heading", keywords: ["h1", "title"], action: { type: "heading", props: { level: 1 } } },
  { value: "heading-2", label: "Heading 2", description: "Medium section heading", keywords: ["h2", "subtitle"], action: { type: "heading", props: { level: 2 } } },
  { value: "heading-3", label: "Heading 3", description: "Small section heading", keywords: ["h3"], action: { type: "heading", props: { level: 3 } } },
  { value: "heading-4", label: "Heading 4", description: "Smaller heading", keywords: ["h4"], action: { type: "heading", props: { level: 4 } } },
  { value: "heading-5", label: "Heading 5", description: "Minor heading", keywords: ["h5"], action: { type: "heading", props: { level: 5 } } },
  { value: "heading-6", label: "Heading 6", description: "Smallest heading", keywords: ["h6"], action: { type: "heading", props: { level: 6 } } },
  { value: "bulleted", label: "Bulleted list", description: "A simple bulleted list", keywords: ["bullet", "unordered", "ul"], action: { type: "bulleted_list_item", props: {} } },
  { value: "numbered", label: "Numbered list", description: "A list with numbering", keywords: ["ordered", "ol", "number"], action: { type: "numbered_list_item", props: {} } },
  { value: "todo", label: "To-do", description: "Track a task with a checkbox", keywords: ["checkbox", "task", "check"], action: { type: "todo", props: { checked: false } } },
  { value: "toggle", label: "Toggle", description: "Hide content inside", keywords: ["collapse", "fold"], action: { type: "toggle", props: {} } },
  { value: "quote", label: "Quote", description: "Capture a quote", keywords: ["blockquote", "citation"], action: { type: "quote", props: {} } },
  { value: "callout", label: "Callout", description: "Make a note stand out", keywords: ["note", "tip", "warning", "info"], action: { type: "callout", props: { ...NEW_CALLOUT } } },
  { value: "code", label: "Code", description: "A block of code", keywords: ["snippet", "pre"], action: { type: "code", props: { language: "" } } },
  { value: "table", label: "Table", description: "Rows and columns", keywords: ["grid", "rows", "columns"], action: "table" },
  { value: "divider", label: "Divider", description: "Separate sections", keywords: ["line", "separator", "hr"], action: "divider" },
  { value: "page", label: "Page", description: "A page inside this one", keywords: ["subpage", "sub-page", "document"], action: "page" },
];

/**
 * The slash commands matching what was typed after `/`, by label or keyword
 * prefix. Page only with `subPages` (where sub-pages can be opened on their own).
 */
export function matchSlashCommands(query: string, { subPages = false }: { subPages?: boolean } = {}): SlashCommand[] {
  const q = query.trim().toLowerCase();
  const offered = subPages ? SLASH_COMMANDS : SLASH_COMMANDS.filter((command) => command.action !== "page");
  if (!q) return [...offered];
  return offered.filter(
    (command) =>
      command.label.toLowerCase().split(/\s+/).some((word) => word.startsWith(q)) ||
      command.label.toLowerCase().startsWith(q) ||
      command.keywords.some((keyword) => keyword.startsWith(q)),
  );
}
