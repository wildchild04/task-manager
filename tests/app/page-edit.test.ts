import { beforeEach, describe, expect, it } from "vitest";

import { applyEdit, deletePage, editablePage, pageDeletion } from "../../app/lib/page-edit.server";
import { type AppServices, createInMemoryServices } from "~/composition";
import type { Operation } from "~/domain/blocks/types";

describe("page edits", () => {
  let services: AppServices;
  let clock: number;

  beforeEach(() => {
    clock = 0;
    services = createInMemoryServices({ now: () => new Date(Date.UTC(2026, 9, 14, 8, 0, clock++)).toISOString() });
    services.projects.create({ id: "P", title: "Taskhub" });
    const library = services.projects.get("P")!.libraryRootId;
    services.blocks.apply([
      { op: "insert", block: { id: "doc", type: "page", content: [{ text: "Doc" }] }, parentId: library },
      { op: "insert", block: { id: "a", type: "paragraph", content: [{ text: "A" }] }, parentId: "doc" },
      { op: "insert", block: { id: "sub", type: "page", content: [{ text: "Sub" }] }, parentId: "doc", afterId: "a" },
      { op: "insert", block: { id: "deep", type: "page", content: [{ text: "Deep" }] }, parentId: "sub" },
      { op: "insert", block: { id: "s1", type: "paragraph", content: [{ text: "In sub" }] }, parentId: "sub", afterId: "deep" },
      { op: "insert", block: { id: "other", type: "page", content: [{ text: "Other" }] }, parentId: null },
    ]);
  });

  const edit = (batch: Operation[], surface = "page", id = "doc") => applyEdit(services, { surface, id, batch });

  it("applies an edit inside the page and returns the new version", () => {
    const before = editablePage(services, "page", "doc")!.version;
    const result = edit([
      { op: "update", id: "a", content: [{ text: "AB" }] },
      { op: "insert", block: { id: "b", type: "todo", props: { checked: false } }, parentId: "doc", afterId: "a" },
      { op: "update", id: "doc", content: [{ text: "Renamed" }] },
    ]);
    expect(result).toEqual({ ok: true, version: editablePage(services, "page", "doc")!.version });
    expect(result.ok && result.version).not.toBe(before);
    expect(services.blocks.getBlock("doc")!.content).toEqual([{ text: "Renamed" }]);
  });

  it.each([
    ["a block of another page", [{ op: "update", id: "s1", content: [{ text: "x" }] }], "Edits must stay inside the page"],
    ["inserting into a sub-page", [{ op: "insert", block: { id: "x", type: "paragraph" }, parentId: "sub" }], "Edits must stay inside the page"],
    ["deleting a sub-page", [{ op: "delete", id: "sub" }], "Sub-pages can't be deleted by editing; delete the page itself"],
    ["retitling a sub-page", [{ op: "update", id: "sub", content: [{ text: "x" }] }], "A sub-page is edited on its own page"],
    ["creating a page with more than a title", [{ op: "insert", block: { id: "x", type: "page", props: { icon: "x" } }, parentId: "doc" }], "A page block can't be created here"],
    ["inserting into a new sub-page", [{ op: "insert", block: { id: "x", type: "page" }, parentId: "doc" }, { op: "insert", block: { id: "y", type: "paragraph" }, parentId: "x" }], "Edits must stay inside the page"],
    ["turning a block into a page", [{ op: "update", id: "a", type: "page" }], "A block can't be turned into a page"],
    ["deleting the page itself", [{ op: "delete", id: "doc" }], "Edits must stay inside the page"],
  ] as const)("refuses %s, changing nothing", (_, batch, message) => {
    const version = editablePage(services, "page", "doc")!.version;
    expect(edit([{ op: "update", id: "a", content: [{ text: "changed" }] }, ...(batch as unknown as Operation[])])).toEqual({ ok: false, message });
    expect(editablePage(services, "page", "doc")!.version).toBe(version);
  });

  describe("empty sub-pages", () => {
    it("creates one and deletes it again while it has no blocks", () => {
      expect(edit([{ op: "insert", block: { id: "new", type: "page", content: [] }, parentId: "doc", afterId: "a" }]).ok).toBe(true);
      expect(services.blocks.getBlock("new")?.type).toBe("page");
      expect(edit([{ op: "delete", id: "new" }]).ok).toBe(true);
      expect(services.blocks.getBlock("new")).toBeUndefined();
    });

    it("won't delete one that has blocks, nor a block containing an empty one", () => {
      edit([{ op: "insert", block: { id: "new", type: "page" }, parentId: "doc" }]);
      services.blocks.apply([{ op: "insert", block: { id: "inside", type: "paragraph" }, parentId: "new" }]);
      expect(edit([{ op: "delete", id: "new" }])).toEqual({ ok: false, message: "Sub-pages can't be deleted by editing; delete the page itself" });
      edit([{ op: "insert", block: { id: "empty", type: "page" }, parentId: "a" }]);
      expect(edit([{ op: "delete", id: "a" }])).toEqual({ ok: false, message: "Sub-pages can't be deleted by editing; delete the page itself" });
    });

    it("are made on project pages but not in task bodies", () => {
      const home = services.projects.get("P")!.homePageId;
      const page = (id: string) => [{ op: "insert", block: { id, type: "page" }, parentId: home }] as Operation[];
      expect(edit(page("p1"), "project", "P").ok).toBe(true);
      services.tasks.create({ id: "T", projectId: "P", kind: "work", title: "T" });
      const body = services.tasks.get("T")!.bodyPageId;
      expect(edit([{ op: "insert", block: { id: "p2", type: "page" }, parentId: body }], "task", "T")).toEqual({
        ok: false,
        message: "A page block can't be created here",
      });
    });
  });

  it("refuses deleting a block that contains a sub-page", () => {
    edit([{ op: "move", id: "sub", parentId: "a", afterId: null }]);
    expect(edit([{ op: "delete", id: "a" }])).toEqual({ ok: false, message: "Sub-pages can't be deleted by editing; delete the page itself" });
  });

  describe("suggestions", () => {
    beforeEach(() => {
      services.suggestions.suggest({
        id: "sg",
        pageId: "doc",
        action: "replace",
        targetId: "a",
        blocks: [{ id: "n", type: "paragraph", content: [{ text: "A!" }] }],
        author: "builder",
      });
    });
    const SUGGESTED = { ok: false, message: "Suggestions change only by being approved or rejected" };

    it.each([
      ["changing a block inside", { op: "update", id: "n", content: [{ text: "edited" }] }],
      ["adding into", { op: "insert", block: { id: "x", type: "paragraph" }, parentId: "sg" }],
      ["moving one out", { op: "move", id: "n", parentId: "doc", afterId: null }],
      ["moving into", { op: "move", id: "a", parentId: "sg", afterId: null }],
      ["deleting it", { op: "delete", id: "sg" }],
    ])("refuses %s", (_name, op) => {
      expect(edit([op as Operation])).toEqual(SUGGESTED);
      expect(services.suggestions.get("sg")?.state).toBe("pending");
    });

    it("refuses creating one", () => {
      expect(edit([{ op: "insert", block: { id: "x", type: "suggestion", props: { action: "insert" } }, parentId: "doc" }])).toEqual({
        ok: false,
        message: "A suggestion block can't be created here",
      });
    });

    it("moves a suggestion as a whole", () => {
      expect(edit([{ op: "move", id: "sg", parentId: "doc", afterId: null }])).toMatchObject({ ok: true });
      expect(services.blocks.getChildren("doc")[0]!.id).toBe("sg");
      expect(services.blocks.getChildren("sg").map((b) => b.id)).toEqual(["n"]);
    });

    it("lets the target be edited, which outdates the suggestion", () => {
      expect(edit([{ op: "update", id: "a", content: [{ text: "Changed" }] }])).toMatchObject({ ok: true });
      expect(services.suggestions.get("sg")?.state).toBe("outdated");
    });

    it("moves a block containing a suggestion, but won't delete it", () => {
      expect(edit([{ op: "insert", block: { id: "t", type: "toggle" }, parentId: "doc", afterId: null }])).toMatchObject({ ok: true });
      services.suggestions.suggest({
        pageId: "doc",
        action: "insert",
        insideId: "t",
        blocks: [{ id: "m", type: "paragraph", content: [{ text: "x" }] }],
        author: "builder",
      });
      expect(edit([{ op: "move", id: "t", parentId: "doc", afterId: "a" }])).toMatchObject({ ok: true });
      expect(edit([{ op: "delete", id: "t" }])).toEqual({ ok: false, message: "Approve or reject the suggestion inside first" });
    });
  });

  it("reports domain rejections and malformed input", () => {
    expect(edit([{ op: "update", id: "a", type: "divider" }])).toMatchObject({ ok: false, message: expect.stringContaining("cannot be turned into") });
    expect(applyEdit(services, { surface: "page", id: "doc", batch: [{ op: "explode" }] })).toEqual({ ok: false, message: "The edit couldn't be read" });
    expect(applyEdit(services, { surface: "nope", id: "doc", batch: [] })).toEqual({ ok: false, message: "Unknown page" });
  });

  it("edits a project's home page content but not its title, and a task's title and body", () => {
    const home = services.projects.get("P")!.homePageId;
    expect(editablePage(services, "project", "P")).toMatchObject({ title: false, tree: { block: { id: home } } });
    expect(edit([{ op: "insert", block: { id: "h1", type: "paragraph" }, parentId: home }], "project", "P")).toMatchObject({ ok: true });
    expect(edit([{ op: "update", id: home, content: [{ text: "x" }] }], "project", "P")).toEqual({
      ok: false,
      message: "This page's title can't be changed here",
    });

    services.tasks.create({ id: "W", projectId: "P", kind: "work", title: "Old" });
    const body = services.tasks.get("W")!.bodyPageId;
    expect(edit([{ op: "update", id: body, content: [{ text: "New title" }] }], "task", "W")).toMatchObject({ ok: true });
    expect(services.tasks.get("W")!.title).toBe("New title");
  });

  it("only edits browsable pages through the page surface", () => {
    services.tasks.create({ id: "W", projectId: "P", kind: "work", title: "T" });
    expect(editablePage(services, "page", services.tasks.get("W")!.bodyPageId)).toBeUndefined();
    expect(editablePage(services, "page", services.projects.get("P")!.libraryRootId)).toMatchObject({ title: false });
  });

  it("sends how references resolve with the editable tree", () => {
    edit([{ op: "insert", block: { id: "r", type: "reference", props: { targetId: "other" } }, parentId: "doc", afterId: "a" }]);
    expect(editablePage(services, "page", "doc")!.references).toEqual({ r: { status: "page", pageId: "other", title: [{ text: "Other" }] } });
  });

  describe("deleting pages", () => {
    it("counts the pages inside at every depth and goes back to the library", () => {
      expect(pageDeletion(services, "doc")).toEqual({ id: "doc", title: "Doc", nestedPages: 2, redirectTo: "/projects/P/library" });
      expect(pageDeletion(services, "deep")).toMatchObject({ nestedPages: 0, redirectTo: "/pages/sub" });
      expect(pageDeletion(services, "other")).toMatchObject({ redirectTo: "/" });
    });

    it("deletes the page with everything inside", () => {
      deletePage(services, "doc");
      for (const id of ["doc", "a", "sub", "deep", "s1"]) expect(services.blocks.getBlock(id)).toBeUndefined();
      expect(services.library.getLibraryTree("P")).toEqual([]);
    });

    it("refuses owned roots and task bodies", () => {
      services.tasks.create({ id: "W", projectId: "P", kind: "work", title: "T" });
      const project = services.projects.get("P")!;
      for (const id of [project.homePageId, project.libraryRootId, services.tasks.get("W")!.bodyPageId, "a", "nope"]) {
        expect(pageDeletion(services, id)).toBeUndefined();
        expect(deletePage(services, id)).toBeUndefined();
      }
      expect(services.blocks.getBlock(project.homePageId)).toBeDefined();
    });

    it("leaves references to deleted blocks missing", () => {
      services.tasks.create({ id: "W", projectId: "P", kind: "work", title: "T" });
      services.tasks.addReference("W", { kind: "block", id: "a" });
      deletePage(services, "doc");
      expect(services.tasks.relations("W", "references")[0]!.target).toEqual({ status: "missing", kind: "block", id: "a" });
    });
  });
});
