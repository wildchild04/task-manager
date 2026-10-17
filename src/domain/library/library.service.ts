import type { BlockService } from "../blocks/block.service";
import { plainText } from "../blocks/text";
import type { TreeNode } from "../blocks/types";
import type { ProjectService } from "../projects/project.service";

/** A document in the library tree: a page with its nested documents. */
export type LibraryNode = { id: string; title: string; children: LibraryNode[] };

/**
 * Maps the owner of an owned root to the project it belongs to. Projects own
 * their home page and library root; later domains (tasks) register their own.
 */
export type ProjectResolvers = Readonly<Record<string, (ownerId: string) => string | undefined>>;

export class LibraryService {
  constructor(
    private readonly blocks: BlockService,
    private readonly projects: ProjectService,
    private readonly resolvers: ProjectResolvers,
  ) {}

  /** The project's documents as a page-only tree, at every depth, in sibling order. */
  getLibraryTree(projectId: string): LibraryNode[] | undefined {
    const project = this.projects.get(projectId);
    if (!project) return undefined;
    return this.pagesIn(this.blocks.loadTree(project.libraryRootId)?.children ?? []);
  }

  /** The project a page belongs to, found through the owner of its root. */
  projectOfPage(pageId: string): string | undefined {
    const owner = this.blocks.rootOf(pageId)?.owner;
    return owner ? this.resolvers[owner.kind]?.(owner.id) : undefined;
  }

  /**
   * Collects the pages among `nodes`. Content blocks are skipped, but pages
   * nested inside them (for example inside a toggle) still count.
   */
  private pagesIn(nodes: readonly TreeNode[]): LibraryNode[] {
    return nodes.flatMap((node): LibraryNode[] => {
      if (node.block.type !== "page") return this.pagesIn(node.children ?? []);
      const nested = this.blocks.loadTree(node.block.id)?.children ?? [];
      return [{ id: node.block.id, title: plainText(node.block.content), children: this.pagesIn(nested) }];
    });
  }
}
