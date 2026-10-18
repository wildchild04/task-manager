import { beforeEach, describe, expect, it } from "vitest";

import { allPages, searchPages, workspacePageTree } from "../../app/lib/page-search.server";
import { type AppServices, createInMemoryServices } from "~/composition";

describe("page search", () => {
  let services: AppServices;

  beforeEach(() => {
    services = createInMemoryServices();
    services.projects.create({ id: "P", title: "Taskhub" });
    const library = services.projects.get("P")!.libraryRootId;
    services.blocks.apply([
      { op: "insert", block: { id: "arch", type: "page", content: [{ text: "Architecture" }] }, parentId: library },
      { op: "insert", block: { id: "auth", type: "page", content: [{ text: "Auth design" }] }, parentId: "arch" },
      { op: "insert", block: { id: "wp", type: "page", content: [{ text: "Welcome" }] }, parentId: null },
      { op: "insert", block: { id: "tog", type: "toggle", content: [{ text: "More" }] }, parentId: "wp" },
      { op: "insert", block: { id: "sub", type: "page", content: [{ text: "Search notes" }] }, parentId: "tog" },
    ]);
    services.tasks.create({ id: "W", projectId: "P", kind: "work", title: "Architecture review" });
  });

  it("lists workspace pages and library documents at any depth, with their place, but not task bodies", () => {
    expect(allPages(services)).toEqual([
      { id: "wp", title: "Welcome", place: "Pages", href: "/pages/wp" },
      { id: "sub", title: "Search notes", place: "Pages › Welcome", href: "/pages/sub" },
      { id: "arch", title: "Architecture", place: "Taskhub", href: "/pages/arch" },
      { id: "auth", title: "Auth design", place: "Taskhub › Architecture", href: "/pages/auth" },
    ]);
  });

  it("builds the workspace page tree with pages nested anywhere in their parent, in reading order", () => {
    services.blocks.apply([
      { op: "insert", block: { id: "deep", type: "page", content: [{ text: "Deep" }] }, parentId: "sub" },
      { op: "insert", block: { id: "top", type: "page", content: [{ text: "Top note" }] }, parentId: "wp" },
    ]);
    expect(workspacePageTree(services)).toEqual([
      {
        id: "wp",
        title: "Welcome",
        children: [
          { id: "top", title: "Top note", children: [] },
          { id: "sub", title: "Search notes", children: [{ id: "deep", title: "Deep", children: [] }] },
        ],
      },
    ]);
  });

  it("matches anywhere in the title, ignoring case, earliest match first", () => {
    const task = services.tasks.get("W")!;
    expect(searchPages(services, "ar").map((p) => p.href)).toEqual(["/pages/arch", "/tasks/W", "/pages/sub"]);
    expect(searchPages(services, "DESIGN").map((p) => p.id)).toEqual(["auth"]);
    expect(searchPages(services, "")).toHaveLength(5);
    expect(searchPages(services, "review")).toEqual([
      { id: task.bodyPageId, title: "Architecture review", place: "Task · work · Taskhub", href: "/tasks/W" },
    ]);
    expect(searchPages(services, "", 2)).toHaveLength(2);
  });
});
