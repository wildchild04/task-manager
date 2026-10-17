import type { Batch } from "./types";

/**
 * Whether every operation of a batch stays inside a tree whose existing block
 * IDs are `treeIds`. Blocks the batch inserts under the tree count as inside
 * for later operations. Used by services that let callers edit one owned tree
 * (a task's body page, a comment) and nothing else.
 */
export function batchStaysWithin(treeIds: ReadonlySet<string>, batch: Batch): boolean {
  const inside = new Set(treeIds);
  for (const op of batch) {
    switch (op.op) {
      case "insert":
        if (!("parentId" in op) || op.parentId === null || !inside.has(op.parentId)) return false;
        inside.add(op.block.id);
        break;
      case "update":
      case "delete":
        if (!inside.has(op.id)) return false;
        break;
      case "move":
        if (!inside.has(op.id) || op.parentId === null || !inside.has(op.parentId)) return false;
        break;
    }
  }
  return true;
}
