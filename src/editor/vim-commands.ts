import type { NewBlock, Operation, RichText, TreeNode } from "~/domain/blocks/types";

import { behaviorOf } from "./block-types";
import { type CommandContext, type CommandResult, newBlockAfter } from "./commands";
import { caret, type EditorState, getBlock, previousSibling, type Selection } from "./editor-state";
import * as text from "./rich-text";

/**
 * The edits Vim mode's operators make that the editor has no command for.
 * Each returns one batch, applied as one undo step (`Editor.runCommand`).
 */

const updateContent = (id: string, content: RichText): Operation => ({ op: "update", id, content });

/** Removes the text from `from` to `to` in a block; the caret goes to `from`. */
export function deleteText(state: EditorState, id: string, from: number, to: number): CommandResult | null {
  if (to <= from) return null;
  const block = getBlock(state, id);
  return { ops: [updateContent(id, text.remove(block.content, from, to))], selection: caret(id, from) };
}

/** Inserts formatted text at `at` in a block; the caret goes to the end of what was inserted. */
export function insertContent(state: EditorState, id: string, at: number, inserted: RichText): CommandResult {
  const block = getBlock(state, id);
  const content = text.concat(text.slice(block.content, 0, at), inserted, text.slice(block.content, at));
  return { ops: [updateContent(id, content)], selection: caret(id, at + text.length(inserted)) };
}

/**
 * `o` and `O`: a new empty block after or before a text block, of the type
 * Enter would give it (a list item after a list item, an unchecked to-do after
 * a to-do), with the caret in it. In code, a new line instead; in a table cell,
 * nothing.
 */
export function openLine(
  state: EditorState,
  id: string,
  side: "after" | "before",
  context: CommandContext,
  /** In code: where the cursor's line starts and ends. */
  line?: { start: number; end: number },
): CommandResult | null {
  const block = getBlock(state, id);
  const rule = behaviorOf(block.type).enter;
  if (rule === "cell-below") return null;
  if (rule === "line-break") {
    const at = side === "after" ? (line?.end ?? text.length(block.content)) : (line?.start ?? 0);
    const result = insertContent(state, id, at, [{ text: "\n" }]);
    return side === "after" ? result : { ...result, selection: caret(id, at) };
  }
  const created = newBlockAfter(state, id, context.newId(), []);
  // An open toggle's next line is its first child, as with Enter.
  if (side === "after" && rule === "first-child-when-open" && !context.closed?.has(id)) {
    return {
      ops: [{ op: "insert", block: { ...created, type: "paragraph" }, parentId: id, afterId: null }],
      selection: caret(created.id, 0),
    };
  }
  const afterId = side === "after" ? id : previousSibling(state, id);
  return { ops: [{ op: "insert", block: created, parentId: block.parentId!, afterId }], selection: caret(created.id, 0) };
}

/** A copy of a tree with new IDs, leaving out sub-pages and suggestions (`null` for those). */
function copyOf(node: TreeNode, parentId: string, afterId: string | null, newId: () => string): Operation[] | null {
  const { type, props, content } = node.block;
  if (type === "page" || type === "suggestion") return null;
  const copy: NewBlock = { id: newId(), type, props: { ...props }, content } as NewBlock;
  const ops: Operation[] = [{ op: "insert", block: copy, parentId, afterId }];
  let previous: string | null = null;
  for (const child of node.children ?? []) {
    const inner = copyOf(child, copy.id, previous, newId);
    if (!inner) continue;
    ops.push(...inner);
    previous = (inner[0] as Extract<Operation, { op: "insert" }>).block.id;
  }
  return ops;
}

/**
 * `p` and `P` with blocks in the register: copies of them after or before the
 * block `id`, at its level. The caret goes to the first text block pasted (a
 * table's first cell), or stays at `fallback` when none holds text.
 */
export function pasteTrees(
  state: EditorState,
  id: string,
  side: "after" | "before",
  trees: readonly TreeNode[],
  newId: () => string,
  fallback: Selection,
): CommandResult | null {
  const block = getBlock(state, id);
  const ops: Operation[] = [];
  let afterId = side === "after" ? id : previousSibling(state, id);
  for (const tree of trees) {
    const copy = copyOf(tree, block.parentId!, afterId, newId);
    if (!copy) continue;
    ops.push(...copy);
    afterId = (copy[0] as Extract<Operation, { op: "insert" }>).block.id;
  }
  if (ops.length === 0) return null;
  const first = ops.find((op) => op.op === "insert" && behaviorOf(op.block.type).text) as Extract<Operation, { op: "insert" }> | undefined;
  return { ops, selection: first ? caret(first.block.id, 0) : fallback };
}
