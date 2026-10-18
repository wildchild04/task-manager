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

  it("skips comments", () => {
    services.comments.add({ id: "c", taskId: "W", blocks: [{ id: "cp", type: "paragraph", content: [m("pers")] }] });
    expect(pageBacklinks(services, "pers")).toEqual([]);
  });
});
