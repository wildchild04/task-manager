import type { AppServices } from "~/composition";
import { plainText } from "~/domain/blocks/text";
import type { TreeNode } from "~/domain/blocks/types";
import type { LibraryNode } from "~/domain/library/library.service";

import { slugOfKind, TASK_LISTS } from "./format";

/**
 * A page or task to mention or link to: the page a mention points at (a task's
 * description page for a task), its title, where it lives, and the link it opens.
 */
export type PageMatch = { id: string; title: string; place: string; href: string };

/**
 * The workspace's pages as a tree: root pages in order, each with the pages
 * nested in it (found anywhere in its blocks, in reading order), at any depth.
 */
export function workspacePageTree(services: AppServices): LibraryNode[] {
  // A loaded tree stops at nested pages, so each one is loaded in turn.
  const nested = (node: TreeNode): LibraryNode[] =>
    (node.children ?? []).flatMap((child) => {
      if (child.block.type !== "page") return nested(child);
      const tree = services.blocks.loadTree(child.block.id);
      return [{ id: child.block.id, title: plainText(child.block.content) || "Untitled", children: tree ? nested(tree) : [] }];
    });
  return services.blocks.listRootPages().map((root) => {
    const tree = services.blocks.loadTree(root.id);
    return { id: root.id, title: plainText(root.content) || "Untitled", children: tree ? nested(tree) : [] };
  });
}

/** Every page that can be opened: workspace pages, project homes and library documents, at any depth. */
export function allPages(services: AppServices): PageMatch[] {
  const pages: PageMatch[] = [];
  const walk = (nodes: readonly LibraryNode[], trail: string[]) => {
    for (const node of nodes) {
      pages.push({ id: node.id, title: node.title || "Untitled", place: trail.join(" › "), href: `/pages/${node.id}` });
      walk(node.children, [...trail, node.title || "Untitled"]);
    }
  };
  walk(workspacePageTree(services), ["Pages"]);
  for (const project of services.projects.list()) {
    pages.push({
      id: project.homePageId,
      title: project.title || "Untitled",
      place: "Project",
      href: `/projects/${project.id}`,
    });
    walk(services.library.getLibraryTree(project.id) ?? [], [project.title || "Untitled"]);
  }
  return pages;
}

/** Every task of every project, to mention or link to: its description page and its link. */
export function allTasks(services: AppServices): PageMatch[] {
  return services.projects.list().flatMap((project) =>
    services.tasks.list(project.id).map((task) => ({
      id: task.bodyPageId,
      title: task.title || "Untitled",
      place: `Task · ${TASK_LISTS[slugOfKind(task.kind)].singular} · ${project.title || "Untitled"}`,
      href: `/tasks/${task.id}`,
    })),
  );
}

/**
 * Pages and tasks whose title contains the query (ignoring case), earliest
 * match first, then by title. An empty query lists everything by title.
 */
export function searchPages(services: AppServices, query: string, limit = 50): PageMatch[] {
  const q = query.trim().toLowerCase();
  return [...allPages(services), ...allTasks(services)]
    .map((page) => ({ page, at: q ? page.title.toLowerCase().indexOf(q) : 0 }))
    .filter(({ at }) => at >= 0)
    .sort((a, b) => a.at - b.at || a.page.title.localeCompare(b.page.title))
    .slice(0, limit)
    .map(({ page }) => page);
}

export type GlobalSearchResult = PageMatch & { matchedId?: string };

/** Search navigable items by title or by the ID used in their route. */
export function globalSearch(services: AppServices, query: string): GlobalSearchResult[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return [...allPages(services), ...allTasks(services)]
    .map((page) => {
      const id = page.href.slice(page.href.lastIndexOf("/") + 1);
      const idMatch = q.length >= 4 && id.toLowerCase().startsWith(q);
      const at = page.title.toLowerCase().indexOf(q);
      return { page: { ...page, id }, idMatch, exact: idMatch && id.toLowerCase() === q, at };
    })
    .filter(({ idMatch, at }) => idMatch || at >= 0)
    .sort((a, b) => Number(b.idMatch) - Number(a.idMatch) || Number(b.exact) - Number(a.exact) ||
      (a.idMatch ? 0 : a.at - b.at) || a.page.title.localeCompare(b.page.title) || a.page.href.localeCompare(b.page.href))
    .slice(0, 20)
    .map(({ page, idMatch }) => ({ ...page, ...(idMatch ? { matchedId: page.id } : {}) }));
}
