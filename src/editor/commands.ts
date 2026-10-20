import {
  type BlockType,
  type CalloutTone,
  type NewBlock,
  type Operation,
  type RichText,
  type SimpleMark,
  TABLE_TYPES,
} from "~/domain/blocks/types";

import {
  behaviorOf,
  CODE_SHORTCUT,
  DIVIDER_SHORTCUT,
  MARKDOWN_SHORTCUTS,
  NEW_TABLE,
  type SlashCommand,
  type TypeChange,
} from "./block-types";
import {
  applyOps,
  type BlockRange,
  caret,
  caretOrder,
  documentOrder,
  type EditorState,
  getBlock,
  isCollapsed,
  previousSibling,
  type Selection,
  selectionEnd,
  selectionStart,
  type TextRange,
} from "./editor-state";
import * as text from "./rich-text";
import { cellBelow, newTable } from "./tables";

/** A table, its rows and its cells: Backspace and Delete never merge into or out of them. */
const isTablePart = (type: BlockType) => (TABLE_TYPES as readonly BlockType[]).includes(type);

/**
 * What a command produces: the operations to apply and where the selection
 * goes; with `range` or `blocks`, text across blocks or whole blocks end up selected.
 */
export type CommandResult = { ops: Operation[]; selection: Selection; range?: TextRange; blocks?: BlockRange };

/** Context a command needs besides the state: fresh IDs and which toggles are closed. */
export type CommandContext = { newId: () => string; closed?: ReadonlySet<string> };

const updateContent = (id: string, content: RichText): Operation => ({ op: "update", id, content });

const isText = (state: EditorState, id: string) => behaviorOf(getBlock(state, id).type).text;

// ----- Text -----

/** Replaces the selection with `inserted` (typing, pasting plain text, line breaks). */
export function insertText(state: EditorState, selection: Selection, inserted: string): CommandResult {
  const block = getBlock(state, selection.blockId);
  const start = selectionStart(selection);
  const content = text.replace(block.content, start, selectionEnd(selection), inserted);
  return { ops: [updateContent(block.id, content)], selection: caret(block.id, start + inserted.length) };
}

export type DeleteUnit = "character" | "word";

/**
 * Deletes the selection, or one character or word before the caret. At the
 * start of a block it applies the block's Backspace rule instead.
 */
export function deleteBackward(
  state: EditorState,
  selection: Selection,
  context: CommandContext,
  unit: DeleteUnit = "character",
): CommandResult | null {
  const block = getBlock(state, selection.blockId);
  if (!isCollapsed(selection)) return deleteSelection(state, selection);
  const offset = selection.focus;
  if (offset === 0) return backspaceAtStart(state, block.id, context);
  const value = text.plain(block.content);
  const from = unit === "word" ? text.previousWord(value, offset) : text.previousCharacter(value, offset);
  return { ops: [updateContent(block.id, text.remove(block.content, from, offset))], selection: caret(block.id, from) };
}

/** Deletes the selection, or one character or word after the caret. At the end of a block it joins the next one. */
export function deleteForward(
  state: EditorState,
  selection: Selection,
  context: CommandContext,
  unit: DeleteUnit = "character",
): CommandResult | null {
  const block = getBlock(state, selection.blockId);
  if (!isCollapsed(selection)) return deleteSelection(state, selection);
  const value = text.plain(block.content);
  const offset = selection.focus;
  if (offset >= value.length) return deleteAtEnd(state, block.id, context);
  const to = unit === "word" ? text.nextWord(value, offset) : text.nextCharacter(value, offset);
  return { ops: [updateContent(block.id, text.remove(block.content, offset, to))], selection: caret(block.id, offset) };
}

function deleteSelection(state: EditorState, selection: Selection): CommandResult {
  const block = getBlock(state, selection.blockId);
  const start = selectionStart(selection);
  return {
    ops: [updateContent(block.id, text.remove(block.content, start, selectionEnd(selection)))],
    selection: caret(block.id, start),
  };
}

/** Replaces the `@query` text between `start` and the caret with a mention of a page and a space. */
export function mentionPage(state: EditorState, selection: Selection, start: number, pageId: string): CommandResult {
  const block = getBlock(state, selection.blockId);
  const content = text.insertMention(block.content, start, selection.focus, pageId);
  return { ops: [updateContent(block.id, content)], selection: caret(block.id, start + 2) };
}

// ----- Marks and links -----

export function toggleMark(state: EditorState, selection: Selection, mark: SimpleMark): CommandResult | null {
  if (isCollapsed(selection)) return null;
  const block = getBlock(state, selection.blockId);
  // Code is plain text.
  if (block.type === "code") return null;
  const content = text.toggleMark(block.content, selectionStart(selection), selectionEnd(selection), mark);
  return { ops: [updateContent(block.id, content)], selection };
}

/** Sets the link on the selected text, or removes it with `null`. */
export function setLink(state: EditorState, selection: Selection, href: string | null): CommandResult | null {
  if (isCollapsed(selection)) return null;
  const block = getBlock(state, selection.blockId);
  if (block.type === "code") return null;
  const content = text.setLink(block.content, selectionStart(selection), selectionEnd(selection), href);
  return { ops: [updateContent(block.id, content)], selection };
}

// ----- Enter -----

/** The block Enter creates next to `id`, by its type's rule. */
function newBlockAfter(state: EditorState, id: string, newId: string, content: NewBlock["content"]): NewBlock {
  const { type } = getBlock(state, id);
  const rule = behaviorOf(type).enter;
  if (rule === "same-type") return { id: newId, type, content };
  if (rule === "unchecked-todo") return { id: newId, type: "todo", props: { checked: false }, content };
  return { id: newId, type: "paragraph", content };
}

const toParagraph = (id: string): Operation => ({ op: "update", id, type: "paragraph", props: {} });

/**
 * Enter: splits the block at the caret by its type's rule. In the title it
 * moves to the first block, creating one when the page is empty.
 */
export function splitBlock(state: EditorState, selection: Selection, context: CommandContext): CommandResult {
  if (selection.blockId === state.rootId) {
    const first = documentOrder(state, context.closed).find((id) => isText(state, id));
    const firstChild = getBlock(state, state.rootId).children[0];
    if (first && first === firstChild) return { ops: [], selection: caret(first, 0) };
    const id = context.newId();
    return {
      ops: [{ op: "insert", block: { id, type: "paragraph" }, parentId: state.rootId, afterId: null }],
      selection: caret(id, 0),
    };
  }

  // Code adds a line; a table cell moves to the cell below.
  const current = getBlock(state, selection.blockId);
  const rule = behaviorOf(current.type).enter;
  if (rule === "line-break") return insertText(state, selection, "\n");
  if (rule === "cell-below") return cellBelow(state, current.id, context.newId) ?? { ops: [], selection };
  // A paragraph holding only ```` ``` ```` and a language becomes an empty code block of that language.
  const fence =
    current.type === "paragraph" && current.children.length === 0 ? CODE_SHORTCUT.exec(text.plain(current.content)) : null;
  if (fence && isCollapsed(selection) && selection.focus === text.length(current.content)) {
    return {
      ops: [{ op: "update", id: current.id, type: "code", props: { language: fence[1] }, content: [] }],
      selection: caret(current.id, 0),
    };
  }

  const removed = isCollapsed(selection) ? null : deleteSelection(state, selection);
  const working = removed ? applyOps(state, removed.ops) : state;
  const block = getBlock(working, selection.blockId);
  const behavior = behaviorOf(block.type);
  const offset = selectionStart(selection);
  const value = text.plain(block.content);
  const prefix = removed?.ops ?? [];

  if (value.length === 0 && behavior.enterWhenEmpty === "becomes-paragraph") {
    return { ops: [...prefix, toParagraph(block.id)], selection: caret(block.id, 0) };
  }

  const id = context.newId();
  if (offset === 0 && value.length > 0) {
    // At the start of a non-empty block, the new empty block goes before it.
    const created = newBlockAfter(working, block.id, id, []);
    return {
      ops: [...prefix, { op: "insert", block: created, parentId: block.parentId!, afterId: previousSibling(working, block.id) }],
      selection: caret(block.id, 0),
    };
  }

  const before = text.slice(block.content, 0, offset);
  const after = text.slice(block.content, offset);
  const ops: Operation[] = [...prefix, updateContent(block.id, before)];
  if (behavior.enter === "first-child-when-open" && !context.closed?.has(block.id)) {
    ops.push({ op: "insert", block: { id, type: "paragraph", content: after }, parentId: block.id, afterId: null });
  } else {
    ops.push({ op: "insert", block: newBlockAfter(working, block.id, id, after), parentId: block.parentId!, afterId: block.id });
  }
  return { ops, selection: caret(id, 0) };
}

// ----- Backspace and Delete at block edges -----

/** The text block before `id` in reading order (the title if there is none). */
function previousTextBlock(state: EditorState, id: string, closed?: ReadonlySet<string>): string {
  const order = caretOrder(state, closed);
  return order[Math.max(0, order.indexOf(id) - 1)] ?? state.rootId;
}

/** The visible block (of any type) before `id` in reading order. */
function previousVisibleBlock(state: EditorState, id: string, closed?: ReadonlySet<string>): string | null {
  const order = documentOrder(state, closed);
  return order[order.indexOf(id) - 1] ?? null;
}

/** Moves `id`'s children after the last child of `into`, keeping their order. */
function adoptChildren(state: EditorState, id: string, into: string): Operation[] {
  const ops: Operation[] = [];
  let afterId = getBlock(state, into).children.at(-1) ?? null;
  for (const child of getBlock(state, id).children) {
    ops.push({ op: "move", id: child, parentId: into, afterId });
    afterId = child;
  }
  return ops;
}

/** Merges block `from` into the end of text block `into`; `from`'s children follow `into`'s. */
function merge(state: EditorState, into: string, from: string): CommandResult {
  const target = getBlock(state, into);
  const source = getBlock(state, from);
  const joinAt = text.length(target.content);
  // Code holds plain text, so what joins it loses its marks and mentions.
  const joined = target.type === "code" ? text.withoutFormatting(source.content) : source.content;
  return {
    ops: [
      updateContent(into, text.concat(target.content, joined)),
      ...adoptChildren(state, from, into),
      { op: "delete", id: from },
    ],
    selection: caret(into, joinAt),
  };
}

function backspaceAtStart(state: EditorState, id: string, context: CommandContext): CommandResult | null {
  if (id === state.rootId) return null;
  const block = getBlock(state, id);
  const rule = behaviorOf(block.type).backspaceAtStart;
  if (rule === "becomes-paragraph") return { ops: [toParagraph(id)], selection: caret(id, 0) };
  // Table cells never merge; a code block only becomes a paragraph when it's empty.
  if (rule === "nothing") return null;
  if (rule === "paragraph-when-empty") {
    return text.length(block.content) === 0 ? { ops: [toParagraph(id)], selection: caret(id, 0) } : null;
  }
  if (block.parentId !== state.rootId) return outdent(state, caret(id, 0));

  const previous = previousVisibleBlock(state, id, context.closed);
  if (previous === null) {
    // The first block: an empty one goes away, handing the caret to the title.
    if (text.length(block.content) > 0 || block.children.length > 0) return null;
    const title = getBlock(state, state.rootId);
    return { ops: [{ op: "delete", id }], selection: caret(state.rootId, text.length(title.content)) };
  }
  const before = getBlock(state, previous);
  if (before.type === "reference" || before.type === "divider") {
    return { ops: [{ op: "delete", id: previous }], selection: caret(id, 0) };
  }
  // Sub-pages, suggestions and tables are never deleted by Backspace, nor does text merge into a table: step over
  // them. Code can't hold another block's children, so a block with children steps over it too.
  const stepOver =
    before.type === "page" ||
    before.type === "suggestion" ||
    isTablePart(before.type) ||
    (before.type === "code" && block.children.length > 0);
  if (stepOver) {
    const target = previousTextBlock(state, id, context.closed);
    return { ops: [], selection: caret(target, text.length(getBlock(state, target).content)) };
  }
  return merge(state, previous, id);
}

function deleteAtEnd(state: EditorState, id: string, context: CommandContext): CommandResult | null {
  if (id === state.rootId) return null;
  const current = getBlock(state, id);
  if (current.type === "table_cell") return null;
  const order = documentOrder(state, context.closed);
  const next = order[order.indexOf(id) + 1];
  if (!next) return null;
  const after = getBlock(state, next);
  const length = text.length(current.content);
  if (after.type === "reference" || after.type === "divider") return { ops: [{ op: "delete", id: next }], selection: caret(id, length) };
  if (after.type === "page" || after.type === "suggestion" || isTablePart(after.type)) return null;
  if (current.type === "code" && after.children.length > 0) return null;
  return merge(state, id, next);
}

// ----- Nesting -----

/** Tab: nests the block as the last child of its previous sibling. */
export function indent(state: EditorState, selection: Selection): CommandResult | null {
  const id = selection.blockId;
  if (id === state.rootId || getBlock(state, id).type === "table_cell") return null;
  const previous = previousSibling(state, id);
  if (previous === null || !behaviorOf(getBlock(state, previous).type).children) return null;
  return {
    ops: [{ op: "move", id, parentId: previous, afterId: getBlock(state, previous).children.at(-1) ?? null }],
    selection,
  };
}

/** Shift+Tab: moves a nested block out to follow its parent; the siblings after it become its children. */
export function outdent(state: EditorState, selection: Selection): CommandResult | null {
  const id = selection.blockId;
  if (id === state.rootId) return null;
  const { parentId, type } = getBlock(state, id);
  if (parentId === null || parentId === state.rootId || type === "table_cell") return null;
  const parent = getBlock(state, parentId);
  const followers = parent.children.slice(parent.children.indexOf(id) + 1);
  // The blocks after it become its children, which a block like code can't have.
  if (followers.length > 0 && !behaviorOf(type).children) return null;
  const ops: Operation[] = [{ op: "move", id, parentId: parent.parentId!, afterId: parentId }];
  let afterId = getBlock(state, id).children.at(-1) ?? null;
  for (const follower of followers) {
    ops.push({ op: "move", id: follower, parentId: id, afterId });
    afterId = follower;
  }
  return { ops, selection };
}

// ----- Type changes -----

/**
 * The markdown shortcut completed by typing a space at the caret in a
 * paragraph, if any: `# `, `- `, `[] `… at its start.
 */
export function markdownShortcut(state: EditorState, selection: Selection): CommandResult | null {
  const block = getBlock(state, selection.blockId);
  if (block.type !== "paragraph" || !isCollapsed(selection)) return null;
  const typed = text.plain(block.content).slice(0, selection.focus);
  if (!typed.endsWith(" ")) return null;
  const change: TypeChange | undefined = MARKDOWN_SHORTCUTS[typed.slice(0, -1)];
  if (!change) return null;
  return {
    ops: [{ op: "update", id: block.id, type: change.type, props: change.props, content: text.slice(block.content, typed.length) }],
    selection: caret(block.id, 0),
  };
}

/** `---` as a paragraph's whole content turns it into a divider followed by an empty paragraph. */
export function dividerShortcut(state: EditorState, selection: Selection, context: CommandContext): CommandResult | null {
  const block = getBlock(state, selection.blockId);
  if (block.type !== "paragraph" || text.plain(block.content) !== DIVIDER_SHORTCUT || block.children.length > 0) return null;
  const divider = context.newId();
  const paragraph = context.newId();
  return {
    ops: [
      { op: "insert", block: { id: divider, type: "divider" }, parentId: block.parentId!, afterId: block.id },
      { op: "insert", block: { id: paragraph, type: "paragraph" }, parentId: block.parentId!, afterId: divider },
      { op: "delete", id: block.id },
    ],
    selection: caret(paragraph, 0),
  };
}

/** Checks or unchecks a todo. */
export function toggleTodo(state: EditorState, id: string, selection: Selection): CommandResult | null {
  const block = getBlock(state, id);
  if (block.type !== "todo") return null;
  return { ops: [{ op: "update", id, props: { checked: block.props.checked !== true } }], selection };
}

// ----- Slash commands -----

/**
 * Turns a block into another type, with `content` as its text. Code keeps the
 * text as plain text and can't hold children: they move out to follow it.
 */
function changeType(state: EditorState, id: string, change: TypeChange, content: RichText): Operation[] {
  const { type, props } = change;
  if (type !== "code") return [{ op: "update", id, type, props, content }];
  const block = getBlock(state, id);
  const ops: Operation[] = [{ op: "update", id, type, props, content: text.withoutFormatting(content) }];
  let afterId = id;
  for (const child of block.children) {
    ops.push({ op: "move", id: child, parentId: block.parentId!, afterId });
    afterId = child;
  }
  return ops;
}

/** Whether "Turn into" can change a block: text blocks other than table cells and the title. */
export const canTurnInto = (state: EditorState, id: string): boolean =>
  id !== state.rootId && isText(state, id) && getBlock(state, id).type !== "table_cell";

/**
 * Turns blocks into a type, in order, as one batch: each block's change
 * applies to the state the earlier ones left. Blocks "Turn into" can't change
 * are skipped; `null` when none changes.
 */
export function turnInto(state: EditorState, ids: readonly string[], change: TypeChange, selection: Selection): CommandResult | null {
  const ops: Operation[] = [];
  let working = state;
  for (const id of ids) {
    if (!canTurnInto(working, id)) continue;
    const changed = changeType(working, id, change, getBlock(working, id).content);
    ops.push(...changed);
    working = applyOps(working, changed);
  }
  return ops.length > 0 ? { ops, selection } : null;
}

/**
 * Applies a slash command typed in `blockId` as `/query` from offset `start`
 * to `end`: removes that text, then turns the block into the command's type,
 * or adds a divider, table or empty sub-page (replacing the block when it is
 * left empty).
 */
export function slashCommand(
  state: EditorState,
  blockId: string,
  start: number,
  end: number,
  command: SlashCommand,
  context: CommandContext,
): CommandResult {
  const block = getBlock(state, blockId);
  const content = text.remove(block.content, start, end);
  const replaceable = text.length(content) === 0 && block.children.length === 0 && behaviorOf(block.type).text;
  if (command.action === "table") {
    // A new table replaces an empty block, or follows one with text; the caret goes to its first cell.
    const table = newTable(block.parentId!, blockId, NEW_TABLE.rows, NEW_TABLE.columns, context.newId);
    const around: Operation[] = replaceable ? [{ op: "delete", id: blockId }] : [updateContent(blockId, content)];
    return { ops: [...table.ops, ...around], selection: caret(table.firstCell, 0) };
  }
  if (command.action === "page") {
    // An empty, untitled sub-page; the caret stays before it, as the editor opens the page next.
    const page: Operation = { op: "insert", block: { id: context.newId(), type: "page", content: [] }, parentId: block.parentId!, afterId: blockId };
    if (!replaceable) return { ops: [updateContent(blockId, content), page], selection: caret(blockId, start) };
    const before = previousTextBlock(state, blockId, context.closed);
    return { ops: [page, { op: "delete", id: blockId }], selection: caret(before, text.length(getBlock(state, before).content)) };
  }
  if (command.action !== "divider") {
    const ops = changeType(state, blockId, command.action, content);
    const kept = command.action.type === "code" ? text.withoutFormatting(content) : content;
    return { ops, selection: caret(blockId, Math.min(start, text.length(kept))) };
  }
  const divider = context.newId();
  if (replaceable) {
    const paragraph = context.newId();
    return {
      ops: [
        { op: "insert", block: { id: divider, type: "divider" }, parentId: block.parentId!, afterId: blockId },
        { op: "insert", block: { id: paragraph, type: "paragraph" }, parentId: block.parentId!, afterId: divider },
        { op: "delete", id: blockId },
      ],
      selection: caret(paragraph, 0),
    };
  }
  return {
    ops: [
      updateContent(blockId, content),
      { op: "insert", block: { id: divider, type: "divider" }, parentId: block.parentId!, afterId: blockId },
    ],
    selection: caret(blockId, start),
  };
}

// ----- Code -----

/**
 * Tab in code: two spaces at the caret. Shift+Tab (`backward`): removes up to
 * two spaces at the start of the caret's line.
 */
export function indentCode(state: EditorState, selection: Selection, backward: boolean): CommandResult | null {
  const block = getBlock(state, selection.blockId);
  if (block.type !== "code") return null;
  if (!backward) return insertText(state, selection, "  ");
  const value = text.plain(block.content);
  const from = selectionStart(selection);
  const lineStart = from === 0 ? 0 : value.lastIndexOf("\n", from - 1) + 1;
  const spaces = /^ {0,2}/.exec(value.slice(lineStart))![0].length;
  if (spaces === 0) return { ops: [], selection };
  const shift = (offset: number) => (offset <= lineStart ? offset : Math.max(lineStart, offset - spaces));
  return {
    ops: [updateContent(block.id, text.remove(block.content, lineStart, lineStart + spaces))],
    selection: { blockId: block.id, anchor: shift(selection.anchor), focus: shift(selection.focus) },
  };
}

/** Cmd/Ctrl+Enter in code: an empty paragraph after the code block, holding the caret. */
export function exitCode(state: EditorState, selection: Selection, context: CommandContext): CommandResult | null {
  const block = getBlock(state, selection.blockId);
  if (block.type !== "code") return null;
  const id = context.newId();
  return {
    ops: [{ op: "insert", block: { id, type: "paragraph" }, parentId: block.parentId!, afterId: block.id }],
    selection: caret(id, 0),
  };
}

/** Sets a code block's language (empty for plain text). */
export function setCodeLanguage(state: EditorState, id: string, language: string, selection: Selection): CommandResult | null {
  if (getBlock(state, id).type !== "code") return null;
  return { ops: [{ op: "update", id, props: { language: language.trim().slice(0, 32) } }], selection };
}

/** Changes a callout's emoji, tone, or both. */
export function setCalloutStyle(
  state: EditorState,
  id: string,
  style: { emoji?: string; tone?: CalloutTone },
  selection: Selection,
): CommandResult | null {
  if (getBlock(state, id).type !== "callout") return null;
  return { ops: [{ op: "update", id, props: style }], selection };
}
