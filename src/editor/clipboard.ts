import type { MarkdownBlock } from "~/domain/blocks/markdown";
import type { Block, Operation, RichText, TreeNode } from "~/domain/blocks/types";

import { behaviorOf } from "./block-types";
import type { CommandResult } from "./commands";
import {
  caret,
  documentOrder,
  type EditorBlock,
  type EditorState,
  getBlock,
  type Selection,
  selectionEnd,
  selectionStart,
} from "./editor-state";
import * as text from "./rich-text";

const isText = (type: string) => behaviorOf(type as Block["type"]).text;

/** Insert operations for pasted blocks under `parentId`, the first after `afterId`, with their nesting. */
function insertOps(blocks: readonly MarkdownBlock[], parentId: string, afterId: string | null): Operation[] {
  const ops: Operation[] = [];
  let previous = afterId;
  for (const { children, ...block } of blocks) {
    ops.push({ op: "insert", block, parentId, afterId: previous });
    if (children?.length) ops.push(...insertOps(children, block.id, null));
    previous = block.id;
  }
  return ops;
}

/** The last text block among pasted blocks, looking inside the last one first, and its text's length. */
function lastText(blocks: readonly MarkdownBlock[]): { id: string; length: number } | null {
  for (const block of [...blocks].reverse()) {
    const inner = block.children?.length ? lastText(block.children) : null;
    if (inner) return inner;
    if (isText(block.type)) return { id: block.id, length: text.length(block.content ?? []) };
  }
  return null;
}

/**
 * Pastes blocks at the selection, which is first cleared. One paragraph is
 * inserted at the caret with its marks. Otherwise an empty paragraph is
 * replaced by the blocks; any other block is split at the caret, its text
 * before the caret joined by the first pasted paragraph, the other blocks
 * following it, and its text after the caret following them as a paragraph.
 * Returns `null` where blocks can't be pasted (code, table cells, the title):
 * there the caller types plain text.
 */
export function pasteBlocks(
  state: EditorState,
  selection: Selection,
  blocks: readonly MarkdownBlock[],
  newId: () => string,
): CommandResult | null {
  const block = getBlock(state, selection.blockId);
  if (block.id === state.rootId || block.type === "code" || block.type === "table_cell" || !isText(block.type)) return null;
  if (blocks.length === 0) return null;

  const start = selectionStart(selection);
  const content = text.remove(block.content, start, selectionEnd(selection));
  const before = text.slice(content, 0, start);
  const after = text.slice(content, start);
  const first = blocks[0]!;
  const joinsFirst = first.type === "paragraph" && !first.children?.length;

  // One paragraph: typed in at the caret, formatting and all.
  if (blocks.length === 1 && joinsFirst) {
    const pasted = first.content ?? [];
    return {
      ops: [{ op: "update", id: block.id, content: text.concat(before, pasted, after) }],
      selection: caret(block.id, start + text.length(pasted)),
    };
  }

  // An empty paragraph makes way for the pasted blocks.
  if (block.type === "paragraph" && text.length(content) === 0 && block.children.length === 0) {
    const siblings = getBlock(state, block.parentId!).children;
    const previous = siblings[siblings.indexOf(block.id) - 1] ?? null;
    const end = lastText(blocks);
    return {
      ops: [...insertOps(blocks, block.parentId!, previous), { op: "delete", id: block.id }],
      selection: end ? caret(end.id, end.length) : caret(blocks[0]!.id, 0),
    };
  }

  const joined: RichText = joinsFirst ? text.concat(before, first.content ?? []) : before;
  const rest = joinsFirst ? blocks.slice(1) : blocks;
  const ops: Operation[] = [{ op: "update", id: block.id, content: joined }, ...insertOps(rest, block.parentId!, block.id)];
  let end = lastText(rest) ?? { id: block.id, length: text.length(joined) };
  if (text.length(after) > 0) {
    const tail = newId();
    ops.push({
      op: "insert",
      block: { id: tail, type: "paragraph", content: after },
      parentId: block.parentId!,
      afterId: rest.at(-1)?.id ?? block.id,
    });
    if (rest.length === 0) end = { id: block.id, length: text.length(joined) };
  }
  return { ops, selection: caret(end.id, end.length) };
}

/** A point in the editor: a block and an offset in its text. */
export type Point = { blockId: string; offset: number };

const asBlock = (block: EditorBlock, content: RichText = block.content): Block =>
  ({
    id: block.id,
    type: block.type,
    props: block.props,
    content,
    parentId: block.parentId,
    owner: null,
    createdAt: "",
    updatedAt: "",
  }) as Block;

/**
 * The blocks between two points, in document order, as trees for Markdown:
 * the first and last text blocks cut to the selected text, tables and code
 * whole (a selection reaching into a table takes the table), and every
 * included block with its children.
 */
export function selectedTrees(state: EditorState, from: Point, to: Point): TreeNode[] {
  const order = documentOrder(state);
  let [start, end] = [from, to];
  if (order.indexOf(start.blockId) > order.indexOf(end.blockId)) [start, end] = [end, start];
  const tableOf = (id: string) => {
    for (let at: EditorBlock | undefined = getBlock(state, id); at; at = at.parentId ? state.blocks[at.parentId] : undefined) {
      if (at.type === "table") return at.id;
    }
    return id;
  };

  // The blocks in the range, each with its descendants; parts of a table stand for the table.
  const included = new Set<string>();
  const add = (id: string) => {
    if (included.has(id)) return;
    included.add(id);
    getBlock(state, id).children.forEach(add);
  };
  for (const id of order.slice(order.indexOf(start.blockId), order.indexOf(end.blockId) + 1)) add(tableOf(id));

  const cut = (block: EditorBlock): RichText => {
    if (!isText(block.type) || block.type === "code" || tableOf(block.id) !== block.id) return block.content;
    const from = block.id === start.blockId ? start.offset : 0;
    const to = block.id === end.blockId ? end.offset : Infinity;
    return text.slice(block.content, from, to);
  };
  const tree = (id: string): TreeNode => {
    const block = getBlock(state, id);
    return { block: asBlock(block, cut(block)), children: block.children.filter((child) => included.has(child)).map(tree) };
  };
  return [...included].filter((id) => !included.has(getBlock(state, id).parentId ?? "")).map(tree);
}
