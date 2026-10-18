import type { AppServices } from "~/composition";
import { plainText } from "~/domain/blocks/text";
import type { TreeNode } from "~/domain/blocks/types";
import type { LibraryNode } from "~/domain/library/library.service";

/** A page to link to: its title and where it lives ("Taskhub › Architecture", "Pages"). */
export type PageMatch = { id: string; title: string; place: string };

/** Every page that can be opened: workspace pages and library documents, at any depth. */
export function allPages(services: AppServices): PageMatch[] {
  const pages: PageMatch[] = [];

  // A loaded tree stops at nested pages, so each one is loaded in turn.
  const workspace = (node: TreeNode, trail: string[]) => {
    for (const child of node.children ?? []) {
      if (child.block.type === "page") {
        const title = plainText(child.block.content) || "Untitled";
        pages.push({ id: child.block.id, title, place: trail.join(" › ") });
        const nested = services.blocks.loadTree(child.block.id);
        if (nested) workspace(nested, [...trail, title]);
      } else {
        workspace(child, trail);
      }
    }
  };
  for (const root of services.blocks.listRootPages()) {
    const title = plainText(root.content) || "Untitled";
    pages.push({ id: root.id, title, place: "Pages" });
    const tree = services.blocks.loadTree(root.id);
    if (tree) workspace(tree, ["Pages", title]);
  }

  const library = (nodes: readonly LibraryNode[], trail: string[]) => {
    for (const node of nodes) {
      pages.push({ id: node.id, title: node.title || "Untitled", place: trail.join(" › ") });
      library(node.children, [...trail, node.title || "Untitled"]);
    }
  };
  for (const project of services.projects.list()) {
    library(services.library.getLibraryTree(project.id) ?? [], [project.title || "Untitled"]);
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
