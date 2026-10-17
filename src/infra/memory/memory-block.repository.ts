import type { ApplyOptions, BlockRepository } from "~/domain/blocks/block.repository";
import type { Batch, Block, Owner, TreeNode } from "~/domain/blocks/types";
import type { ProtectionHooks } from "~/domain/blocks/validate";
import { applyBatch } from "~/infra/shared/apply-batch";
import type { BlockRow, RowStore } from "~/infra/shared/row-store";
import { buildTree, orderedChildren, rowToBlock } from "~/infra/shared/rows";

class MapRowStore implements RowStore {
  constructor(readonly rows: Map<string, BlockRow>) {}

  get(id: string) {
    return this.rows.get(id);
  }

  childrenOf(parentId: string | null) {
    return [...this.rows.values()].filter((row) => row.parentId === parentId && row.ownerKind === null);
  }

  successorOf(parentId: string | null, prevId: string | null) {
    return this.childrenOf(parentId).find((row) => row.prevId === prevId);
  }

  descendantIds(id: string) {
    const result: string[] = [];
    const visit = (parentId: string) => {
      for (const row of this.childrenOf(parentId)) {
        result.push(row.id);
        visit(row.id);
      }
    };
    visit(id);
    return result;
  }

  treeRows(rootId: string) {
    const result: BlockRow[] = [];
    const visit = (parentId: string) => {
      for (const row of this.childrenOf(parentId)) {
        result.push(row);
        if (row.type !== "page") visit(row.id);
      }
    };
    visit(rootId);
    return result;
  }

  ownedRoots(kind: string, id: string) {
    return [...this.rows.values()]
      .filter((row) => row.ownerKind === kind && row.ownerId === id)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  referencesTo(targetId: string) {
    return [...this.rows.values()].filter((row) => row.targetId === targetId);
  }

  // Rows are replaced, never mutated, so a copied map is an independent snapshot.
  insert(row: BlockRow) {
    this.rows.set(row.id, row);
  }

  update(id: string, patch: Partial<Omit<BlockRow, "id">>) {
    const row = this.rows.get(id);
    if (row) this.rows.set(id, { ...row, ...patch });
  }

  delete(ids: readonly string[]) {
    for (const id of ids) this.rows.delete(id);
  }
}

export class MemoryBlockRepository implements BlockRepository {
  private rows = new Map<string, BlockRow>();

  constructor(private readonly hooks: ProtectionHooks = {}) {}

  private get store() {
    return new MapRowStore(this.rows);
  }

  async getBlock(id: string): Promise<Block | undefined> {
    const row = this.rows.get(id);
    return row ? rowToBlock(row) : undefined;
  }

  async getChildren(parentId: string | null): Promise<Block[]> {
    return orderedChildren(this.store, parentId);
  }

  async loadTree(rootId: string): Promise<TreeNode | undefined> {
    return buildTree(this.store, rootId);
  }

  async getOwnedRoots(owner: Owner): Promise<Block[]> {
    return this.store.ownedRoots(owner.kind, owner.id).map(rowToBlock);
  }

  async listIncomingReferences(targetId: string): Promise<Block[]> {
    return this.store.referencesTo(targetId).map(rowToBlock);
  }

  async apply(batch: Batch, options?: ApplyOptions): Promise<void> {
    const working = new MapRowStore(new Map(this.rows));
    applyBatch(working, batch, this.hooks, options);
    this.rows = working.rows;
  }

  /** Test hook: rewrites a row's stored order pointer without validation. */
  corruptOrder(id: string, prevId: string | null): void {
    this.store.update(id, { prevId });
  }
}
