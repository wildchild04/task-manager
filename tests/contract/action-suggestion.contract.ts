import { beforeEach, describe, expect, it } from "vitest";

import type { AppServices } from "~/composition";
import { plainText } from "~/domain/blocks/text";
import type { Schedule } from "~/domain/chores/schedule";
import { choreAttributes } from "~/domain/chores/schedule";
import { SuggestionError } from "~/domain/suggestions/errors";
import type { SuggestActionInput } from "~/domain/suggestions/suggestion.service";
import type { ActionPayload, Subject } from "~/domain/suggestions/types";

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

const weekly: Schedule = { type: "frequency", every: "weekly", weekday: 1, time: "09:00" };
const project = (id: string): Subject => ({ kind: "project", id });
const page = (id: string): Subject => ({ kind: "page", id });
const task = (id: string): Subject => ({ kind: "task", id });

export function actionSuggestionContract(name: string, factory: ServicesFactory) {
  describe(`${name}: action suggestion contract`, () => {
    let services: AppServices;
    let clock: number;

    const suggest = (id: string, subject: Subject, payload: ActionPayload, input: Partial<SuggestActionInput> = {}) =>
      services.suggestions.suggestAction({ id, subject, payload, author: "builder", ...input });
    const state = (id: string) => services.suggestions.get(id)!.state;
    const title = (pageId: string) => plainText(services.blocks.getBlock(pageId)!.content);

    beforeEach(() => {
      clock = 0;
      services = factory({ now: () => new Date(Date.UTC(2026, 9, 14, 8, 0, clock++)).toISOString(), timeZone: "UTC" });
      services.projects.create({ id: "P", title: "Garden" });
      const library = services.projects.get("P")!.libraryRootId;
      services.blocks.apply([
        { op: "insert", block: { id: "W", type: "page", content: [{ text: "Roadmap" }] }, parentId: null },
        { op: "insert", block: { id: "W1", type: "page", content: [{ text: "Inside" }] }, parentId: "W" },
        { op: "insert", block: { id: "D", type: "page", content: [{ text: "Architecture" }] }, parentId: library },
      ]);
      services.tasks.create({ id: "work", projectId: "P", kind: "work", title: "Old migration" });
      services.tasks.create({ id: "idea", projectId: "P", kind: "exploration", title: "Login" });
      services.tasks.create({ id: "chore", projectId: "P", kind: "chore", title: "Back up" });
      services.tasks.create({ id: "weekly", projectId: "P", kind: "chore", title: "Water", attributes: { schedule: weekly } });
    });

    describe("suggesting", () => {
      it("records a pending suggestion on the subject's place page, changing nothing", () => {
        const s = suggest("s", page("W"), { action: "rename", title: " Roadmap 2027 " }, { note: "Next year" });
        expect(s).toMatchObject({
          subject: { kind: "page", id: "W" },
          pageId: "W",
          action: "rename",
          payload: { action: "rename", title: "Roadmap 2027" },
          note: "Next year",
          author: "builder",
          state: "pending",
        });
        expect(title("W")).toBe("Roadmap");
        expect(suggest("p", project("P"), { action: "delete" }).pageId).toBe(services.projects.get("P")!.homePageId);
        expect(suggest("t", task("work"), { action: "delete" }).pageId).toBe(services.tasks.get("work")!.bodyPageId);
      });

      it("refuses a missing subject, and pages that aren't workspace pages or documents", () => {
        expectError(() => suggest("s", task("nope"), { action: "delete" }), "not_found");
        expectError(() => suggest("s", page(services.projects.get("P")!.homePageId), { action: "delete" }), "not_found");
        expectError(() => suggest("s", page(services.tasks.get("work")!.bodyPageId), { action: "rename", title: "X" }), "not_found");
        expect(suggest("s", page("D"), { action: "delete" }).state).toBe("pending");
      });

      it("refuses an empty title or a long note", () => {
        expectError(() => suggest("s", page("W"), { action: "rename", title: "  " }), "validation");
        expectError(() => suggest("s", page("W"), { action: "delete" }, { note: "x".repeat(281) }), "validation");
      });

      it("allows only the ending transition of each kind, from a state that has it", () => {
        expect(suggest("a", task("work"), { action: "transition", name: "cancel" }).state).toBe("pending");
        expect(suggest("b", task("idea"), { action: "transition", name: "tombstone" }).state).toBe("pending");
        expect(suggest("c", task("weekly"), { action: "transition", name: "cancel", scope: "series" }).state).toBe("pending");
        expectError(() => suggest("d", task("idea"), { action: "transition", name: "cancel" }), "validation");
        expectError(() => suggest("e", task("weekly"), { action: "transition", name: "cancel" }), "validation");
        expectError(() => suggest("f", task("chore"), { action: "transition", name: "cancel", scope: "series" }), "validation");
        expectError(() => suggest("g", page("W"), { action: "transition", name: "cancel" }), "validation");
        services.tasks.transition("work", "cancel");
        expectError(() => suggest("h", task("work"), { action: "transition", name: "cancel" }), "validation");
      });

      it("allows a schedule only for a chore in to do, and a valid one", () => {
        expect(suggest("a", task("chore"), { action: "schedule", schedule: weekly }).state).toBe("pending");
        expect(suggest("b", task("weekly"), { action: "schedule", schedule: null }).state).toBe("pending");
        expectError(() => suggest("c", task("work"), { action: "schedule", schedule: weekly }), "validation");
        expectError(
          () => suggest("d", task("chore"), { action: "schedule", schedule: { type: "time", time: "25:00" } as Schedule }),
          "validation",
        );
        services.tasks.transition("chore", "complete", { input: { next: false } });
        expectError(() => suggest("e", task("chore"), { action: "schedule", schedule: weekly }), "validation");
      });
    });

    describe("approving", () => {
      it("renames a project, a page and a task", () => {
        suggest("p", project("P"), { action: "rename", title: "Allotment" });
        suggest("w", page("W"), { action: "rename", title: "Roadmap 2027" });
        suggest("t", task("idea"), { action: "rename", title: "Passkey login" });
        for (const id of ["p", "w", "t"]) expect(services.suggestions.approve(id).status).toBe("approved");
        expect(services.projects.get("P")!.title).toBe("Allotment");
        expect(title("W")).toBe("Roadmap 2027");
        expect(services.tasks.get("idea")!.title).toBe("Passkey login");
      });

      it("deletes a page with the pages inside it, a task, and a project with everything in it", () => {
        suggest("w", page("W"), { action: "delete" });
        services.suggestions.approve("w");
        expect(services.blocks.getBlock("W")).toBeUndefined();
        expect(services.blocks.getBlock("W1")).toBeUndefined();

        suggest("t", task("work"), { action: "delete" });
        services.suggestions.approve("t");
        expect(services.tasks.get("work")).toBeUndefined();

        suggest("p", project("P"), { action: "delete" });
        expect(services.suggestions.approve("p").status).toBe("approved");
        expect(services.projects.get("P")).toBeUndefined();
        expect(services.tasks.get("idea")).toBeUndefined();
      });

      it("changes a chore's schedule as editing it would", () => {
        suggest("s", task("chore"), { action: "schedule", schedule: weekly });
        services.suggestions.approve("s");
        expect(choreAttributes(services.tasks.get("chore")!)).toMatchObject({ schedule: weekly, dueAt: "2026-10-19T09:00:00.000Z" });
      });

      it("applies an ending transition as the human", () => {
        suggest("a", task("work"), { action: "transition", name: "cancel" });
        suggest("b", task("weekly"), { action: "transition", name: "cancel", scope: "series" });
        services.suggestions.approve("a");
        services.suggestions.approve("b");
        expect(services.tasks.get("work")!.state).toBe("cancelled");
        expect(services.tasks.history("work").at(-1)).toMatchObject({ name: "cancel", actor: { kind: "human" } });
        expect(services.tasks.get("weekly")!.state).toBe("cancelled");
        expect(services.chores.series("weekly")).toHaveLength(1);
      });

      it("offers no undo, and can't be approved twice", () => {
        suggest("w", page("W"), { action: "rename", title: "Roadmap 2027" });
        services.suggestions.approve("w");
        expectError(() => services.suggestions.reopen("w"), "validation");
        expectError(() => services.suggestions.approve("w"), "resolved");
      });
    });

    describe("outdated", () => {
      it("follows competing renames", () => {
        suggest("a", task("idea"), { action: "rename", title: "Passkey login" });
        suggest("b", task("idea"), { action: "rename", title: "OAuth login" }, { author: "planner" });
        services.suggestions.approve("a");
        expect(state("b")).toBe("outdated");
        expectError(() => services.suggestions.approve("b"), "outdated");
        expect(services.tasks.get("idea")!.title).toBe("Passkey login");
      });

      it("follows a changed state or schedule", () => {
        suggest("t", task("work"), { action: "transition", name: "cancel" });
        suggest("s", task("weekly"), { action: "schedule", schedule: null });
        services.tasks.transition("work", "start");
        services.chores.setSchedule("weekly", { type: "frequency", every: "daily", time: "09:00" });
        expect(state("t")).toBe("outdated");
        expect(state("s")).toBe("outdated");
      });

      it("drops out of the pending list once its subject is gone, and can still be withdrawn", () => {
        suggest("w", page("W1"), { action: "rename", title: "Within" });
        expect(services.suggestions.listPending().map((s) => s.id)).toEqual(["w"]);
        expect(services.suggestions.pendingActions("W1").map((s) => s.id)).toEqual(["w"]);
        services.blocks.apply([{ op: "delete", id: "W" }]);
        expect(state("w")).toBe("outdated");
        expect(services.suggestions.listPending()).toEqual([]);
        expect(services.suggestions.withdraw("w", "builder").status).toBe("withdrawn");
      });
    });

    describe("rejecting and withdrawing", () => {
      it("rejects, changing only the record", () => {
        suggest("p", project("P"), { action: "delete" });
        expect(services.suggestions.reject("p").status).toBe("rejected");
        expect(services.projects.get("P")).toBeDefined();
        expect(services.suggestions.listPending()).toEqual([]);
      });

      it("withdraws only the author's own", () => {
        suggest("t", task("work"), { action: "delete" });
        expectError(() => services.suggestions.withdraw("t", "planner"), "forbidden");
        expect(services.suggestions.withdraw("t", "builder").status).toBe("withdrawn");
        expect(services.tasks.get("work")).toBeDefined();
      });

      it("keeps action suggestions out of a page's approve all", () => {
        suggest("w", page("W"), { action: "rename", title: "Roadmap 2027" });
        expect(services.suggestions.approveAll("W")).toEqual({ approved: 0, outdated: 0 });
        expect(state("w")).toBe("pending");
      });
    });
  });
}
