import type { BlockService } from "~/domain/blocks/block.service";
import type { Block, TreeNode } from "~/domain/blocks/types";

import type { ContentBlockType, PageView, ReferenceView, ViewBlock } from "../blocks/view-model";

/** How deep references to blocks are expanded inside other references. */
const MAX_REFERENCE_DEPTH = 5;

async function isInWorkspace(blocks: BlockService, block: Block): Promise<boolean> {
  let current: Block | undefined = block;
  while (current && current.parentId !== null) current = await blocks.getBlock(current.parentId);
  return current !== undefined && current.owner === null;
}

/**
 * Builds the read-only view of a workspace page, resolving every reference.
 * Returns `undefined` for unknown IDs, non-page blocks and owned roots.
 */
export async function buildPageView(blocks: BlockService, pageId: string): Promise<PageView | undefined> {
  const page = await blocks.getBlock(pageId);
  if (!page || page.type !== "page" || !(await isInWorkspace(blocks, page))) return undefined;
  const tree = await blocks.loadTree(pageId);
  if (!tree) return undefined;

  const resolve = async (reference: Block, path: string[], depth: number): Promise<ReferenceView> => {
    const resolution = await blocks.resolveReference(reference.id, path);
    if (resolution.status === "missing") return { status: "missing" };
    if (resolution.status === "cycle") return { status: "cycle" };
    const { target } = resolution;
    if (target.type === "page") return { status: "page", pageId: target.id, title: target.content };
    if (depth >= MAX_REFERENCE_DEPTH) return { status: "cycle" };
    return { status: "block", block: await viewOfBlock(target, [...path, target.id], depth + 1) };
  };

  // A referenced block is not loaded as part of the page tree, so its children are fetched here.
  const viewOfBlock = async (block: Block, path: string[], depth: number): Promise<ViewBlock> => {
    const children = block.type === "page" ? [] : await blocks.getChildren(block.id);
    return viewOf(block, await Promise.all(children.map((child) => viewOfBlock(child, path, depth))), path, depth);
  };

  const viewOfNode = async (node: TreeNode, path: string[], depth: number): Promise<ViewBlock> =>
    viewOf(node.block, await Promise.all((node.children ?? []).map((child) => viewOfNode(child, path, depth))), path, depth);

  const viewOf = async (block: Block, children: ViewBlock[], path: string[], depth: number): Promise<ViewBlock> => {
    switch (block.type) {
      case "page":
        return { kind: "subpage", id: block.id, title: block.content };
      case "reference":
        return { kind: "reference", id: block.id, target: await resolve(block, path, depth) };
      case "comment":
        throw new Error(`Comment block ${block.id} cannot appear in a page`);
      default:
        return {
          kind: "content",
          id: block.id,
          type: block.type as ContentBlockType,
          props: block.props,
          content: block.content,
          children,
        };
    }
  };

  return {
    id: page.id,
    title: page.content,
    blocks: await Promise.all((tree.children ?? []).map((node) => viewOfNode(node, [], 0))),
  };
}
