import { agentMarkdown } from "../app/lib/agent/functions.server";
import type { AppServices } from "~/composition";
import { fromMarkdown, type MarkdownBlock, toMarkdown } from "~/domain/blocks/markdown";
import { plainText } from "~/domain/blocks/text";
import type { Block, Operation, TreeNode } from "~/domain/blocks/types";

/** Pages that had tables stored as literal `|` paragraphs, and how many each. */
export type LiteralTablesReport = { pages: { id: string; title: string; tables: number }[]; tables: number };

/** Every page with content: workspace pages, projects' home pages and libraries, task descriptions. */
function rootPageIds(services: AppServices): string[] {
  return [
    ...services.blocks.listRootPages().map((page) => page.id),
    ...services.projects
      .list()
      .flatMap((project) => [
        project.homePageId,
        project.libraryRootId,
        ...services.tasks.list(project.id).map((task) => task.bodyPageId),
      ]),
  ];
}

/** Insert operations for blocks written from Markdown, the first after `afterId`. */
function insertOps(blocks: readonly MarkdownBlock[], parentId: string, afterId: string | null): Operation[] {
  const ops: Operation[] = [];
  let previous = afterId;
  for (const { children, ...block } of blocks) {
    ops.push({ op: "insert", block, parentId, afterId: previous });
    if (children?.length) ops.push(...insertOps(children, block.id, null));
    previous = block.id;
  }
  return ops;
}

/**
 * Finds paragraphs that are really tables: written by agents before tables
 * existed, they hold the table's `|` lines as text. Reads each as agents see it
 * and, when that Markdown holds a table, replaces the paragraph with the blocks
 * it reads as, in place. With `apply`, converts one batch per page; otherwise
 * only reports.
 */
export function convertLiteralTables(services: AppServices, { apply = false } = {}): LiteralTablesReport {
  const { reader, writer } = agentMarkdown(services);
  const report: LiteralTablesReport = { pages: [], tables: 0 };
  const queue = rootPageIds(services);
  while (queue.length > 0) {
    const tree = services.blocks.loadTree(queue.shift()!);
    if (!tree) continue;
    const ops: Operation[] = [];
    let tables = 0;
    const visit = (node: TreeNode) => {
      for (const child of node.children ?? []) {
        // Nested pages are converted on their own; pending suggestions are left as proposed.
        if (child.block.type === "page") queue.push(child.block.id);
        else if (child.block.type === "suggestion") continue;
        else if (child.block.type === "paragraph" && !child.children?.length) tables += convert(child.block, ops);
        else visit(child);
      }
    };
    const convert = (paragraph: Block, into: Operation[]): number => {
      const blocks = fromMarkdown(toMarkdown([{ block: paragraph, children: [] }], reader), writer);
      const found = blocks.filter((block) => block.type === "table").length;
      if (found > 0) into.push(...insertOps(blocks, paragraph.parentId!, paragraph.id), { op: "delete", id: paragraph.id });
      return found;
    };
    visit(tree);
    if (tables === 0) continue;
    if (apply) services.blocks.apply(ops);
    report.pages.push({ id: tree.block.id, title: plainText(tree.block.content) || "Untitled", tables });
    report.tables += tables;
  }
  return report;
}
