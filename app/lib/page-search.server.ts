import type { AppServices } from "~/composition";
import { plainText } from "~/domain/blocks/text";
import type { TreeNode } from "~/domain/blocks/types";
import type { LibraryNode } from "~/domain/library/library.service";

/** A page to link to: its title and where it lives ("Taskhub › Architecture", "Pages"). */
export type PageMatch = { id: string; title: string; place: string };

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

/** Every page that can be opened: workspace pages and library documents, at any depth. */
export function allPages(services: AppServices): PageMatch[] {
  const pages: PageMatch[] = [];
  const walk = (nodes: readonly LibraryNode[], trail: string[]) => {
    for (const node of nodes) {
      pages.push({ id: node.id, title: node.title || "Untitled", place: trail.join(" › ") });
      walk(node.children, [...trail, node.title || "Untitled"]);
    }
  };
  walk(workspacePageTree(services), ["Pages"]);
  for (const project of services.projects.list()) {
    walk(services.library.getLibraryTree(project.id) ?? [], [project.title || "Untitled"]);
  }
  return pages;
}

/**
 * Pages whose title contains the query (ignoring case), earliest match first,
 * then by title. An empty query lists every page by title.
 */
export function searchPages(services: AppServices, query: string, limit = 50): PageMatch[] {
  const q = query.trim().toLowerCase();
  return allPages(services)
    .map((page) => ({ page, at: q ? page.title.toLowerCase().indexOf(q) : 0 }))
    .filter(({ at }) => at >= 0)
    .sort((a, b) => a.at - b.at || a.page.title.localeCompare(b.page.title))
    .slice(0, limit)
    .map(({ page }) => page);
}
