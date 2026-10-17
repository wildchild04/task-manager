import type { AppServices } from "~/composition";
import type { LibraryNode } from "~/domain/library/library.service";

import { type ActionResult, domainError, formValues, invalid } from "./forms.server";

export type LibraryView = {
  project: { id: string; title: string };
  tree: LibraryNode[];
  /** Every document, depth-first, for the "inside" picker. */
  parents: { id: string; title: string; depth: number }[];
};

export function libraryView(services: AppServices, projectId: string): LibraryView | undefined {
  const project = services.projects.get(projectId);
  const tree = services.library.getLibraryTree(projectId);
  if (!project || !tree) return undefined;
  const parents: LibraryView["parents"] = [];
  const walk = (nodes: LibraryNode[], depth: number) => {
    for (const node of nodes) {
      parents.push({ id: node.id, title: node.title || "Untitled", depth });
      walk(node.children, depth + 1);
    }
  };
  walk(tree, 0);
  return { project: { id: project.id, title: project.title || "Untitled" }, tree, parents };
}

/** Creates a document at the top of the library or inside another document, after its last child. */
export function createDocumentAction(services: AppServices, projectId: string, formData: FormData): ActionResult {
  const values = formValues(formData);
  if (!values.title) return invalid(values, { title: "A document needs a title" });
  const project = services.projects.get(projectId);
  if (!project) return invalid(values, {}, "This project no longer exists");

  const parentId = values.parentId || project.libraryRootId;
  if (parentId !== project.libraryRootId) {
    const parent = services.blocks.getBlock(parentId);
    if (parent?.type !== "page" || services.library.projectOfPage(parentId) !== projectId) {
      return invalid(values, { parentId: "Choose a document in this library" });
    }
  }

  const id = crypto.randomUUID();
  try {
    services.blocks.apply([
      {
        op: "insert",
        block: { id, type: "page", content: [{ text: values.title }] },
        parentId,
        afterId: services.blocks.getChildren(parentId).at(-1)?.id ?? null,
      },
    ]);
    return { ok: true, id };
  } catch (error) {
    return domainError(error, values);
  }
}
