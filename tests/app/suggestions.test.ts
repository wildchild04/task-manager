import { beforeEach, describe, expect, it } from "vitest";

import { actionSuggestionItems } from "../../app/lib/action-suggestions.server";
import { editablePage } from "../../app/lib/page-edit.server";
import { buildPageView } from "../../app/lib/page-view.server";
import { decideSuggestion } from "../../app/lib/suggestions.server";
import { type AppServices, createInMemoryServices } from "~/composition";
import type { ActionPayload, Subject } from "~/domain/suggestions/types";

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

  it("shows a replaced table with its rows in the removed copy", () => {
    services.blocks.apply([
      { op: "insert", block: { id: "T", type: "table" }, parentId: "P", afterId: "B" },
      { op: "insert", block: { id: "R", type: "table_row" }, parentId: "T" },
      { op: "insert", block: { id: "C", type: "table_cell", content: [{ text: "old" }] }, parentId: "R" },
    ]);
    services.suggestions.suggest({ id: "t", pageId: "P", action: "replace", targetId: "T", blocks: [para("n3", "New")], author: "claude" });
    const view = buildPageView(services.blocks, "P", services.suggestions)!.blocks.find((b) => b.kind === "suggestion" && b.id === "t");
    expect(view).toMatchObject({ removed: { kind: "content", type: "table", children: [{ id: "R", children: [{ id: "C" }] }] } });
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

  it("requests changes, shows the feedback and then what a revision answered, and skips it in approve all", () => {
    expect(decideSuggestion(services, { intent: "request-changes", id: "i", text: "  " })).toEqual({
      ok: false,
      message: "Say what should change",
    });
    expect(decideSuggestion(services, { intent: "request-changes", id: "i", text: "Make it two paragraphs" })).toEqual({
      ok: true,
      message: "Changes requested",
    });
    const box = () => buildPageView(services.blocks, "P", services.suggestions)!.blocks.find((b) => b.id === "i");
    expect(box()).toMatchObject({ state: "changes_requested", outdated: false, feedback: "Make it two paragraphs", answered: null });
    expect(decideSuggestion(services, { intent: "approve-all", pageId: "P" })).toEqual({
      ok: true,
      message: "1 approved, 1 waiting for changes",
    });
    services.suggestions.revise({ id: "i", author: "planner", blocks: [para("n3", "One"), para("n4", "Two")] });
    expect(box()).toMatchObject({ state: "pending", feedback: null, answered: "Make it two paragraphs" });
  });
});

describe("action suggestions on screens", () => {
  let services: AppServices;
  const weekly = { type: "frequency" as const, every: "weekly" as const, weekday: 1, time: "09:00" };

  beforeEach(() => {
    services = createInMemoryServices({ timeZone: "UTC" });
    services.projects.create({ id: "P", title: "Garden" });
    services.blocks.apply([
      { op: "insert", block: { id: "W", type: "page", content: [{ text: "Scratch" }] }, parentId: null },
      { op: "insert", block: { id: "W1", type: "page", content: [{ text: "Inside" }] }, parentId: "W" },
    ]);
    services.tasks.create({ id: "idea", projectId: "P", kind: "exploration", title: "Login" });
    services.tasks.create({ id: "chore", projectId: "P", kind: "chore", title: "Back up" });
  });

  it("describes each suggestion for its bar, on its subject's place page", () => {
    const idea = services.tasks.get("idea")!.bodyPageId;
    const chore = services.tasks.get("chore")!.bodyPageId;
    const add = (id: string, subject: Subject, payload: ActionPayload) =>
      services.suggestions.suggestAction({ id, subject, payload, author: "claude", note: id === "t" ? "Superseded" : undefined });
    add("r", { kind: "task", id: "idea" }, { action: "rename", title: "Passkey login" });
    add("t", { kind: "task", id: "idea" }, { action: "transition", name: "tombstone" });
    add("s", { kind: "task", id: "chore" }, { action: "schedule", schedule: weekly });
    add("n", { kind: "task", id: "chore" }, { action: "schedule", schedule: null });
    add("d", { kind: "page", id: "W" }, { action: "delete" });
    add("p", { kind: "project", id: "P" }, { action: "rename", title: "Allotment" });

    expect(actionSuggestionItems(services, idea)).toEqual([
      {
        id: "r",
        author: "claude",
        action: "rename",
        words: 'renaming this exploration to "Passkey login"',
        note: null,
        outdated: false,
        state: "pending",
        feedback: null,
        answered: null,
      },
      {
        id: "t",
        author: "claude",
        action: "transition",
        words: "tombstoning this exploration",
        note: "Superseded",
        outdated: false,
        state: "pending",
        feedback: null,
        answered: null,
      },
    ]);
    expect(actionSuggestionItems(services, chore).map((i) => i.words)).toEqual([
      "changing the schedule to Every Monday at 09:00",
      "removing the schedule",
    ]);
    expect(actionSuggestionItems(services, "W").map((i) => i.words)).toEqual(["deleting this page"]);
    services.suggestions.requestChanges("d", "Keep it, archive instead");
    expect(actionSuggestionItems(services, "W")).toMatchObject([
      { state: "changes_requested", feedback: "Keep it, archive instead", answered: null },
    ]);
    expect(actionSuggestionItems(services, services.projects.get("P")!.homePageId).map((i) => i.words)).toEqual([
      'renaming this project to "Allotment"',
    ]);
  });

  it("approves a deletion, saying where to go, with no undo; rejects with no undo", () => {
    services.suggestions.suggestAction({ id: "d", subject: { kind: "page", id: "W1" }, payload: { action: "delete" }, author: "claude" });
    services.suggestions.suggestAction({ id: "t", subject: { kind: "task", id: "idea" }, payload: { action: "delete" }, author: "claude" });
    services.suggestions.suggestAction({
      id: "r",
      subject: { kind: "task", id: "chore" },
      payload: { action: "rename", title: "Back up the database" },
      author: "claude",
    });
    expect(decideSuggestion(services, { intent: "approve", id: "d" })).toEqual({
      ok: true,
      message: "Suggestion approved",
      redirectTo: "/pages/W",
    });
    expect(services.blocks.getBlock("W1")).toBeUndefined();
    expect(decideSuggestion(services, { intent: "approve", id: "t" })).toMatchObject({ redirectTo: "/projects/P/explorations" });
    expect(decideSuggestion(services, { intent: "reject", id: "r" })).toEqual({ ok: true, message: "Suggestion rejected" });
    expect(decideSuggestion(services, { intent: "approve", id: "r" })).toMatchObject({ ok: false });
  });
});
