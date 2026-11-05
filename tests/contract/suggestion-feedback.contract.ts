import { beforeEach, describe, expect, it } from "vitest";

import type { AppServices } from "~/composition";
import { plainText } from "~/domain/blocks/text";
import type { TreeNode } from "~/domain/blocks/types";
import type { Schedule } from "~/domain/chores/schedule";
import { SuggestionError } from "~/domain/suggestions/errors";
import type { ReviseInput } from "~/domain/suggestions/suggestion.service";
import type { SuggestionBlockInput } from "~/domain/suggestions/types";

import type { ServicesFactory } from "./project.contract";

function expectError(run: () => unknown, code: SuggestionError["code"]) {
  let error: unknown;
  try {
    run();
  } catch (e) {
    error = e;
  }
  expect(error).toBeInstanceOf(SuggestionError);
  expect((error as SuggestionError).code).toBe(code);
}

const bullet = (id: string, text: string): SuggestionBlockInput => ({ id, type: "bulleted_list_item", content: [{ text }] });
const numbered = (id: string, text: string): SuggestionBlockInput => ({ id, type: "numbered_list_item", content: [{ text }] });
const weekly: Schedule = { type: "frequency", every: "weekly", weekday: 1, time: "09:00" };
const daily: Schedule = { type: "frequency", every: "daily", time: "08:00" };

/** A page's content as "type:text" lines, children indented, suggestions by ID. */
function outline(node: TreeNode | undefined, depth = 0): string[] {
  return (node?.children ?? []).flatMap((child) => {
    const { block } = child;
    const label = block.type === "suggestion" ? `suggestion:${block.id}` : `${block.type}:${plainText(block.content)}`;
    return [`${"  ".repeat(depth)}${label}`, ...outline(child, depth + 1)];
  });
}

export function suggestionFeedbackContract(name: string, factory: ServicesFactory) {
  describe(`${name}: suggestion feedback contract`, () => {
    let services: AppServices;
    let clock: number;

    const s = () => services.suggestions;
    const page = () => outline(services.blocks.loadTree("P"));
    const revise = (input: Omit<ReviseInput, "author"> & { author?: string }) => s().revise({ author: "builder", ...input });

    beforeEach(() => {
      clock = 0;
      services = factory({ now: () => new Date(Date.UTC(2026, 10, 4, 8, 0, clock++)).toISOString(), timeZone: "UTC" });
      services.projects.create({ id: "G", title: "Garden" });
      services.tasks.create({ id: "chore", projectId: "G", kind: "chore", title: "Back up" });
      services.blocks.apply([
        { op: "insert", block: { id: "P", type: "page", content: [{ text: "Scratch" }] }, parentId: null },
        { op: "insert", block: { id: "A", type: "paragraph", content: [{ text: "Alpha" }] }, parentId: "P" },
        { op: "insert", block: { id: "B", type: "paragraph", content: [{ text: "Ship on Monday" }] }, parentId: "P", afterId: "A" },
      ]);
      s().suggest({ id: "ins", pageId: "P", action: "insert", afterId: "A", blocks: [bullet("b1", "One")], author: "builder" });
      s().suggest({ id: "rep", pageId: "P", action: "replace", targetId: "B", blocks: [bullet("b2", "Ship")], author: "builder" });
      s().suggestAction({
        id: "ren",
        subject: { kind: "page", id: "P" },
        payload: { action: "rename", title: "Notes from the Monday planning meeting" },
        author: "builder",
      });
    });

    describe("requesting changes", () => {
      it("records trimmed feedback on the current revision, changing nothing else", () => {
        const before = page();
        const view = s().requestChanges("ren", "  Shorter, please: two or three words  ");
        expect(view).toMatchObject({ state: "changes_requested", revision: 1, outdated: false, answered: null });
        expect(view.feedback).toEqual([
          { id: expect.any(String), suggestionId: "ren", text: "Shorter, please: two or three words", revision: 1, createdAt: expect.any(String) },
        ]);
        expect(page()).toEqual(before);
        expect(plainText(services.blocks.getBlock("P")!.content)).toBe("Scratch");
      });

      it("keeps more feedback, oldest first", () => {
        s().requestChanges("ins", "Use a numbered list");
        s().requestChanges("ins", "And add a second item");
        expect(s().get("ins")!.feedback.map((f) => f.text)).toEqual(["Use a numbered list", "And add a second item"]);
      });

      it("refuses empty, too long, and resolved", () => {
        expectError(() => s().requestChanges("ins", "   "), "validation");
        expectError(() => s().requestChanges("ins", "x".repeat(2001)), "validation");
        expect(() => s().requestChanges("ins", "x".repeat(2000))).not.toThrow();
        s().reject("rep");
        expectError(() => s().requestChanges("rep", "Too late"), "resolved");
        expect(s().get("rep")!.feedback).toEqual([]);
        expectError(() => s().requestChanges("nope", "Hm"), "not_found");
      });

      it("takes precedence over outdated, which still blocks approving", () => {
        services.blocks.apply([{ op: "update", id: "B", content: [{ text: "Ship on Tuesday" }] }]);
        const view = s().requestChanges("rep", "Keep the day");
        expect(view).toMatchObject({ state: "changes_requested", outdated: true });
        expectError(() => s().approve("rep"), "outdated");
      });

      it("can still be approved or rejected", () => {
        s().requestChanges("ins", "Use a numbered list");
        expect(s().approve("ins").state).toBe("approved");
        expect(page()).toEqual([
          "paragraph:Alpha",
          "bulleted_list_item:One",
          "paragraph:Ship on Monday",
          "suggestion:rep",
          "  bulleted_list_item:Ship",
        ]);
        s().requestChanges("ren", "Shorter");
        expect(s().reject("ren").state).toBe("rejected");
        expect(s().get("ren")!.feedback).toEqual([]);
      });
    });

    describe("revising", () => {
      it("revises a rename in place, answering the feedback", () => {
        s().requestChanges("ren", "Shorter, please");
        const view = revise({ id: "ren", title: " Planning notes ", note: "Shortened as asked" });
        expect(view).toMatchObject({
          id: "ren",
          state: "pending",
          revision: 2,
          revisedAt: expect.any(String),
          note: "Shortened as asked",
          payload: { action: "rename", title: "Planning notes" },
          feedback: [],
        });
        expect(view.answered?.text).toBe("Shorter, please");
        s().approve("ren");
        expect(plainText(services.blocks.getBlock("P")!.content)).toBe("Planning notes");
      });

      it("replaces an insert's proposed blocks where it is", () => {
        s().requestChanges("ins", "Use a numbered list");
        revise({ id: "ins", blocks: [numbered("n1", "First"), numbered("n2", "Second")] });
        expect(page()).toEqual([
          "paragraph:Alpha",
          "suggestion:ins",
          "  numbered_list_item:First",
          "  numbered_list_item:Second",
          "paragraph:Ship on Monday",
          "suggestion:rep",
          "  bulleted_list_item:Ship",
        ]);
        expect(services.blocks.getBlock("b1")).toBeUndefined();
        expect(s().get("ins")!.state).toBe("pending");
      });

      it("rebases an outdated replace on its target as it is now", () => {
        services.blocks.apply([{ op: "update", id: "B", content: [{ text: "Ship on Tuesday" }] }]);
        expect(s().get("rep")!.state).toBe("outdated");
        revise({ id: "rep", blocks: [bullet("b3", "Ship Tuesday")] });
        expect(s().get("rep")).toMatchObject({ state: "pending", outdated: false });
        s().approve("rep");
        expect(page()).toEqual(["paragraph:Alpha", "suggestion:ins", "  bulleted_list_item:One", "bulleted_list_item:Ship Tuesday"]);
      });

      it("revises a delete's note only", () => {
        s().suggest({ id: "del", pageId: "P", action: "delete", targetId: "A", author: "builder", note: "Unused" });
        expectError(() => revise({ id: "del", blocks: [bullet("x", "No")] }), "validation");
        expect(revise({ id: "del", note: "Duplicated below" })).toMatchObject({ note: "Duplicated below", revision: 2 });
      });

      it("revises a schedule suggestion", () => {
        s().suggestAction({ id: "sch", subject: { kind: "task", id: "chore" }, payload: { action: "schedule", schedule: weekly }, author: "builder" });
        expect(revise({ id: "sch", schedule: daily })).toMatchObject({ payload: { action: "schedule", schedule: daily } });
      });

      it("refuses fields that don't fit, nothing to change, other agents and resolved ones", () => {
        expectError(() => revise({ id: "ren", blocks: [bullet("x", "No")] }), "validation");
        expectError(() => revise({ id: "ren", schedule: weekly }), "validation");
        expectError(() => revise({ id: "ins", title: "No" }), "validation");
        expectError(() => revise({ id: "ins", blocks: [] }), "validation");
        expectError(() => revise({ id: "ins", blocks: [{ id: "pg", type: "page", content: [] }] }), "validation");
        expectError(() => revise({ id: "ins" }), "validation");
        expectError(() => revise({ id: "ins", note: "x".repeat(281) }), "validation");
        expectError(() => revise({ id: "ren", title: "  " }), "validation");
        expectError(() => revise({ id: "ins", author: "reviewer", note: "Mine now" }), "forbidden");
        s().withdraw("rep", "builder");
        expectError(() => revise({ id: "rep", note: "Back" }), "resolved");
        expect(s().get("ins")).toMatchObject({ revision: 1, note: null });
        expect(page()).toEqual(["paragraph:Alpha", "suggestion:ins", "  bulleted_list_item:One", "paragraph:Ship on Monday"]);
      });

      it("refuses a replace whose target is gone", () => {
        services.blocks.apply([{ op: "delete", id: "B" }]);
        expectError(() => revise({ id: "rep", blocks: [bullet("b3", "Again")] }), "validation");
      });

      it("keeps answered feedback until new feedback comes", () => {
        s().requestChanges("ins", "Use a numbered list");
        revise({ id: "ins", note: "Done" });
        s().requestChanges("ins", "Two items");
        expect(s().get("ins")).toMatchObject({ state: "changes_requested", answered: null });
        expect(s().get("ins")!.feedback.map((f) => f.text)).toEqual(["Two items"]);
      });
    });

    describe("listing and approving all", () => {
      it("lists an agent's own open suggestions, by state", () => {
        s().suggest({ id: "other", pageId: "P", action: "insert", blocks: [bullet("o", "Theirs")], author: "reviewer" });
        s().requestChanges("ren", "Shorter");
        s().reject("rep");
        expect(s().listByAuthor("builder").map((v) => v.id)).toEqual(["ins", "ren"]);
        expect(s().listByAuthor("builder", "changes_requested").map((v) => v.id)).toEqual(["ren"]);
        expect(s().listByAuthor("builder", "pending").map((v) => v.id)).toEqual(["ins"]);
        expect(s().listByAuthor("reviewer").map((v) => v.id)).toEqual(["other"]);
      });

      it("approve all skips suggestions waiting for changes", () => {
        s().requestChanges("rep", "Keep the day");
        expect(s().approveAll("P")).toEqual({ approved: 1, outdated: 0, waiting: 1 });
        expect(s().get("rep")!.state).toBe("changes_requested");
      });
    });
  });
}
