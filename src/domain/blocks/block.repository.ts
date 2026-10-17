import type { Batch, Block, Owner, TreeNode } from "./types";

export type ApplyOptions = {
  /** Owner kinds whose protection hooks are skipped. Only the owning domain's service passes this. */
  bypassProtectionFor?: readonly string[];
};

/**
 * Persistence port for blocks. Children always come back as ordered arrays;
 * how order is stored is an implementation detail. Synchronous, like
 * better-sqlite3, so several repositories can share one transaction.
 */
export interface BlockRepository {
  getBlock(id: string): Block | undefined;
  /** Ordered children of a block, or the ordered workspace root pages for `null`. Never owned roots. */
  getChildren(parentId: string | null): Block[];
  /** A `page` or `comment` root and its descendants. Nested pages come back with `children: null`. */
  loadTree(rootId: string): TreeNode | undefined;
  /** Owned roots of an owner entity, oldest first. */
  getOwnedRoots(owner: Owner): Block[];
  /** Reference blocks pointing at a block, including ones whose target no longer exists. */
  listIncomingReferences(targetId: string): Block[];
  /** Applies a batch atomically. Throws `BatchError` and changes nothing if any operation is rejected. */
  apply(batch: Batch, options?: ApplyOptions): void;
}
