import { z } from "zod";

import { richTextSchema } from "./schema";
import type { Batch, TreeNode } from "./types";

const newBlockSchema = z
  .object({
    id: z.string().min(1),
    type: z.string(),
    props: z.record(z.string(), z.unknown()).optional(),
    content: richTextSchema.optional(),
  })
  .strict();

/** The shape of an edit batch sent by the editor. Types, props and placement are checked when it is applied. */
export const editBatchSchema = z.array(
  z.discriminatedUnion("op", [
    z.object({ op: z.literal("insert"), block: newBlockSchema, parentId: z.string().min(1), afterId: z.string().nullable().optional() }).strict(),
    z
      .object({
        op: z.literal("update"),
        id: z.string().min(1),
        type: z.string().optional(),
        props: z.record(z.string(), z.unknown()).optional(),
        content: richTextSchema.optional(),
      })
      .strict(),
    z.object({ op: z.literal("move"), id: z.string().min(1), parentId: z.string().min(1), afterId: z.string().nullable().optional() }).strict(),
    z.object({ op: z.literal("delete"), id: z.string().min(1) }).strict(),
  ]),
);

export type PageEditOptions = {
  /** Whether the page's title (the root's content) may change. */
  title?: boolean;
};

/**
 * Checks that an edit batch stays inside one page's own content: the root and
 * the blocks under it, but not inside sub-pages. Sub-pages can be moved
 * within the page but never deleted (also not along with a block containing
 * one), retyped or retitled from here; no page or comment blocks are created;
 * the root only changes its title, when allowed. Returns the reason a batch
 * is refused, or `undefined` when it may be applied.
 */
export function checkPageEdit(tree: TreeNode, batch: Batch, options: PageEditOptions = {}): string | undefined {
  const rootId = tree.block.id;
  const parent = new Map<string, string | null>();
  const type = new Map<string, string>();
  const visit = (node: TreeNode, parentId: string | null) => {
    parent.set(node.block.id, parentId);
    type.set(node.block.id, node.block.type);
    // A sub-page's content belongs to that page (and isn't loaded with this tree).
    if (node.block.type === "page" && node.block.id !== rootId) return;
    for (const child of node.children ?? []) visit(child, node.block.id);
  };
  visit(tree, null);

  const isSubPage = (id: string) => id !== rootId && type.get(id) === "page";
  const canHoldChildren = (id: string) => parent.has(id) && !isSubPage(id);
  const containsSubPage = (id: string): boolean =>
    isSubPage(id) || [...parent].some(([child, p]) => p === id && containsSubPage(child));

  for (const op of batch) {
    switch (op.op) {
      case "insert": {
        if (!("parentId" in op) || op.parentId === null || !canHoldChildren(op.parentId)) return "Edits must stay inside the page";
        if (op.block.type === "page" || op.block.type === "comment") return `A ${op.block.type} block can't be created here`;
        if (parent.has(op.block.id)) return `Block ${op.block.id} already exists`;
        parent.set(op.block.id, op.parentId);
        type.set(op.block.id, op.block.type);
        break;
      }
      case "update": {
        if (!parent.has(op.id)) return "Edits must stay inside the page";
        if (op.id === rootId) {
          if (!options.title) return "This page's title can't be changed here";
          if (op.type !== undefined || op.props !== undefined) return "Only the page's title can change";
          break;
        }
        if (isSubPage(op.id)) return "A sub-page is edited on its own page";
        if (op.type === "page" || op.type === "comment") return `A block can't be turned into a ${op.type}`;
        if (op.type !== undefined) type.set(op.id, op.type);
        break;
      }
      case "move": {
        if (!parent.has(op.id) || op.id === rootId) return "Edits must stay inside the page";
        if (op.parentId === null || !canHoldChildren(op.parentId)) return "Edits must stay inside the page";
        parent.set(op.id, op.parentId);
        break;
      }
      case "delete": {
        if (!parent.has(op.id) || op.id === rootId) return "Edits must stay inside the page";
        if (containsSubPage(op.id)) return "Sub-pages can't be deleted by editing; delete the page itself";
        const removed = new Set([op.id]);
        let grew = true;
        while (grew) {
          grew = false;
          for (const [child, p] of parent) {
            if (p !== null && removed.has(p) && !removed.has(child)) {
              removed.add(child);
              grew = true;
            }
          }
        }
        for (const id of removed) parent.delete(id);
        break;
      }
    }
  }
  return undefined;
}

/**
 * Identifies a tree's state, to tell whether a page changed since it was
 * loaded: its latest change and its number of blocks (a deletion changes no
 * remaining block's time).
 */
export function treeVersion(tree: TreeNode): string {
  let latest = tree.block.updatedAt;
  let count = 0;
  const visit = (node: TreeNode) => {
    count += 1;
    if (node.block.updatedAt > latest) latest = node.block.updatedAt;
    node.children?.forEach(visit);
  };
  visit(tree);
  return `${latest}/${count}`;
}
