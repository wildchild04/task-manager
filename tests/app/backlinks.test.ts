import { beforeEach, describe, expect, it } from "vitest";

import { pageBacklinks } from "../../app/lib/backlinks.server";
import { type AppServices, createInMemoryServices } from "~/composition";

const m = (pageId: string) => ({ text: "￼", mention: { pageId } });

describe("page backlinks", () => {
  let services: AppServices;

  beforeEach(() => {
    services = createInMemoryServices();
    services.projects.create({ id: "P", title: "Taskhub" });
    const library = services.projects.get("P")!.libraryRootId;
    services.blocks.apply([
      { op: "insert", block: { id: "arch", type: "page", content: [{ text: "Architecture" }] }, parentId: library },
      { op: "insert", block: { id: "pers", type: "page", content: [{ text: "Persistence" }] }, parentId: "arch" },
      { op: "insert", block: { id: "p1", type: "paragraph", content: [m("arch"), { text: " and " }, m("arch")] }, parentId: "pers" },
      { op: "insert", block: { id: "tog", type: "toggle", content: [{ text: "More" }] }, parentId: "pers", afterId: "p1" },
      { op: "insert", block: { id: "p2", type: "quote", content: [m("arch")] }, parentId: "tog" },
      { op: "insert", block: { id: "self", type: "paragraph", content: [{ text: "Itself: " }, m("arch")] }, parentId: "arch" },
    ]);
    services.tasks.create({ id: "W", projectId: "P", kind: "work", title: "Add login" });
    services.blocks.apply([
      { op: "insert", block: { id: "r", type: "reference", props: { targetId: "arch" } }, parentId: services.tasks.get("W")!.bodyPageId },
    ]);
  });

  it("lists each place once with its count, pages before tasks, leaving out the page itself", () => {
    expect(pageBacklinks(services, "arch")).toEqual([
      { kind: "page", id: "pers", title: "Persistence", href: "/pages/pers", count: 3 },
      { kind: "task", id: "W", title: "Add login", href: "/tasks/W", count: 1, taskKind: "work" },
    ]);
  });

  it("is empty when nothing points at the page", () => {
    expect(pageBacklinks(services, "pers")).toEqual([]);
  });

  it("lists where a task is mentioned, without the task's own description", () => {
    const body = services.tasks.get("W")!.bodyPageId;
    services.blocks.apply([
      { op: "insert", block: { id: "tm1", type: "paragraph", content: [m(body)] }, parentId: "pers" },
      { op: "insert", block: { id: "tm2", type: "paragraph", content: [{ text: "Me: " }, m(body)] }, parentId: body },
    ]);
    expect(pageBacklinks(services, body)).toEqual([{ kind: "page", id: "pers", title: "Persistence", href: "/pages/pers", count: 1 }]);
  });

  it("skips mentions inside pending suggestions until they're approved", () => {
    const body = services.tasks.get("W")!.bodyPageId;
    services.blocks.apply([{ op: "insert", block: { id: "plan", type: "page", content: [{ text: "Release plan" }] }, parentId: null }]);
    services.suggestions.suggest({
      id: "s",
      pageId: "plan",
      action: "insert",
      blocks: [{ id: "sp", type: "paragraph", content: [m("pers"), { text: " and " }, m(body)] }],
      author: "builder",
    });
    expect(pageBacklinks(services, "pers")).toEqual([]);
    expect(pageBacklinks(services, body)).toEqual([]);
    services.suggestions.approve("s");
    expect(pageBacklinks(services, "pers")).toEqual([{ kind: "page", id: "plan", title: "Release plan", href: "/pages/plan", count: 1 }]);
  });

  it("lists a page mentioned from a table cell", () => {
    services.blocks.apply([
      { op: "insert", block: { id: "garden", type: "page", content: [{ text: "Garden" }] }, parentId: null },
      { op: "insert", block: { id: "tbl", type: "table" }, parentId: "garden" },
      { op: "insert", block: { id: "row", type: "table_row" }, parentId: "tbl" },
      { op: "insert", block: { id: "cell", type: "table_cell", content: [m("pers")] }, parentId: "row" },
    ]);
    expect(pageBacklinks(services, "pers")).toEqual([
      { kind: "page", id: "garden", title: "Garden", href: "/pages/garden", count: 1 },
    ]);
  });

  it("skips comments", () => {
    services.comments.add({ id: "c", taskId: "W", blocks: [{ id: "cp", type: "paragraph", content: [m("pers")] }] });
    expect(pageBacklinks(services, "pers")).toEqual([]);
  });
});
