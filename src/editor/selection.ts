import type { BlockType, NewBlock, Operation } from "~/domain/blocks/types";

import { behaviorOf } from "./block-types";
import type { CommandResult } from "./commands";
import {
  applyOps,
  type BlockRange,
  caret,
  documentOrder,
  type EditorState,
  getBlock,
  nextSibling,
  previousSibling,
  selectableOf,
  type Selection,
  type TextRange,
} from "./editor-state";
import * as text from "./rich-text";

/**
 * Editing over selections that go beyond one block: text selected across
 * blocks (`TextRange`) and whole selected blocks (the roots of a
 * `BlockRange`, see `selectedRoots`). Every function returns one batch.
 */

/** Sub-pages and suggestions are never deleted or copied by the editor: the server refuses both. */
const isProtected = (type: BlockType) => type === "page" || type === "suggestion";

const canHoldChildren = (state: EditorState, id: string) => id === state.rootId || behaviorOf(getBlock(state, id).type).children;

function subtree(state: EditorState, id: string): string[] {
  return getBlock(state, id).children.flatMap((child) => [child, ...subtree(state, child)]);
}

/** Whether a block is, or contains, a sub-page or a suggestion. */
export function containsProtected(state: EditorState, id: string): boolean {
  return [id, ...subtree(state, id)].some((at) => isProtected(getBlock(state, at).type));
}

/** Move operations putting `ids` under `parentId`, the first after `afterId`, in order. */
function moveAll(ids: readonly string[], parentId: string, afterId: string | null): Operation[] {
  const ops: Operation[] = [];
  let previous = afterId;
  for (const id of ids) {
    ops.push({ op: "move", id, parentId, afterId: previous });
    previous = id;
  }
  return ops;
}

// ----- Text across blocks -----

/**
 * Removes text selected across blocks. The first block keeps its text before
 * the selection and the last block's text after it joins on; the blocks
 * between go, except sub-pages, suggestions and blocks holding them, which
 * stay. Blocks after the selection whose parent goes (the last block's
 * children, the rest of a toggle the selection ended in) move under the first
 * block, or after it when it can't hold children. A table the selection
 * starts or ends in goes whole. The caret ends at the join.
 */
export function replaceRange(state: EditorState, range: TextRange): CommandResult | null {
  const order = documentOrder(state);
  let [start, end] = [range.anchor, range.focus];
  if (order.indexOf(start.blockId) > order.indexOf(end.blockId)) [start, end] = [end, start];
  if (order.indexOf(start.blockId) < 0 || order.indexOf(end.blockId) < 0) return null;

  const startTable = selectableOf(state, start.blockId) !== start.blockId ? selectableOf(state, start.blockId) : null;
  const endTable = selectableOf(state, end.blockId) !== end.blockId ? selectableOf(state, end.blockId) : null;
  const first = startTable ? null : getBlock(state, start.blockId);
  const last = endTable ? null : getBlock(state, end.blockId);
  if (first && last && first.id === last.id) {
    const [from, to] = [Math.min(start.offset, end.offset), Math.max(start.offset, end.offset)];
    return { ops: [{ op: "update", id: first.id, content: text.remove(first.content, from, to) }], selection: caret(first.id, from) };
  }

  // The blocks wholly inside the selection, tables it starts or ends in included.
  const from = startTable ? order.indexOf(startTable) : order.indexOf(start.blockId) + 1;
  const to = endTable ? order.indexOf(endTable) + 1 + subtree(state, endTable).length : order.indexOf(end.blockId);
  const inside = new Set(order.slice(from, to));
  const kept = new Map<string, boolean>();
  const isKept = (id: string): boolean => {
    if (!kept.has(id)) {
      const block = getBlock(state, id);
      kept.set(id, isProtected(block.type) || block.children.some((child) => inside.has(child) && isKept(child)));
    }
    return kept.get(id)!;
  };
  const removed = new Set([...inside].filter((id) => !isKept(id)));
  if (first && last) removed.add(last.id);

  const ops: Operation[] = [];
  if (first) {
    const before = text.slice(first.content, 0, start.offset);
    const after = last ? text.slice(last.content, end.offset) : [];
    const joined = first.type === "code" ? text.withoutFormatting(after) : after;
    ops.push({ op: "update", id: first.id, content: text.concat(before, joined) });
  } else if (last) {
    ops.push({ op: "update", id: last.id, content: text.slice(last.content, end.offset) });
  }

  // Blocks whose parent goes, in reading order, move to the join.
  const survivors = order.filter((id) => !removed.has(id) && removed.has(getBlock(state, id).parentId ?? ""));
  if (survivors.length > 0) {
    let parentId: string;
    let afterId: string | null;
    if (first && canHoldChildren(state, first.id)) [parentId, afterId] = [first.id, null];
    else if (first) [parentId, afterId] = [first.parentId!, first.id];
    else [parentId, afterId] = [getBlock(state, startTable!).parentId!, previousSibling(state, startTable!)];
    // Kept blocks already there come first, as they come first in reading order.
    for (const child of getBlock(state, parentId).children) if (inside.has(child) && isKept(child)) afterId = child;
    ops.push(...moveAll(survivors, parentId, afterId));
  }
  for (const id of order) {
    if (removed.has(id) && !removed.has(getBlock(state, id).parentId ?? "")) ops.push({ op: "delete", id });
  }

  if (first) return { ops, selection: caret(first.id, start.offset) };
  if (last) return { ops, selection: caret(last.id, 0) };
  const before = order.slice(0, order.indexOf(startTable!)).filter((id) => behaviorOf(getBlock(state, id).type).text && !removed.has(id));
  const target = before.at(-1) ?? state.rootId;
  return { ops, selection: caret(target, text.length(getBlock(state, target).content)) };
}

// ----- Whole blocks -----

/**
 * Deletes selected blocks with everything inside them, except those that are
 * or hold a sub-page or suggestion: they stay, selected. The caret goes to the
 * end of the text block before, else the start of the one after, else a new
 * empty paragraph when the page has no blocks left.
 */
export function deleteBlocks(
  state: EditorState,
  roots: readonly string[],
  newId: () => string,
  closed?: ReadonlySet<string>,
): CommandResult | null {
  const doomed = roots.filter((id) => !containsProtected(state, id));
  if (doomed.length === 0) return null;
  const ops: Operation[] = doomed.map((id) => ({ op: "delete", id }));
  const keep = roots.filter((id) => !doomed.includes(id));
  const blocks: BlockRange | undefined = keep.length > 0 ? { anchor: keep[0]!, focus: keep.at(-1)! } : undefined;

  const gone = new Set(doomed.flatMap((id) => [id, ...subtree(state, id)]));
  const order = documentOrder(state, closed);
  const at = order.indexOf(doomed[0]!);
  const isTextLeft = (id: string) => !gone.has(id) && behaviorOf(getBlock(state, id).type).text;
  const before = order.slice(0, at).filter(isTextLeft).at(-1);
  if (before) return { ops, selection: caret(before, text.length(getBlock(state, before).content)), blocks };
  const after = order.slice(at).find(isTextLeft);
  if (after) return { ops, selection: caret(after, 0), blocks };
  if (getBlock(state, state.rootId).children.every((id) => gone.has(id))) {
    const id = newId();
    ops.push({ op: "insert", block: { id, type: "paragraph" }, parentId: state.rootId, afterId: null });
    return { ops, selection: caret(id, 0), blocks };
  }
  return { ops, selection: caret(state.rootId, text.length(getBlock(state, state.rootId).content)), blocks };
}

/** A copy of a block and everything under it with new IDs, leaving out sub-pages and suggestions; `null` for those. */
function copyOf(state: EditorState, id: string, parentId: string, afterId: string | null, newId: () => string): Operation[] | null {
  const { type, props, content, children } = getBlock(state, id);
  if (isProtected(type)) return null;
  const copy: NewBlock = { id: newId(), type, props: { ...props }, content };
  const ops: Operation[] = [{ op: "insert", block: copy, parentId, afterId }];
  let previous: string | null = null;
  for (const child of children) {
    const inner = copyOf(state, child, copy.id, previous, newId);
    if (!inner) continue;
    ops.push(...inner);
    previous = (inner[0] as Extract<Operation, { op: "insert" }>).block.id;
  }
  return ops;
}

/** Duplicates selected blocks right after the last one, at its level; the copies become the selection. */
export function duplicateBlocks(
  state: EditorState,
  roots: readonly string[],
  selection: Selection,
  newId: () => string,
): CommandResult | null {
  if (roots.length === 0) return null;
  const last = getBlock(state, roots.at(-1)!);
  const ops: Operation[] = [];
  const copies: string[] = [];
  for (const id of roots) {
    const copy = copyOf(state, id, last.parentId!, copies.at(-1) ?? last.id, newId);
    if (!copy) continue;
    ops.push(...copy);
    copies.push((copy[0] as Extract<Operation, { op: "insert" }>).block.id);
  }
  if (copies.length === 0) return null;
  return { ops, selection, blocks: { anchor: copies[0]!, focus: copies.at(-1)! } };
}

/** The shared parent of blocks that are consecutive siblings, or `null`. */
function siblingRun(state: EditorState, roots: readonly string[]): string | null {
  if (roots.length === 0) return null;
  const parentId = getBlock(state, roots[0]!).parentId;
  if (parentId === null) return null;
  const children = getBlock(state, parentId).children;
  const at = children.indexOf(roots[0]!);
  return roots.every((id, i) => children[at + i] === id) ? parentId : null;
}

/**
 * Moves blocks (consecutive siblings) up before their previous sibling or down
 * after their next one; from the first or last place they move out to the
 * parent's level, before or after it. Nothing at the page's edges.
 */
export function moveBlocks(state: EditorState, roots: readonly string[], step: -1 | 1): Operation[] | null {
  const parentId = siblingRun(state, roots);
  if (parentId === null) return null;
  const [first, last] = [roots[0]!, roots.at(-1)!];
  const neighbour = step === -1 ? previousSibling(state, first) : nextSibling(state, last);
  if (neighbour !== null) return moveAll(roots, parentId, step === -1 ? previousSibling(state, neighbour) : neighbour);
  const parent = getBlock(state, parentId);
  if (parent.parentId === null || parent.id === state.rootId) return null;
  return moveAll(roots, parent.parentId, step === -1 ? previousSibling(state, parentId) : parentId);
}

/** Where dropped blocks go: under `parentId`, after `afterId` (first when `null`). */
export type DropTarget = { parentId: string; afterId: string | null };

/**
 * Moves blocks to a drop target, in order. Refused into the blocks
 * themselves, into a table or a suggestion, into a block that can't hold
 * children, or when nothing would move.
 */
export function dropBlocks(state: EditorState, roots: readonly string[], target: DropTarget): Operation[] | null {
  if (roots.length === 0 || !state.blocks[target.parentId] || !canHoldChildren(state, target.parentId)) return null;
  for (let at: string | null = target.parentId; at !== null; at = getBlock(state, at).parentId) {
    if (roots.includes(at)) return null;
    const { type } = getBlock(state, at);
    if (type === "suggestion" || type === "table" || type === "table_row" || type === "table_cell") return null;
  }
  // Dropped right after one of the blocks: after the nearest block before it that isn't moving.
  let afterId = target.afterId;
  while (afterId !== null && roots.includes(afterId)) afterId = previousSibling(state, afterId);
  const ops = moveAll(roots, target.parentId, afterId);
  const moved = applyOps(state, ops);
  const unchanged = roots.every(
    (id) => getBlock(moved, id).parentId === getBlock(state, id).parentId && previousSibling(moved, id) === previousSibling(state, id),
  );
  return unchanged ? null : ops;
}

/** Tab over selected blocks: consecutive siblings become the last children of the sibling before them. */
export function nestBlocks(state: EditorState, roots: readonly string[]): Operation[] | null {
  const parentId = siblingRun(state, roots);
  if (parentId === null || getBlock(state, parentId).type === "table_row") return null;
  const previous = previousSibling(state, roots[0]!);
  if (previous === null || !behaviorOf(getBlock(state, previous).type).children) return null;
  return moveAll(roots, previous, getBlock(state, previous).children.at(-1) ?? null);
}

/** Shift+Tab over selected blocks: they move out to follow their parent; the siblings after them become the last one's children. */
export function unnestBlocks(state: EditorState, roots: readonly string[]): Operation[] | null {
  const parentId = siblingRun(state, roots);
  if (parentId === null || parentId === state.rootId) return null;
  const parent = getBlock(state, parentId);
  if (parent.type === "table_row" || parent.parentId === null) return null;
  const last = roots.at(-1)!;
  const followers = parent.children.slice(parent.children.indexOf(last) + 1);
  if (followers.length > 0 && !behaviorOf(getBlock(state, last).type).children) return null;
  return [...moveAll(roots, parent.parentId, parentId), ...moveAll(followers, last, getBlock(state, last).children.at(-1) ?? null)];
}
