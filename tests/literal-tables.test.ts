import { beforeEach, describe, expect, it } from "vitest";

import { convertLiteralTables } from "../scripts/literal-tables";
import { type AppServices, createInMemoryServices } from "~/composition";
import { fromInlineMarkdown } from "~/domain/blocks/markdown";
import type { TreeNode } from "~/domain/blocks/types";

/** Tables as the content audit found them, stored as one paragraph of `|` lines each. */
const GARDEN = [
  "| Time | Soil temp (deep C) | Moisture (%) | Fertility | pH | Sun (lux) | Bag bottom C | Tile sun C | Tile shade C | Notes |",
  "|------|---------------------|--------------|-----------|----|-----------|-------------|------------|-------------|------|",
  "| 10:00 | | | | | | | | | |",
  "| 13:00 | | | | | | | | | |",
].join("\n");
const QUADRANT = [
  "| | Hands-on | Theoretical |",
  "|---|---|---|",
  "| **Foundational** | 🎯 **Start here** | Still valuable |",
  "| **Advanced** | Toy Raft | Lowest priority |",
].join("\n");
const ROADMAP = ["| # | Topic | Hands-on angle |", "|---|---|---|", "| 4 | Databases | Run `EXPLAIN` on real queries |"].join(
  "\n",
);

const noTargets = { findTarget: () => null, newId: () => crypto.randomUUID() };

describe("converting literal tables", () => {
  let services: AppServices;

  /** A paragraph holding text as the old importer stored it: its lines, with inline marks read. */
  const literal = (id: string, parentId: string, text: string, afterId: string | null = null) =>
    services.blocks.apply([
      { op: "insert", block: { id, type: "paragraph", content: fromInlineMarkdown(text, noTargets) }, parentId, afterId },
    ]);

  /** A page's blocks as `type:text` lines, tables as rows of cell texts. */
  const outline = (pageId: string) => {
    const lines: string[] = [];
    const visit = (node: TreeNode, depth: number) => {
      for (const child of node.children ?? []) {
        const { type, content } = child.block;
        if (type === "table_row") {
          lines.push(
            `${"  ".repeat(depth)}row: ${(child.children ?? []).map((cell) => cell.block.content.map((s) => s.text).join("")).join(" | ")}`,
          );
          continue;
        }
        lines.push(`${"  ".repeat(depth)}${type}:${content.map((s) => s.text).join("")}`);
        visit(child, depth + 1);
      }
    };
    visit(services.blocks.loadTree(pageId)!, 0);
    return lines;
  };

  beforeEach(() => {
    services = createInMemoryServices();
    services.blocks.apply([
      { op: "insert", block: { id: "G", type: "page", content: [{ text: "Garden log" }] }, parentId: null },
      { op: "insert", block: { id: "F", type: "page", content: [{ text: "Framework" }] }, parentId: null, afterId: "G" },
    ]);
    literal("g-intro", "G", "## Measurements is a heading-looking line kept as a paragraph");
    literal("g-table", "G", GARDEN, "g-intro");
    literal("f-table", "F", QUADRANT);
    literal("f-note", "F", "| only one line, no separator |", "f-table");
    services.projects.create({ id: "P", title: "SDE" });
    const task = services.tasks.create({ id: "W", projectId: "P", kind: "work", title: "Roadmap" });
    literal("r-table", task.bodyPageId, ROADMAP);
  });

  it("reports what it would convert in a dry run, changing nothing", () => {
    const before = outline("F");
    expect(convertLiteralTables(services)).toEqual({
      pages: [
        { id: "G", title: "Garden log", tables: 1 },
        { id: "F", title: "Framework", tables: 1 },
        { id: services.tasks.get("W")!.bodyPageId, title: "Roadmap", tables: 1 },
      ],
      tables: 3,
    });
    expect(outline("F")).toEqual(before);
  });

  it("replaces each literal table in place, keeping marks, empty cells and other paragraphs", () => {
    convertLiteralTables(services, { apply: true });
    expect(outline("G")).toEqual([
      "paragraph:## Measurements is a heading-looking line kept as a paragraph",
      "table:",
      "  row: Time | Soil temp (deep C) | Moisture (%) | Fertility | pH | Sun (lux) | Bag bottom C | Tile sun C | Tile shade C | Notes",
      "  row: 10:00 |  |  |  |  |  |  |  |  | ",
      "  row: 13:00 |  |  |  |  |  |  |  |  | ",
    ]);
    expect(outline("F")).toEqual([
      "table:",
      "  row:  | Hands-on | Theoretical",
      "  row: Foundational | 🎯 Start here | Still valuable",
      "  row: Advanced | Toy Raft | Lowest priority",
      "paragraph:| only one line, no separator |",
    ]);
    const quadrant = services.blocks.getChildren("F")[0]!;
    expect(quadrant.props).toEqual({ headerRow: true, headerColumn: false });
    const foundational = services.blocks.getChildren(services.blocks.getChildren(quadrant.id)[1]!.id)[0]!;
    expect(foundational.content).toEqual([{ text: "Foundational", marks: ["bold"] }]);
    const body = services.tasks.get("W")!.bodyPageId;
    const explainCell = services.blocks.getChildren(
      services.blocks.getChildren(services.blocks.getChildren(body)[0]!.id)[1]!.id,
    )[2]!;
    expect(explainCell.content).toEqual([{ text: "Run " }, { text: "EXPLAIN", marks: ["code"] }, { text: " on real queries" }]);
  });

  it("finds nothing more once converted", () => {
    convertLiteralTables(services, { apply: true });
    expect(convertLiteralTables(services)).toEqual({ pages: [], tables: 0 });
  });
});
