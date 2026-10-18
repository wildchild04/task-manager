import { beforeEach, describe, expect, it } from "vitest";

import { editablePage } from "../../app/lib/page-edit.server";
import { buildPageView } from "../../app/lib/page-view.server";
import { type AppServices, createInMemoryServices } from "~/composition";

const mention = (pageId: string) => ({ text: "￼", mention: { pageId } });

describe("mentions in page views", () => {
  let services: AppServices;

  beforeEach(() => {
    services = createInMemoryServices();
    services.blocks.apply([
      { op: "insert", block: { id: "arch", type: "page", content: [{ text: "Architecture" }] }, parentId: null },
      { op: "insert", block: { id: "doc", type: "page", content: [{ text: "Doc" }] }, parentId: null },
      { op: "insert", block: { id: "p", type: "paragraph", content: [{ text: "See " }, mention("arch")] }, parentId: "doc" },
    ]);
  });

  it("resolves each mentioned page's current title, following renames", () => {
    expect(buildPageView(services.blocks, "doc")!.mentions).toEqual({ arch: { title: "Architecture", href: "/pages/arch" } });
    services.blocks.apply([{ op: "update", id: "arch", content: [{ text: "System design" }] }]);
    expect(buildPageView(services.blocks, "doc")!.mentions).toEqual({ arch: { title: "System design", href: "/pages/arch" } });
  });

  it("marks a deleted page as missing", () => {
    services.blocks.apply([{ op: "delete", id: "arch" }]);
    expect(buildPageView(services.blocks, "doc")!.mentions).toEqual({ arch: null });
  });

  it("sends the titles with the editable page", () => {
    expect(editablePage(services, "page", "doc")!.mentions).toEqual({ arch: { title: "Architecture", href: "/pages/arch" } });
  });

  it("resolves mentions inside an expanded block reference", () => {
    services.blocks.apply([{ op: "insert", block: { id: "ref", type: "reference", props: { targetId: "p" } }, parentId: "arch" }]);
    expect(buildPageView(services.blocks, "arch")!.mentions).toEqual({ arch: { title: "Architecture", href: "/pages/arch" } });
  });

  it("resolves a mention of a task's description page to the task, following renames", () => {
    services.projects.create({ id: "P", title: "Taskhub" });
    services.tasks.create({ id: "W", projectId: "P", kind: "work", title: "Add login" });
    const body = services.tasks.get("W")!.bodyPageId;
    services.blocks.apply([
      { op: "insert", block: { id: "tm", type: "paragraph", content: [mention(body)] }, parentId: "doc", afterId: "p" },
      { op: "update", id: body, content: [{ text: "Add passkey login" }] },
    ]);
    expect(buildPageView(services.blocks, "doc")!.mentions[body]).toEqual({ title: "Add passkey login", href: "/tasks/W" });
  });
});
