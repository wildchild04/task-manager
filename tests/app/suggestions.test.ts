import { beforeEach, describe, expect, it } from "vitest";

import { editablePage } from "../../app/lib/page-edit.server";
import { buildPageView } from "../../app/lib/page-view.server";
import { decideSuggestion } from "../../app/lib/suggestions.server";
import { type AppServices, createInMemoryServices } from "~/composition";

describe("suggestions on screens", () => {
  let services: AppServices;
  const para = (id: string, text: string) => ({ id, type: "paragraph" as const, content: [{ text }] });

  beforeEach(() => {
    services = createInMemoryServices();
    services.blocks.apply([
      { op: "insert", block: { id: "P", type: "page", content: [{ text: "Plan" }] }, parentId: null },
      { op: "insert", block: para("A", "Ship on Monday"), parentId: "P" },
      { op: "insert", block: para("B", "Beta"), parentId: "P", afterId: "A" },
    ]);
    services.suggestions.suggest({
      id: "r",
      pageId: "P",
      action: "replace",
      targetId: "A",
      blocks: [para("n1", "Ship on Tuesday")],
      note: "Date moved",
      author: "builder",
    });
    services.suggestions.suggest({
      id: "i",
      pageId: "P",
      action: "insert",
      afterId: "B",
      blocks: [para("n2", "New")],
      author: "planner",
    });
  });

  it("builds each suggestion's view: its record, proposed blocks and the target as it is now", () => {
    const view = buildPageView(services.blocks, "P", services.suggestions)!;
    expect(view.blocks[1]).toMatchObject({
      kind: "suggestion",
      id: "r",
      author: "builder",
      action: "replace",
      note: "Date moved",
      outdated: false,
      targetId: "A",
      blocks: [{ kind: "content", content: [{ text: "Ship on Tuesday" }] }],
      removed: { kind: "content", id: "A", content: [{ text: "Ship on Monday" }] },
    });
    services.blocks.apply([{ op: "update", id: "A", content: [{ text: "Ship on Wednesday" }] }]);
    expect(buildPageView(services.blocks, "P", services.suggestions)!.blocks[1]).toMatchObject({ outdated: true });
  });

  it("gives the editor the page's suggestions by ID", () => {
    const page = editablePage(services, "page", "P")!;
    expect(page.pageId).toBe("P");
    expect(Object.keys(page.suggestions)).toEqual(["r", "i"]);
  });

  it("approves with undo, approves all reporting outdated ones, and refuses bad decisions", () => {
    expect(decideSuggestion(services, { intent: "approve", id: "i" })).toEqual({
      ok: true,
      message: "Suggestion approved",
      undo: "i",
    });
    expect(decideSuggestion(services, { intent: "reopen", id: "i" })).toEqual({ ok: true, message: "Undone" });
    services.blocks.apply([{ op: "update", id: "A", content: [{ text: "Changed" }] }]);
    expect(decideSuggestion(services, { intent: "approve-all", pageId: "P" })).toEqual({
      ok: true,
      message: "1 approved, 1 outdated",
    });
    expect(decideSuggestion(services, { intent: "approve", id: "r" })).toEqual({
      ok: false,
      message: "The block changed since it was suggested",
    });
    expect(decideSuggestion(services, { intent: "reject-all", pageId: "P" })).toEqual({ ok: true, message: "1 rejected" });
    expect(decideSuggestion(services, { intent: "explode" })).toEqual({ ok: false, message: "The decision couldn't be read" });
  });
});
