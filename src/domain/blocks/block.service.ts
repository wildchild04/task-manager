import type { ApplyOptions, BlockRepository } from "./block.repository";
import type { ReferenceResolution } from "./references";
import { resolveReference } from "./references";
import type { Batch, Block, Owner, TreeNode } from "./types";

export class BlockService {
  constructor(private readonly blocks: BlockRepository) {}

  apply(batch: Batch, options?: ApplyOptions): Promise<void> {
    return this.blocks.apply(batch, options);
  }

  getBlock(id: string): Promise<Block | undefined> {
    return this.blocks.getBlock(id);
  }

  getChildren(parentId: string): Promise<Block[]> {
    return this.blocks.getChildren(parentId);
  }

  listRootPages(): Promise<Block[]> {
    return this.blocks.getChildren(null);
  }

  loadTree(rootId: string): Promise<TreeNode | undefined> {
    return this.blocks.loadTree(rootId);
  }

  getOwnedRoots(owner: Owner): Promise<Block[]> {
    return this.blocks.getOwnedRoots(owner);
  }

  listIncomingReferences(targetId: string): Promise<Block[]> {
    return this.blocks.listIncomingReferences(targetId);
  }

  async resolveReference(referenceId: string, expansionPath: readonly string[]): Promise<ReferenceResolution> {
    const reference = await this.blocks.getBlock(referenceId);
    if (!reference) throw new Error(`Block ${referenceId} does not exist`);
    return resolveReference(reference, expansionPath, (id) => this.blocks.getBlock(id));
  }
}
