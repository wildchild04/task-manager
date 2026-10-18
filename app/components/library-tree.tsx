import { TreeNavigation, type TreeNavigationItem } from "@wildchild/design-system";
import { type ReactNode, useEffect, useState } from "react";
import { Link as RouterLink } from "react-router";

import type { LibraryNode } from "~/domain/library/library.service";

/** Library documents as tree items linking through the router, with the open one active. */
export function libraryItems(
  nodes: readonly LibraryNode[],
  activePageId: string | null,
  action?: (node: LibraryNode) => ReactNode,
): TreeNavigationItem[] {
  return nodes.map((node) => ({
    id: node.id,
    label: node.title || "Untitled",
    component: RouterLink,
    to: `/pages/${node.id}`,
    active: node.id === activePageId,
    ...(action ? { action: action(node) } : {}),
    ...(node.children.length > 0 ? { children: libraryItems(node.children, activePageId, action) } : {}),
  }));
}

/** Every document ID in the tree. */
export function allIds(nodes: readonly LibraryNode[]): string[] {
  return nodes.flatMap((node) => [node.id, ...allIds(node.children)]);
}

/** The IDs of the documents containing `id`, outermost first; empty if it isn't in the tree. */
export function ancestorIds(nodes: readonly LibraryNode[], id: string): string[] {
  for (const node of nodes) {
    if (node.id === id) return [];
    const below = ancestorIds(node.children, id);
    if (below.length > 0 || node.children.some((child) => child.id === id)) return [node.id, ...below];
  }
  return [];
}

/**
 * A project's library in the navigation. Expansion is kept while moving
 * between documents, and the open document's ancestors are expanded every
 * time it changes (not only on first render).
 */
export function LibraryTree({
  ariaLabel,
  nodes,
  activePageId,
  expandAll = false,
  action,
}: {
  ariaLabel: string;
  nodes: readonly LibraryNode[];
  activePageId: string | null;
  expandAll?: boolean;
  /** Something to show on each document's row, e.g. a delete button. */
  action?: (node: LibraryNode) => ReactNode;
}) {
  const [expanded, setExpanded] = useState<string[]>(() =>
    expandAll ? allIds(nodes) : activePageId ? ancestorIds(nodes, activePageId) : [],
  );

  useEffect(() => {
    if (!activePageId) return;
    const needed = ancestorIds(nodes, activePageId);
    setExpanded((current) => (needed.every((id) => current.includes(id)) ? current : [...new Set([...current, ...needed])]));
  }, [activePageId, nodes]);

  return (
    <TreeNavigation
      ariaLabel={ariaLabel}
      dense
      items={libraryItems(nodes, activePageId, action)}
      expandedIds={expanded}
      onExpandedIdsChange={setExpanded}
    />
  );
}
