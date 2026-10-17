import type { ApplyOptions, BlockRepository } from "./block.repository";
import type { ReferenceResolution } from "./references";
import { resolveReference } from "./references";
import type { Batch, Block, Owner, TreeNode } from "./types";

export class BlockService {
  constructor(private readonly blocks: BlockRepository) {}

  apply(batch: Batch, options?: ApplyOptions): void {
    this.blocks.apply(batch, options);
  }

  getBlock(id: string): Block | undefined {
    return this.blocks.getBlock(id);
  }

  getChildren(parentId: string): Block[] {
    return this.blocks.getChildren(parentId);
  }

  listRootPages(): Block[] {
    return this.blocks.getChildren(null);
  }

  loadTree(rootId: string): TreeNode | undefined {
    return this.blocks.loadTree(rootId);
  }

  getOwnedRoots(owner: Owner): Block[] {
    return this.blocks.getOwnedRoots(owner);
  }

  listIncomingReferences(targetId: string): Block[] {
    return this.blocks.listIncomingReferences(targetId);
  }

  /** The root of a block's tree: a workspace root page or an owned root. */
  rootOf(id: string): Block | undefined {
    let current = this.blocks.getBlock(id);
    while (current && current.parentId !== null) current = this.blocks.getBlock(current.parentId);
    return current;
  }

  resolveReference(referenceId: string, expansionPath: readonly string[]): ReferenceResolution {
    const reference = this.blocks.getBlock(referenceId);
    if (!reference) throw new Error(`Block ${referenceId} does not exist`);
    return resolveReference(reference, expansionPath, (id) => this.blocks.getBlock(id));
  }
}
