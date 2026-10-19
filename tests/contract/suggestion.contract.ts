import { beforeEach, describe, expect, it } from "vitest";

import type { AppServices } from "~/composition";
import type { TreeNode } from "~/domain/blocks/types";
import { SuggestionError } from "~/domain/suggestions/errors";
import type { SuggestInput } from "~/domain/suggestions/suggestion.service";
import type { SuggestionBlockInput } from "~/domain/suggestions/types";

import type { ServicesFactory } from "./project.contract";

const para = (id: string, text: string): SuggestionBlockInput => ({ id, type: "paragraph", content: [{ text }] });
const bullet = (id: string, text: string): SuggestionBlockInput => ({ id, type: "bulleted_list_item", content: [{ text }] });

function expectError(run: () => unknown, code: SuggestionError["code"]) {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(SuggestionError);
    expect((error as SuggestionError).code).toBe(code);
    return;
  }
  throw new Error(`Expected a ${code} error`);
}

/** A page's content as "type:text" lines, children indented, suggestions by ID. */
function outline(node: TreeNode | undefined, depth = 0): string[] {
  return (node?.children ?? []).flatMap((child) => {
    const { block } = child;
    const label = block.type === "suggestion" ? `suggestion:${block.id}` : `${block.type}:${block.content.map((s) => s.text).join("")}`;
    return [`${"  ".repeat(depth)}${label}`, ...outline(child, depth + 1)];
  });
}

export function suggestionContract(name: string, factory: ServicesFactory) {
  describe(`${name}: suggestion contract`, () => {
    let services: AppServices;
    let clock: number;

    const page = () => outline(services.blocks.loadTree("P"));
    const suggest = (input: Partial<SuggestInput>) =>
      services.suggestions.suggest({ pageId: "P", action: "insert", author: "builder", ...input } as SuggestInput);
    const setText = (id: string, text: string) => services.blocks.apply([{ op: "update", id, content: [{ text }] }]);

    beforeEach(() => {
      clock = 0;
      services = factory({ now: () => new Date(Date.UTC(2026, 9, 19, 8, 0, clock++)).toISOString() });
      // P: [A "Alpha", B "Beta", T toggle "Notes" → [T1, T2], Sub (sub-page) → [S1]]
      services.blocks.apply([
        { op: "insert", block: { id: "P", type: "page", content: [{ text: "Plan" }] }, parentId: null },
        { op: "insert", block: { id: "A", type: "paragraph", content: [{ text: "Alpha" }] }, parentId: "P" },
        { op: "insert", block: { id: "B", type: "paragraph", content: [{ text: "Beta" }] }, parentId: "P", afterId: "A" },
        { op: "insert", block: { id: "T", type: "toggle", content: [{ text: "Notes" }] }, parentId: "P", afterId: "B" },
        { op: "insert", block: { id: "T1", type: "paragraph", content: [{ text: "One" }] }, parentId: "T" },
        { op: "insert", block: { id: "T2", type: "paragraph", content: [{ text: "Two" }] }, parentId: "T", afterId: "T1" },
        { op: "insert", block: { id: "Sub", type: "page", content: [{ text: "Sub" }] }, parentId: "P", afterId: "T" },
        { op: "insert", block: { id: "S1", type: "paragraph", content: [{ text: "Inside" }] }, parentId: "Sub" },
      ]);
    });

    describe("suggesting", () => {
      it("inserts after a block, holding the proposed blocks, and records it", () => {
        const s = suggest({ id: "s", afterId: "A", blocks: [bullet("n1", "Tables"), bullet("n2", "Code")], note: "From the audit" });
        expect(s).toMatchObject({ id: "s", pageId: "P", action: "insert", author: "builder", note: "From the audit", state: "pending" });
        expect(page()).toEqual([
          "paragraph:Alpha",
          "suggestion:s",
          "  bulleted_list_item:Tables",
          "  bulleted_list_item:Code",
          "paragraph:Beta",
          "toggle:Notes",
          "  paragraph:One",
          "  paragraph:Two",
          "page:Sub",
        ]);
        expect(services.suggestions.get("s")?.status).toBe("pending");
      });

      it("inserts inside a block, or at the end of the page", () => {
        suggest({ id: "in", insideId: "T", blocks: [para("n1", "Three")] });
        suggest({ id: "end", blocks: [para("n2", "Last")] });
        expect(page()).toEqual([
          "paragraph:Alpha",
          "paragraph:Beta",
          "toggle:Notes",
          "  paragraph:One",
          "  paragraph:Two",
          "  suggestion:in",
          "    paragraph:Three",
          "page:Sub",
          "suggestion:end",
          "  paragraph:Last",
        ]);
      });

      it("places a replace or delete right after its target", () => {
        suggest({ id: "r", action: "replace", targetId: "A", blocks: [para("n1", "Alpha!")] });
        suggest({ id: "d", action: "delete", targetId: "B" });
        expect(page().slice(0, 5)).toEqual(["paragraph:Alpha", "suggestion:r", "  paragraph:Alpha!", "paragraph:Beta", "suggestion:d"]);
      });

      it.each([
        ["a target inside a sub-page", { action: "replace", targetId: "S1", blocks: [para("n", "x")] }, "not_found"],
        ["a sub-page as target", { action: "delete", targetId: "Sub" }, "validation"],
        ["a sub-page to insert into", { insideId: "Sub", blocks: [para("n", "x")] }, "validation"],
        ["both after and inside", { afterId: "A", insideId: "T", blocks: [para("n", "x")] }, "validation"],
        ["an insert without blocks", {}, "validation"],
        ["a replace without blocks", { action: "replace", targetId: "A" }, "validation"],
        ["a delete with blocks", { action: "delete", targetId: "A", blocks: [para("n", "x")] }, "validation"],
        ["a proposed page", { blocks: [{ id: "n", type: "page", content: [{ text: "New" }] }] }, "validation"],
        ["a note over 280 characters", { blocks: [para("n", "x")], note: "x".repeat(281) }, "validation"],
        ["an unknown page", { pageId: "nope", blocks: [para("n", "x")] }, "not_found"],
      ])("refuses %s, creating nothing", (_name, input, code) => {
        const before = page();
        expectError(() => suggest(input as Partial<SuggestInput>), code as SuggestionError["code"]);
        expect(page()).toEqual(before);
        expect(services.suggestions.listPending()).toEqual([]);
      });

      it("refuses positions and targets inside another suggestion", () => {
        suggest({ id: "s", afterId: "A", blocks: [para("n1", "Proposed")] });
        expectError(() => suggest({ action: "delete", targetId: "n1" }), "validation");
        expectError(() => suggest({ afterId: "n1", blocks: [para("n2", "x")] }), "validation");
        expectError(() => suggest({ action: "delete", targetId: "s" }), "validation");
      });

      it("refuses deleting a block that contains a page", () => {
        services.blocks.apply([{ op: "move", id: "Sub", parentId: "T", afterId: "T2" }]);
        expectError(() => suggest({ action: "delete", targetId: "T" }), "validation");
      });
    });

    describe("outdated", () => {
      it("is outdated once the target's content changes, but not by an unchanged save", () => {
        suggest({ id: "r", action: "replace", targetId: "A", blocks: [para("n1", "Alpha!")] });
        setText("A", "Alpha");
        expect(services.suggestions.get("r")?.state).toBe("pending");
        setText("A", "Alpha 2");
        expect(services.suggestions.get("r")?.state).toBe("outdated");
      });

      it("is outdated when a deleted subtree changes or the target is gone", () => {
        suggest({ id: "d", action: "delete", targetId: "T" });
        setText("T2", "Two!");
        expect(services.suggestions.get("d")?.state).toBe("outdated");
        suggest({ id: "r", action: "replace", targetId: "B", blocks: [para("n1", "Beta!")] });
        services.blocks.apply([{ op: "delete", id: "B" }]);
        expect(services.suggestions.get("r")?.state).toBe("outdated");
      });

      it("never applies to inserts", () => {
        suggest({ id: "s", afterId: "A", blocks: [para("n1", "x")] });
        setText("A", "Changed");
        expect(services.suggestions.get("s")?.state).toBe("pending");
      });
    });

    describe("approving", () => {
      it("puts inserted blocks in the suggestion's place", () => {
        suggest({ id: "s", afterId: "A", blocks: [bullet("n1", "Tables"), bullet("n2", "Code")] });
        expect(services.suggestions.approve("s")).toMatchObject({ status: "approved", state: "approved" });
        expect(page().slice(0, 4)).toEqual(["paragraph:Alpha", "bulleted_list_item:Tables", "bulleted_list_item:Code", "paragraph:Beta"]);
        expect(services.suggestions.get("s")?.resolvedAt).toBeTruthy();
      });

      it("replaces the target in its place, keeping its children under the first new block", () => {
        suggest({ id: "r", action: "replace", targetId: "T", blocks: [{ id: "h", type: "heading", props: { level: 2 }, content: [{ text: "Notes" }] }] });
        services.suggestions.approve("r");
        expect(page()).toEqual(["paragraph:Alpha", "paragraph:Beta", "heading:Notes", "  paragraph:One", "  paragraph:Two", "page:Sub"]);
      });

      it("deletes the target and its subtree", () => {
        suggest({ id: "d", action: "delete", targetId: "T" });
        services.suggestions.approve("d");
        expect(page()).toEqual(["paragraph:Alpha", "paragraph:Beta", "page:Sub"]);
      });

      it("refuses an outdated suggestion, changing nothing", () => {
        suggest({ id: "r", action: "replace", targetId: "A", blocks: [para("n1", "Ship on Tuesday")] });
        setText("A", "Ship on Wednesday");
        const before = page();
        expectError(() => services.suggestions.approve("r"), "outdated");
        expect(page()).toEqual(before);
        expect(services.suggestions.get("r")?.status).toBe("pending");
      });

      it("refuses a resolved suggestion", () => {
        suggest({ id: "s", blocks: [para("n1", "x")] });
        services.suggestions.reject("s");
        expectError(() => services.suggestions.approve("s"), "resolved");
      });
    });

    describe("rejecting and withdrawing", () => {
      it("rejects, leaving the rest of the page, even when outdated", () => {
        suggest({ id: "d", action: "delete", targetId: "B" });
        setText("B", "Beta 2");
        expect(services.suggestions.reject("d")).toMatchObject({ status: "rejected" });
        expect(page().slice(0, 2)).toEqual(["paragraph:Alpha", "paragraph:Beta 2"]);
      });

      it("lets only the author withdraw", () => {
        suggest({ id: "s", blocks: [para("n1", "x")] });
        expectError(() => services.suggestions.withdraw("s", "reviewer"), "forbidden");
        expect(services.suggestions.withdraw("s", "builder")).toMatchObject({ status: "withdrawn" });
        expect(page()).not.toContain("suggestion:s");
        expectError(() => services.suggestions.withdraw("s", "builder"), "resolved");
      });
    });

    describe("undo", () => {
      it("reopens an approved replace, restoring the original", () => {
        suggest({ id: "r", action: "replace", targetId: "T", blocks: [para("n1", "Flat")] });
        const before = page();
        services.suggestions.approve("r");
        expect(services.suggestions.reopen("r")).toMatchObject({ status: "pending", state: "pending", resolvedAt: null });
        expect(page()).toEqual(before);
      });

      it("reopens approved inserts and deletes, and rejections", () => {
        suggest({ id: "s", afterId: "A", blocks: [para("n1", "New")] });
        suggest({ id: "d", action: "delete", targetId: "T" });
        suggest({ id: "x", blocks: [para("n2", "Last")] });
        const before = page();
        services.suggestions.approve("s");
        services.suggestions.approve("d");
        services.suggestions.reject("x");
        services.suggestions.reopen("x");
        services.suggestions.reopen("d");
        services.suggestions.reopen("s");
        expect(page()).toEqual(before);
      });

      it("refuses once the page changed in the way", () => {
        suggest({ id: "s", afterId: "A", blocks: [para("n1", "New")] });
        services.suggestions.approve("s");
        services.blocks.apply([{ op: "delete", id: "n1" }]);
        expectError(() => services.suggestions.reopen("s"), "validation");
        expect(services.suggestions.get("s")?.status).toBe("approved");
      });
    });

    describe("tables", () => {
      /** A 2×2 table TB after B: rows TR1 (TC1a "x", TC1b "y") and TR2 (TC2a, TC2b). */
      const addTable = () =>
        services.blocks.apply([
          { op: "insert", block: { id: "TB", type: "table" }, parentId: "P", afterId: "B" },
          { op: "insert", block: { id: "TR1", type: "table_row" }, parentId: "TB" },
          { op: "insert", block: { id: "TC1a", type: "table_cell", content: [{ text: "x" }] }, parentId: "TR1" },
          { op: "insert", block: { id: "TC1b", type: "table_cell", content: [{ text: "y" }] }, parentId: "TR1", afterId: "TC1a" },
          { op: "insert", block: { id: "TR2", type: "table_row" }, parentId: "TB", afterId: "TR1" },
          { op: "insert", block: { id: "TC2a", type: "table_cell" }, parentId: "TR2" },
          { op: "insert", block: { id: "TC2b", type: "table_cell" }, parentId: "TR2", afterId: "TC2a" },
        ]);
      const table = (id: string): SuggestionBlockInput => ({
        id,
        type: "table",
        children: [
          { id: `${id}-r`, type: "table_row", children: [{ id: `${id}-c`, type: "table_cell", content: [{ text: "new" }] }] },
        ],
      });

      it("refuses rows and cells as targets or positions, naming the table, and anything inside a table", () => {
        addTable();
        for (const input of [
          { action: "replace" as const, targetId: "TC1a", blocks: [para("n", "x")] },
          { action: "delete" as const, targetId: "TR2" },
          { afterId: "TR1", blocks: [para("n", "x")] },
        ]) {
          expect(() => suggest(input)).toThrow(/part of a table; suggest on the whole table \(TB\)/);
        }
        expectError(() => suggest({ insideId: "TB", blocks: [para("n", "x")] }), "validation");
      });

      it("replaces a whole table, and undo brings it back exactly", () => {
        addTable();
        const before = page();
        suggest({ id: "r", action: "replace", targetId: "TB", blocks: [para("n", "Flattened")] });
        services.suggestions.approve("r");
        expect(page()).toEqual(["paragraph:Alpha", "paragraph:Beta", "paragraph:Flattened", "toggle:Notes", "  paragraph:One", "  paragraph:Two", "page:Sub"]);
        services.suggestions.reopen("r");
        services.suggestions.reject("r");
        expect(page()).toEqual(before);
      });

      it("outdates a suggestion on a table when any cell changes", () => {
        addTable();
        suggest({ id: "d", action: "delete", targetId: "TB" });
        suggest({ id: "r", action: "replace", targetId: "TB", blocks: [table("t2")] });
        setText("TC2b", "filled in");
        expect(services.suggestions.get("d")?.state).toBe("outdated");
        expect(services.suggestions.get("r")?.state).toBe("outdated");
      });

      it("proposes a table, and puts a replaced toggle's children after a block that can't hold them", () => {
        suggest({ id: "i", afterId: "A", blocks: [table("t1")] });
        services.suggestions.approve("i");
        expect(page().slice(0, 4)).toEqual(["paragraph:Alpha", "table:", "  table_row:", "    table_cell:new"]);
        suggest({ id: "r", action: "replace", targetId: "T", blocks: [{ id: "k", type: "code", content: [{ text: "notes" }] }] });
        const before = page();
        services.suggestions.approve("r");
        expect(page().slice(-4)).toEqual(["code:notes", "paragraph:One", "paragraph:Two", "page:Sub"]);
        services.suggestions.reopen("r");
        expect(page()).toEqual(before);
      });
    });

    describe("all at once", () => {
      it("approves a page's suggestions in document order, skipping outdated ones", () => {
        suggest({ id: "late", blocks: [para("n1", "End")] });
        suggest({ id: "r", action: "replace", targetId: "A", blocks: [para("n2", "Alpha!")] });
        suggest({ id: "early", afterId: "B", blocks: [para("n3", "After beta")] });
        setText("A", "Alpha 2");
        expect(services.suggestions.pendingOn("P").map((s) => s.id)).toEqual(["r", "early", "late"]);
        expect(services.suggestions.approveAll("P")).toEqual({ approved: 2, outdated: 1 });
        expect(services.suggestions.pendingOn("P").map((s) => s.id)).toEqual(["r"]);
        expect(services.suggestions.rejectAll("P")).toEqual({ rejected: 1 });
        expect(services.suggestions.listPending()).toEqual([]);
      });

      it("finds suggestions by the start of their ID, resolved ones too", () => {
        suggest({ id: "abc-1", blocks: [para("n1", "x")] });
        suggest({ id: "abd-2", blocks: [para("n2", "y")] });
        services.suggestions.reject("abd-2");
        expect(services.suggestions.idsStartingWith("ab").sort()).toEqual(["abc-1", "abd-2"]);
        expect(services.suggestions.idsStartingWith("abd")).toEqual(["abd-2"]);
        expect(services.suggestions.idsStartingWith("zz")).toEqual([]);
      });

      it("lists pending suggestions across pages, oldest first", () => {
        services.blocks.apply([{ op: "insert", block: { id: "Q", type: "page", content: [{ text: "Other" }] }, parentId: null }]);
        suggest({ id: "first", blocks: [para("n1", "x")] });
        suggest({ id: "second", pageId: "Q", blocks: [para("n2", "y")], author: "planner" });
        expect(services.suggestions.listPending().map((s) => [s.id, s.pageId, s.author])).toEqual([
          ["first", "P", "builder"],
          ["second", "Q", "planner"],
        ]);
      });
    });
  });
}
