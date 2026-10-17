import { beforeEach, describe, expect, it } from "vitest";

import { buildPageView } from "../../app/lib/page-view.server";
import { createInMemoryServices } from "~/composition";
import type { BlockService } from "~/domain/blocks/block.service";

const text = (value: string) => [{ text: value }];

describe("buildPageView", () => {
  let blocks: BlockService;

  beforeEach(() => {
    blocks = createInMemoryServices().blocks;
    blocks.apply([
      { op: "insert", block: { id: "P", type: "page", content: text("Page") }, parentId: null },
      { op: "insert", block: { id: "Q", type: "page", content: text("Other") }, parentId: null, afterId: "P" },
      { op: "insert", block: { id: "X", type: "toggle", content: text("Target") }, parentId: "Q" },
      { op: "insert", block: { id: "X1", type: "paragraph", content: text("Inside") }, parentId: "X" },
      { op: "insert", block: { id: "D", type: "paragraph" }, parentId: "Q", afterId: "X" },
    ]);
  });

  const insertRef = (id: string, targetId: string, afterId?: string) =>
    blocks.apply([
      { op: "insert", block: { id, type: "reference", props: { targetId } }, parentId: "P", afterId },
    ]);

  it("returns the title and blocks in order", () => {
    blocks.apply([
      { op: "insert", block: { id: "A", type: "paragraph", content: text("a") }, parentId: "P" },
      { op: "insert", block: { id: "S", type: "page", content: text("Sub") }, parentId: "P", afterId: "A" },
    ]);
    const view = buildPageView(blocks, "P");
    expect(view?.title).toEqual(text("Page"));
    expect(view?.blocks).toEqual([
      { kind: "content", id: "A", type: "paragraph", props: {}, content: text("a"), children: [] },
      { kind: "subpage", id: "S", title: text("Sub") },
    ]);
  });

  it("links references to pages and expands references to blocks", () => {
    insertRef("R1", "Q");
    insertRef("R2", "X", "R1");
    const view = buildPageView(blocks, "P");
    expect(view?.blocks[0]).toEqual({ kind: "reference", id: "R1", target: { status: "page", pageId: "Q", title: text("Other") } });
    expect(view?.blocks[1]).toMatchObject({
      kind: "reference",
      target: { status: "block", block: { id: "X", children: [{ id: "X1" }] } },
    });
  });

  it("marks missing and circular references", () => {
    insertRef("R1", "D");
    insertRef("R2", "P", "R1");
    blocks.apply([{ op: "delete", id: "D" }]);
    const view = buildPageView(blocks, "P");
    expect(view?.blocks.map((b) => (b.kind === "reference" ? b.target.status : b.kind))).toEqual(["missing", "cycle"]);
  });

  it("stops expanding when a referenced block refers back", () => {
    // X contains a reference back to X: expanding it must not recurse forever.
    blocks.apply([
      { op: "insert", block: { id: "XR", type: "reference", props: { targetId: "X" } }, parentId: "X", afterId: "X1" },
    ]);
    insertRef("R", "X");
    const view = buildPageView(blocks, "P");
    expect(view?.blocks[0]).toMatchObject({
      target: { status: "block", block: { children: [{ id: "X1" }, { id: "XR", target: { status: "cycle" } }] } },
    });
  });

  it("returns undefined for unknown IDs, non-page blocks and owned roots", () => {
    blocks.apply([
      { op: "insert", block: { id: "T", type: "page", content: text("Task") }, owner: { kind: "task", id: "t1" } },
      { op: "insert", block: { id: "T1", type: "page" }, parentId: "T" },
    ]);
    expect(buildPageView(blocks, "nope")).toBeUndefined();
    expect(buildPageView(blocks, "X")).toBeUndefined();
    expect(buildPageView(blocks, "T")).toBeUndefined();
    expect(buildPageView(blocks, "T1")).toBeUndefined();
  });
});
