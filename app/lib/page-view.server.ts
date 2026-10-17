import type { BlockService } from "~/domain/blocks/block.service";
import type { Block, TreeNode } from "~/domain/blocks/types";
import { PROJECT_OWNER_KIND } from "~/domain/projects/types";

import type { ContentBlockType, PageView, ReferenceView, ViewBlock } from "../blocks/view-model";

/** How deep references to blocks are expanded inside other references. */
const MAX_REFERENCE_DEPTH = 5;

/**
 * Which pages `/pages/:pageId` may open: workspace pages, and a project's home
 * page and library documents. Task bodies and comments are shown elsewhere.
 */
function browsableScope(blocks: BlockService, block: Block): { projectId?: string } | undefined {
  const owner = blocks.rootOf(block.id)?.owner;
  if (owner === null) return {};
  if (owner?.kind === PROJECT_OWNER_KIND) return { projectId: owner.id };
  return undefined;
}

/**
 * Builds the read-only view of a browsable page, resolving every reference.
 * Returns `undefined` for unknown IDs, non-page blocks, and pages owned by
 * anything but a project (task bodies, comments).
 */
export function buildPageView(blocks: BlockService, pageId: string): PageView | undefined {
  const page = blocks.getBlock(pageId);
  if (!page || page.type !== "page") return undefined;
  const scope = browsableScope(blocks, page);
  if (!scope) return undefined;
  const view = buildTreeView(blocks, page);
  return view && { ...view, ...scope };
}

/** Builds the view of any page, without checking who owns it (for a task's body on its overview). */
export function buildBodyView(blocks: BlockService, pageId: string): PageView | undefined {
  const page = blocks.getBlock(pageId);
  return page?.type === "page" ? buildTreeView(blocks, page) : undefined;
}

function buildTreeView(blocks: BlockService, page: Block): PageView | undefined {
  const children = buildChildrenView(blocks, page.id);
  return children && { id: page.id, title: page.content, blocks: children };
}

/** A comment's content, rendered like page content. */
export function buildCommentView(blocks: BlockService, bodyBlockId: string): ViewBlock[] {
  return buildChildrenView(blocks, bodyBlockId) ?? [];
}

/** The views of a root's children, with every reference resolved. */
function buildChildrenView(blocks: BlockService, rootId: string): ViewBlock[] | undefined {
  const tree = blocks.loadTree(rootId);
  if (!tree) return undefined;

  const resolve = (reference: Block, path: string[], depth: number): ReferenceView => {
    const resolution = blocks.resolveReference(reference.id, path);
    if (resolution.status === "missing") return { status: "missing" };
    if (resolution.status === "cycle") return { status: "cycle" };
    const { target } = resolution;
    if (target.type === "page") return { status: "page", pageId: target.id, title: target.content };
    if (depth >= MAX_REFERENCE_DEPTH) return { status: "cycle" };
    return { status: "block", block: viewOfBlock(target, [...path, target.id], depth + 1) };
  };

  // A referenced block is not loaded as part of the page tree, so its children are fetched here.
  const viewOfBlock = (block: Block, path: string[], depth: number): ViewBlock => {
    const children = block.type === "page" ? [] : blocks.getChildren(block.id);
    return viewOf(block, children.map((child) => viewOfBlock(child, path, depth)), path, depth);
  };

  const viewOfNode = (node: TreeNode, path: string[], depth: number): ViewBlock =>
    viewOf(node.block, (node.children ?? []).map((child) => viewOfNode(child, path, depth)), path, depth);

  const viewOf = (block: Block, children: ViewBlock[], path: string[], depth: number): ViewBlock => {
    switch (block.type) {
      case "page":
        return { kind: "subpage", id: block.id, title: block.content };
      case "reference":
        return { kind: "reference", id: block.id, target: resolve(block, path, depth) };
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

  return (tree.children ?? []).map((node) => viewOfNode(node, [], 0));
}
