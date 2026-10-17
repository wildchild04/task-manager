import { OrderIntegrityError } from "~/domain/blocks/errors";
import type { Block, TreeNode } from "~/domain/blocks/types";

import type { BlockRow, RowStore } from "./row-store";

export function rowToBlock(row: BlockRow): Block {
  return {
    id: row.id,
    type: row.type,
    props: row.props,
    content: row.content,
    parentId: row.parentId,
    owner: row.ownerKind !== null && row.ownerId !== null ? { kind: row.ownerKind, id: row.ownerId } : null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  } as Block;
}

/**
 * Orders one parent's children by walking the linked list from its head.
 * Fails if a child is unreachable, two children claim the same position, or
 * the list has no head.
 */
export function orderSiblings(parentId: string | null, rows: readonly BlockRow[]): BlockRow[] {
  if (rows.length === 0) return [];
  const byPrev = new Map<string | null, BlockRow>();
  for (const row of rows) {
    if (byPrev.has(row.prevId)) {
      throw new OrderIntegrityError(parentId, `two children follow ${row.prevId ?? "the head"}`);
    }
    byPrev.set(row.prevId, row);
  }
  const ordered: BlockRow[] = [];
  const seen = new Set<string>();
  let current = byPrev.get(null);
  if (!current) throw new OrderIntegrityError(parentId, "no first child");
  while (current) {
    if (seen.has(current.id)) throw new OrderIntegrityError(parentId, `order loops at ${current.id}`);
    seen.add(current.id);
    ordered.push(current);
    current = byPrev.get(current.id);
  }
  if (ordered.length !== rows.length) {
    throw new OrderIntegrityError(parentId, `${rows.length - ordered.length} children are unreachable`);
  }
  return ordered;
}

export function orderedChildren(store: RowStore, parentId: string | null): Block[] {
  return orderSiblings(parentId, store.childrenOf(parentId)).map(rowToBlock);
}

/** Loads a page or comment root as a tree. Nested pages are leaves with `children: null`. */
export function buildTree(store: RowStore, rootId: string): TreeNode | undefined {
  const root = store.get(rootId);
  if (!root || (root.type !== "page" && root.type !== "comment")) return undefined;

  const byParent = new Map<string, BlockRow[]>();
  for (const row of store.treeRows(rootId)) {
    if (row.parentId === null) continue;
    const group = byParent.get(row.parentId);
    if (group) group.push(row);
    else byParent.set(row.parentId, [row]);
  }

  const build = (row: BlockRow, isRoot: boolean): TreeNode => {
    if (!isRoot && row.type === "page") return { block: rowToBlock(row), children: null };
    const children = orderSiblings(row.id, byParent.get(row.id) ?? []);
    return { block: rowToBlock(row), children: children.map((child) => build(child, false)) };
  };
  return build(root, true);
}
