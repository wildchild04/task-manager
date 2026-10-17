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
    ["creating a page", [{ op: "insert", block: { id: "x", type: "page" }, parentId: "doc" }], "A page block can't be created here"],
    ["turning a block into a page", [{ op: "update", id: "a", type: "page" }], "A block can't be turned into a page"],
    ["deleting the page itself", [{ op: "delete", id: "doc" }], "Edits must stay inside the page"],
  ] as const)("refuses %s, changing nothing", (_, batch, message) => {
    const version = editablePage(services, "page", "doc")!.version;
    expect(edit([{ op: "update", id: "a", content: [{ text: "changed" }] }, ...(batch as unknown as Operation[])])).toEqual({ ok: false, message });
    expect(editablePage(services, "page", "doc")!.version).toBe(version);
  });

  it("refuses deleting a block that contains a sub-page", () => {
    edit([{ op: "move", id: "sub", parentId: "a", afterId: null }]);
    expect(edit([{ op: "delete", id: "a" }])).toEqual({ ok: false, message: "Sub-pages can't be deleted by editing; delete the page itself" });
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
