import type { BlockType } from "~/domain/blocks/types";

/** What Enter creates after a block (or before it, at its start). */
export type EnterRule = "paragraph" | "same-type" | "unchecked-todo" | "first-child-when-open";

/** What a block becomes on Enter when it is empty, or on Backspace at its start. */
export type EmptyRule = "new-block" | "becomes-paragraph";
export type BackspaceRule = "merge" | "becomes-paragraph";

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

const textBlock = (type: BlockType, rules: Pick<BlockTypeBehavior, "enter" | "enterWhenEmpty" | "backspaceAtStart">) =>
  defineBlockType({ type, text: true, children: true, ...rules });

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
  divider: nonText("divider"),
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
  "-": { type: "bulleted_list_item", props: {} },
  "*": { type: "bulleted_list_item", props: {} },
  "1.": { type: "numbered_list_item", props: {} },
  "[]": { type: "todo", props: { checked: false } },
  ">": { type: "quote", props: {} },
};

/** Typed as the whole content of a paragraph, this turns it into a divider. */
export const DIVIDER_SHORTCUT = "---";

/** A slash menu command: turn the block into a type, or add a divider. */
export type SlashCommand = {
  value: string;
  label: string;
  description: string;
  /** Extra words the filter matches. */
  keywords: readonly string[];
  action: TypeChange | "divider";
};

export const SLASH_COMMANDS: readonly SlashCommand[] = [
  { value: "text", label: "Text", description: "Plain paragraph", keywords: ["paragraph", "plain"], action: { type: "paragraph", props: {} } },
  { value: "heading-1", label: "Heading 1", description: "Big section heading", keywords: ["h1", "title"], action: { type: "heading", props: { level: 1 } } },
  { value: "heading-2", label: "Heading 2", description: "Medium section heading", keywords: ["h2", "subtitle"], action: { type: "heading", props: { level: 2 } } },
  { value: "heading-3", label: "Heading 3", description: "Small section heading", keywords: ["h3"], action: { type: "heading", props: { level: 3 } } },
  { value: "bulleted", label: "Bulleted list", description: "A simple bulleted list", keywords: ["bullet", "unordered", "ul"], action: { type: "bulleted_list_item", props: {} } },
  { value: "numbered", label: "Numbered list", description: "A list with numbering", keywords: ["ordered", "ol", "number"], action: { type: "numbered_list_item", props: {} } },
  { value: "todo", label: "To-do", description: "Track a task with a checkbox", keywords: ["checkbox", "task", "check"], action: { type: "todo", props: { checked: false } } },
  { value: "toggle", label: "Toggle", description: "Hide content inside", keywords: ["collapse", "fold"], action: { type: "toggle", props: {} } },
  { value: "quote", label: "Quote", description: "Capture a quote", keywords: ["blockquote", "citation"], action: { type: "quote", props: {} } },
  { value: "divider", label: "Divider", description: "Separate sections", keywords: ["line", "separator", "hr"], action: "divider" },
];

/** The slash commands matching what was typed after `/`, by label or keyword prefix. */
export function matchSlashCommands(query: string): SlashCommand[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...SLASH_COMMANDS];
  return SLASH_COMMANDS.filter(
    (command) =>
      command.label.toLowerCase().split(/\s+/).some((word) => word.startsWith(q)) ||
      command.label.toLowerCase().startsWith(q) ||
      command.keywords.some((keyword) => keyword.startsWith(q)),
  );
}
