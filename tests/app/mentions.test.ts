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
    expect(buildPageView(services.blocks, "doc")!.mentions).toEqual({ arch: "Architecture" });
    services.blocks.apply([{ op: "update", id: "arch", content: [{ text: "System design" }] }]);
    expect(buildPageView(services.blocks, "doc")!.mentions).toEqual({ arch: "System design" });
  });

  it("marks a deleted page as missing", () => {
    services.blocks.apply([{ op: "delete", id: "arch" }]);
    expect(buildPageView(services.blocks, "doc")!.mentions).toEqual({ arch: null });
  });

  it("sends the titles with the editable page", () => {
    expect(editablePage(services, "page", "doc")!.mentions).toEqual({ arch: "Architecture" });
  });

  it("resolves mentions inside an expanded block reference", () => {
    services.blocks.apply([{ op: "insert", block: { id: "ref", type: "reference", props: { targetId: "p" } }, parentId: "arch" }]);
    expect(buildPageView(services.blocks, "arch")!.mentions).toEqual({ arch: "Architecture" });
  });
});
