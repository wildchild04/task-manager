import type { BlockType, RichText } from "~/domain/blocks/types";

/** A block as stored: order is a singly linked list on `prevId`. */
export type BlockRow = {
  id: string;
  type: BlockType;
  parentId: string | null;
  prevId: string | null;
  ownerKind: string | null;
  ownerId: string | null;
  props: Record<string, unknown>;
  content: RichText;
  targetId: string | null;
  createdAt: string;
  updatedAt: string;
};

/**
 * Synchronous row-level storage shared by the repository implementations.
 * The batch applier and tree builder run on top of it, so both
 * implementations order and validate blocks with the same code.
 */
export interface RowStore {
  get(id: string): BlockRow | undefined;
  /** Children of a parent in any order; for `null`, the workspace root pages (never owned roots). */
  childrenOf(parentId: string | null): BlockRow[];
  /** The ordered sibling under `parentId` whose `prevId` is `prevId`. Never an owned root. */
  successorOf(parentId: string | null, prevId: string | null): BlockRow | undefined;
  /** Every descendant of a block, at any depth. */
  descendantIds(id: string): string[];
  /** Descendants of a root, not descending below nested pages (the nested pages themselves are included). */
  treeRows(rootId: string): BlockRow[];
  ownedRoots(kind: string, id: string): BlockRow[];
  referencesTo(targetId: string): BlockRow[];
  /** Rows whose content has a mention of the page. */
  mentioning(pageId: string): BlockRow[];
  insert(row: BlockRow): void;
  update(id: string, patch: Partial<Omit<BlockRow, "id">>): void;
  delete(ids: readonly string[]): void;
}
