import type { AppServices } from "~/composition";
import { BatchError } from "~/domain/blocks/errors";
import { checkPageEdit, editBatchSchema, treeVersion } from "~/domain/blocks/page-edit";
import { plainText } from "~/domain/blocks/text";
import type { Batch, TreeNode } from "~/domain/blocks/types";
import { PROJECT_OWNER_KIND } from "~/domain/projects/types";

import type { MentionTitles, ReferenceView, ViewBlock } from "../blocks/view-model";
import { browsableScope, buildBodyView } from "./page-view.server";

/** Where an editor runs: a page, a project's home page, or a task's body. */
export type EditSurface = "page" | "project" | "task";

/** What the editor of one page starts from. Plain data, sent by loaders. */
export type EditablePage = {
  surface: EditSurface;
  /** The page's own ID for `page`, the project's or the task's ID otherwise. */
  id: string;
  /** The page's own content; sub-pages come without theirs. */
  tree: TreeNode;
  version: string;
  /** Whether the title is edited here (not for a project's home page). */
  title: boolean;
  /** How each reference block resolves, as the read-only view shows it. */
  references: Record<string, ReferenceView>;
  /** The current titles of the pages mentioned in the page (`null` for deleted ones). */
  mentions: MentionTitles;
};

type EditTarget = { rootId: string; title: boolean };

function editTarget(services: AppServices, surface: EditSurface, id: string): EditTarget | undefined {
  switch (surface) {
    case "page": {
      const page = services.blocks.getBlock(id);
      if (page?.type !== "page" || !browsableScope(services.blocks, page)) return undefined;
      // A project's home page and library root are titled by the project.
      return { rootId: id, title: page.owner === null };
    }
    case "project": {
      const project = services.projects.get(id);
      return project && { rootId: project.homePageId, title: false };
    }
    case "task": {
      const task = services.tasks.get(id);
      return task && { rootId: task.bodyPageId, title: true };
    }
  }
}

function referencesOf(blocks: readonly ViewBlock[], into: Record<string, ReferenceView> = {}) {
  for (const block of blocks) {
    if (block.kind === "reference") into[block.id] = block.target;
    if (block.kind === "content") referencesOf(block.children, into);
  }
  return into;
}

/** The editor's starting point for a surface, or `undefined` if it can't be edited. */
export function editablePage(services: AppServices, surface: EditSurface, id: string): EditablePage | undefined {
  const target = editTarget(services, surface, id);
  const tree = target && services.blocks.loadTree(target.rootId);
  if (!target || !tree) return undefined;
  const view = buildBodyView(services.blocks, target.rootId);
  return {
    surface,
    id,
    tree,
    version: treeVersion(tree),
    title: target.title,
    references: referencesOf(view?.blocks ?? []),
    mentions: view?.mentions ?? {},
  };
}

export type EditResult = { ok: true; version: string } | { ok: false; message: string };

const surfaces: readonly string[] = ["page", "project", "task"];

/**
 * Applies an editor batch to the page of a surface, after checking that it
 * stays inside that page's own content. Nothing changes when it's refused.
 */
export function applyEdit(services: AppServices, body: unknown): EditResult {
  const input = body as { surface?: unknown; id?: unknown; batch?: unknown } | null;
  if (typeof input?.surface !== "string" || !surfaces.includes(input.surface) || typeof input.id !== "string") {
    return { ok: false, message: "Unknown page" };
  }
  const target = editTarget(services, input.surface as EditSurface, input.id);
  const tree = target && services.blocks.loadTree(target.rootId);
  if (!target || !tree) return { ok: false, message: "This page no longer exists" };

  const parsed = editBatchSchema.safeParse(input.batch);
  if (!parsed.success) return { ok: false, message: "The edit couldn't be read" };
  const batch = parsed.data as Batch;
  const refusal = checkPageEdit(tree, batch, { title: target.title });
  if (refusal) return { ok: false, message: refusal };

  try {
    services.blocks.apply(batch);
  } catch (error) {
    if (error instanceof BatchError) return { ok: false, message: error.error.message };
    throw error;
  }
  return { ok: true, version: treeVersion(services.blocks.loadTree(target.rootId)!) };
}

// ----- Deleting pages -----

export type PageDeletion = {
  id: string;
  title: string;
  /** Pages inside it, at any depth, deleted along with it. */
  nestedPages: number;
  /** Where to go once it's gone. */
  redirectTo: string;
};

/** What deleting a page involves, or `undefined` if it can't be deleted (owned roots, non-browsable pages). */
export function pageDeletion(services: AppServices, pageId: string): PageDeletion | undefined {
  const page = services.blocks.getBlock(pageId);
  if (page?.type !== "page" || page.owner !== null || !browsableScope(services.blocks, page)) return undefined;

  // A loaded tree stops at sub-pages, so each one is loaded to count the pages inside it too.
  let nestedPages = 0;
  const count = (node: TreeNode) => {
    for (const child of node.children ?? []) {
      if (child.block.type === "page") {
        nestedPages += 1;
        count(services.blocks.loadTree(child.block.id)!);
      } else {
        count(child);
      }
    }
  };
  count(services.blocks.loadTree(pageId)!);

  // The nearest page containing it decides where to go.
  let parent = page.parentId ? services.blocks.getBlock(page.parentId) : undefined;
  while (parent && parent.type !== "page") parent = parent.parentId ? services.blocks.getBlock(parent.parentId) : undefined;
  let redirectTo = "/";
  if (parent?.owner?.kind === PROJECT_OWNER_KIND) {
    const project = services.projects.get(parent.owner.id);
    redirectTo = project?.libraryRootId === parent.id ? `/projects/${parent.owner.id}/library` : `/projects/${parent.owner.id}`;
  } else if (parent) {
    redirectTo = `/pages/${parent.id}`;
  }
  return { id: page.id, title: plainText(page.content) || "Untitled", nestedPages, redirectTo };
}

/** Deletes a page and everything inside it. Returns where to go next, or `undefined` if it can't be deleted. */
export function deletePage(services: AppServices, pageId: string): PageDeletion | undefined {
  const deletion = pageDeletion(services, pageId);
  if (deletion) services.blocks.apply([{ op: "delete", id: pageId }]);
  return deletion;
}

/** Whether `pageId` is `ancestorId` or lies anywhere inside it. */
export function isWithin(services: AppServices, pageId: string, ancestorId: string): boolean {
  for (let block = services.blocks.getBlock(pageId); block; block = block.parentId ? services.blocks.getBlock(block.parentId) : undefined) {
    if (block.id === ancestorId) return true;
  }
  return false;
}
