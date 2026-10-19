import type { BlockType, Operation, RichText, TreeNode } from "~/domain/blocks/types";

import { behaviorOf } from "./block-types";

/** A block as the editor holds it: its data and its children in order. */
export type EditorBlock = {
  id: string;
  type: BlockType;
  props: Record<string, unknown>;
  content: RichText;
  parentId: string | null;
  children: readonly string[];
};

/**
 * The page being edited: its root (whose content is the title) and its own
 * blocks. Sub-pages are blocks without children here; their content is theirs.
 */
export type EditorState = { rootId: string; blocks: Readonly<Record<string, EditorBlock>> };

/** A caret (`anchor === focus`) or text selection inside one block, as plain-text offsets. */
export type Selection = { blockId: string; anchor: number; focus: number };

export const caret = (blockId: string, offset: number): Selection => ({ blockId, anchor: offset, focus: offset });

export const selectionStart = (s: Selection) => Math.min(s.anchor, s.focus);
export const selectionEnd = (s: Selection) => Math.max(s.anchor, s.focus);
export const isCollapsed = (s: Selection) => s.anchor === s.focus;

/** Builds the editor state from a page tree, leaving out the content of sub-pages. */
export function stateFromTree(tree: TreeNode): EditorState {
  const blocks: Record<string, EditorBlock> = {};
  const visit = (node: TreeNode, parentId: string | null, isRoot: boolean) => {
    const { id, type, props, content } = node.block;
    const children = type === "page" && !isRoot ? [] : (node.children ?? []);
    blocks[id] = { id, type, props: { ...props }, content, parentId, children: children.map((c) => c.block.id) };
    for (const child of children) visit(child, id, false);
  };
  visit(tree, null, true);
  return { rootId: tree.block.id, blocks };
}

export function getBlock(state: EditorState, id: string): EditorBlock {
  const block = state.blocks[id];
  if (!block) throw new Error(`Block ${id} is not in the editor`);
  return block;
}

/** The sibling before a block, or `null` when it is first. */
export function previousSibling(state: EditorState, id: string): string | null {
  const { parentId } = getBlock(state, id);
  if (parentId === null) return null;
  const siblings = getBlock(state, parentId).children;
  const index = siblings.indexOf(id);
  return index > 0 ? siblings[index - 1]! : null;
}

export function nextSibling(state: EditorState, id: string): string | null {
  const { parentId } = getBlock(state, id);
  if (parentId === null) return null;
  const siblings = getBlock(state, parentId).children;
  return siblings[siblings.indexOf(id) + 1] ?? null;
}

/**
 * The page's blocks in reading order (depth first), without the root. Children
 * of toggles in `closed` are left out, as they are hidden.
 */
export function documentOrder(state: EditorState, closed: ReadonlySet<string> = new Set()): string[] {
  const out: string[] = [];
  const visit = (id: string) => {
    for (const child of getBlock(state, id).children) {
      out.push(child);
      // A suggestion's proposed blocks aren't part of the text being edited.
      if (!closed.has(child) && getBlock(state, child).type !== "suggestion") visit(child);
    }
  };
  visit(state.rootId);
  return out;
}

/** Blocks that can hold the caret, in reading order, starting with the title (the root). */
export function caretOrder(state: EditorState, closed: ReadonlySet<string> = new Set()): string[] {
  return [state.rootId, ...documentOrder(state, closed).filter((id) => behaviorOf(getBlock(state, id).type).text)];
}

// ----- Applying operations locally, with the server's semantics -----

type MutableBlocks = Record<string, EditorBlock>;

function withChild(blocks: MutableBlocks, parentId: string, childId: string, afterId: string | null) {
  const parent = blocks[parentId]!;
  const children = parent.children.filter((c) => c !== childId);
  const index = afterId === null ? 0 : children.indexOf(afterId) + 1;
  if (afterId !== null && index === 0) throw new Error(`Block ${afterId} is not a child of ${parentId}`);
  children.splice(index, 0, childId);
  blocks[parentId] = { ...parent, children };
}

function withoutChild(blocks: MutableBlocks, parentId: string | null, childId: string) {
  if (parentId === null) return;
  const parent = blocks[parentId]!;
  blocks[parentId] = { ...parent, children: parent.children.filter((c) => c !== childId) };
}

function descendants(blocks: MutableBlocks, id: string): string[] {
  return blocks[id]!.children.flatMap((child) => [child, ...descendants(blocks, child)]);
}

/** Applies a batch to the editor state, as the server would. Throws on operations the editor can't place. */
export function applyOps(state: EditorState, ops: readonly Operation[]): EditorState {
  const blocks: MutableBlocks = { ...state.blocks };
  for (const op of ops) {
    switch (op.op) {
      case "insert": {
        if (!("parentId" in op) || op.parentId === null) throw new Error("The editor only inserts inside the page");
        if (blocks[op.block.id]) throw new Error(`Block ${op.block.id} already exists`);
        if (!blocks[op.parentId]) throw new Error(`Parent ${op.parentId} is not in the editor`);
        blocks[op.block.id] = {
          id: op.block.id,
          type: op.block.type,
          props: { ...op.block.props },
          content: op.block.content ?? [],
          parentId: op.parentId,
          children: [],
        };
        withChild(blocks, op.parentId, op.block.id, op.afterId ?? null);
        break;
      }
      case "update": {
        const block = blocks[op.id];
        if (!block) throw new Error(`Block ${op.id} is not in the editor`);
        const type = op.type ?? block.type;
        const props = type === block.type ? { ...block.props, ...op.props } : { ...op.props };
        blocks[op.id] = { ...block, type, props, content: op.content ?? block.content };
        break;
      }
      case "move": {
        const block = blocks[op.id];
        if (!block || op.parentId === null || !blocks[op.parentId]) throw new Error(`Can't move ${op.id} there`);
        withoutChild(blocks, block.parentId, op.id);
        blocks[op.id] = { ...block, parentId: op.parentId };
        withChild(blocks, op.parentId, op.id, op.afterId ?? null);
        break;
      }
      case "delete": {
        const block = blocks[op.id];
        if (!block) throw new Error(`Block ${op.id} is not in the editor`);
        for (const id of [op.id, ...descendants(blocks, op.id)]) delete blocks[id];
        withoutChild(blocks, block.parentId, op.id);
        break;
      }
    }
  }
  return { ...state, blocks };
}

/** Insert operations that recreate a block and everything under it, at its current place. */
function recreate(state: EditorState, id: string): Operation[] {
  const ops: Operation[] = [];
  const visit = (blockId: string, afterId: string | null) => {
    const { type, props, content, parentId, children } = getBlock(state, blockId);
    ops.push({ op: "insert", block: { id: blockId, type, props, content }, parentId: parentId!, afterId });
    let previous: string | null = null;
    for (const child of children) {
      visit(child, previous);
      previous = child;
    }
  };
  visit(id, previousSibling(state, id));
  return ops;
}

/**
 * The batch that undoes `ops`, computed against the state before them.
 * Each operation's inverse is taken against the state it applied to, and the
 * inverses run in reverse order.
 */
export function invert(state: EditorState, ops: readonly Operation[]): Operation[] {
  const inverses: Operation[][] = [];
  let current = state;
  for (const op of ops) {
    switch (op.op) {
      case "insert":
        inverses.push([{ op: "delete", id: op.block.id }]);
        break;
      case "update": {
        const { type, props, content } = getBlock(current, op.id);
        inverses.push([{ op: "update", id: op.id, type, props, content }]);
        break;
      }
      case "move": {
        const { parentId } = getBlock(current, op.id);
        inverses.push([{ op: "move", id: op.id, parentId, afterId: previousSibling(current, op.id) }]);
        break;
      }
      case "delete":
        inverses.push(recreate(current, op.id));
        break;
    }
    current = applyOps(current, [op]);
  }
  return inverses.reverse().flat();
}
