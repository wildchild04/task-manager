import { beforeEach, describe, expect, it } from "vitest";

import type { AppServices } from "~/composition";
import { choreAttributes } from "~/domain/chores/schedule";
import type { Schedule } from "~/domain/chores/schedule";
import { TaskError } from "~/domain/tasks/errors";

import type { ServicesFactory } from "./project.contract";

function expectTaskError(run: () => unknown, code: TaskError["code"]) {
  let error: unknown;
  try {
    run();
  } catch (e) {
    error = e;
  }
  expect(error).toBeInstanceOf(TaskError);
  expect((error as TaskError).code).toBe(code);
}

const weekly: Schedule = { type: "frequency", every: "weekly", weekday: 1, time: "09:00" };
const daily: Schedule = { type: "frequency", every: "daily", time: "09:00" };

export function choreContract(name: string, factory: ServicesFactory) {
  describe(`${name}: chore scheduling contract`, () => {
    let services: AppServices;
    let clock: string;
    /** Sets the clock; 2026-10-14 is a Wednesday. */
    const setNow = (iso: string) => (clock = iso);

    const chore = (id: string, attributes: Record<string, unknown> = {}) =>
      services.tasks.create({ id, projectId: "P", kind: "chore", title: id, attributes });
    const attrs = (id: string) => services.chores.attributes(id)!;
    const followers = (seriesId: string) => services.chores.series(seriesId).filter((t) => t.id !== seriesId);

    beforeEach(() => {
      clock = "2026-10-14T08:00:00.000Z";
      services = factory({ now: () => clock, timeZone: "UTC" });
      services.projects.create({ id: "P", title: "Project" });
    });

    describe("attributes", () => {
      it("gives a plain chore its defaults", () => {
        chore("C");
        expect(attrs("C")).toEqual({ urgency: "normal", baseUrgency: "normal", seriesId: "C" });
      });

      it("rejects an invalid urgency or schedule", () => {
        expectTaskError(() => chore("C", { urgency: "critical" }), "validation");
        expectTaskError(() => chore("C", { schedule: { type: "time", time: "25:00" } }), "validation");
      });

      it("ignores given derived fields and computes them", () => {
        chore("C", { schedule: { type: "timer", minutes: 30 }, seriesId: "other", dueAt: "2000-01-01T00:00:00.000Z" });
        expect(attrs("C")).toMatchObject({ seriesId: "C", dueAt: "2026-10-14T08:30:00.000Z" });
      });
    });

    describe("schedule types", () => {
      it.each([
        ["specific time later today", { type: "time", time: "09:00" }, "2026-10-14T08:00:00.000Z", "2026-10-14T09:00:00.000Z"],
        ["specific time already passed", { type: "time", time: "09:00" }, "2026-10-14T10:00:00.000Z", "2026-10-15T09:00:00.000Z"],
        ["specific date", { type: "date", date: "2026-11-03", time: "14:30" }, "2026-10-14T10:00:00.000Z", "2026-11-03T14:30:00.000Z"],
        ["timer", { type: "timer", minutes: 30 }, "2026-10-14T10:00:00.000Z", "2026-10-14T10:30:00.000Z"],
        ["weekly on Monday from a Wednesday", weekly, "2026-10-14T10:00:00.000Z", "2026-10-19T09:00:00.000Z"],
        ["monthly on the 31st in February", { type: "frequency", every: "monthly", dayOfMonth: 31, time: "09:00" }, "2026-02-10T10:00:00.000Z", "2026-02-28T09:00:00.000Z"],
        ["every 6 hours", { type: "interval", amount: 6, unit: "hours" }, "2026-10-14T10:00:00.000Z", "2026-10-14T16:00:00.000Z"],
      ])("%s", (_label, schedule, now, due) => {
        setNow(now);
        chore("C", { schedule });
        expect(attrs("C").dueAt).toBe(due);
      });
    });

    describe("overdue chores are urgent", () => {
      it("reports an overdue chore as urgent without changing its stored urgency", () => {
        chore("C", { schedule: { type: "time", time: "09:00" } });
        setNow("2026-10-14T09:01:00.000Z");
        expect(services.chores.isUrgent(services.tasks.get("C")!)).toBe(true);
        expect(attrs("C").urgency).toBe("normal");
      });

      it("does not report done chores as overdue", () => {
        chore("C", { schedule: { type: "timer", minutes: 1 } });
        setNow("2026-10-14T09:00:00.000Z");
        services.tasks.transition("C", "complete");
        expect(services.chores.isUrgent(services.tasks.get("C")!)).toBe(false);
      });
    });

    describe("next occurrence", () => {
      it("creates tomorrow's daily chore when completed on time", () => {
        setNow("2026-10-14T08:00:00.000Z");
        chore("C", { schedule: daily });
        setNow("2026-10-14T09:15:00.000Z");
        services.tasks.transition("C", "complete");
        const [next] = followers("C");
        expect(next).toMatchObject({ kind: "chore", state: "todo", title: "C", projectId: "P" });
        expect(choreAttributes(next!)).toMatchObject({ seriesId: "C", dueAt: "2026-10-15T09:00:00.000Z", schedule: daily });
      });

      it("skips missed slots", () => {
        setNow("2026-10-12T08:00:00.000Z"); // Monday
        chore("C", { schedule: daily });
        setNow("2026-10-15T10:00:00.000Z"); // Thursday
        services.tasks.transition("C", "complete");
        expect(choreAttributes(followers("C")[0]!).dueAt).toBe("2026-10-16T09:00:00.000Z");
      });

      it("keeps an interval's rhythm", () => {
        setNow("2026-10-14T06:00:00.000Z");
        chore("C", { schedule: { type: "interval", amount: 6, unit: "hours" } }); // due 12:00
        setNow("2026-10-14T12:30:00.000Z");
        services.tasks.transition("C", "complete");
        expect(choreAttributes(followers("C")[0]!).dueAt).toBe("2026-10-14T18:00:00.000Z");
      });

      it("copies the body page as new blocks", () => {
        const task = chore("C", { schedule: daily });
        services.blocks.apply([
          { op: "insert", block: { id: "t1", type: "todo", content: [{ text: "Bump deps" }] }, parentId: task.bodyPageId },
          { op: "insert", block: { id: "t2", type: "todo", content: [{ text: "Run tests" }] }, parentId: task.bodyPageId, afterId: "t1" },
          { op: "insert", block: { id: "t2a", type: "paragraph", content: [{ text: "all of them" }] }, parentId: "t2" },
        ]);
        services.tasks.transition("C", "complete");
        const next = followers("C")[0]!;
        const tree = services.blocks.loadTree(next.bodyPageId)!;
        expect(tree.children!.map((n) => n.block.content[0]?.text)).toEqual(["Bump deps", "Run tests"]);
        expect(tree.children![1]!.children!.map((n) => n.block.content[0]?.text)).toEqual(["all of them"]);
        expect(tree.children!.map((n) => n.block.id)).not.toContain("t1");
        expect(services.blocks.getChildren(task.bodyPageId).map((b) => b.id)).toEqual(["t1", "t2"]);
      });

      it("does not repeat a one-off chore by default", () => {
        chore("C", { schedule: { type: "timer", minutes: 30 } });
        services.tasks.transition("C", "complete");
        expect(followers("C")).toEqual([]);
      });

      it("repeats a timer chore when asked", () => {
        chore("C", { schedule: { type: "timer", minutes: 30 } });
        setNow("2026-10-14T11:00:00.000Z");
        services.tasks.transition("C", "complete", { input: { next: true } });
        expect(choreAttributes(followers("C")[0]!).dueAt).toBe("2026-10-14T11:30:00.000Z");
      });

      it("repeats a chore without a schedule with no due time", () => {
        chore("C");
        services.tasks.transition("C", "complete", { input: { next: true } });
        expect(choreAttributes(followers("C")[0]!)).toEqual({ urgency: "normal", baseUrgency: "normal", seriesId: "C" });
      });

      it("stops a recurring chore when told not to continue", () => {
        chore("C", { schedule: weekly });
        services.tasks.transition("C", "complete", { input: { next: false } });
        expect(services.tasks.get("C")?.state).toBe("done");
        expect(followers("C")).toEqual([]);
      });

      it("rejects repeating a specific-date chore", () => {
        chore("C", { schedule: { type: "date", date: "2026-11-03", time: "14:30" } });
        expectTaskError(() => services.tasks.transition("C", "complete", { input: { next: true } }), "validation");
        expect(services.tasks.get("C")?.state).toBe("todo");
        expect(followers("C")).toEqual([]);
      });

      it("does not carry a promotion to urgent over", () => {
        chore("C", { schedule: weekly });
        services.chores.setUrgency("C", "urgent");
        services.tasks.transition("C", "complete");
        expect(choreAttributes(followers("C")[0]!)).toMatchObject({ urgency: "normal", baseUrgency: "normal", schedule: weekly });
      });

      it("keeps a configured urgent base urgency", () => {
        chore("C", { schedule: weekly, urgency: "urgent" });
        services.tasks.transition("C", "complete");
        expect(choreAttributes(followers("C")[0]!).urgency).toBe("urgent");
      });
    });

    describe("cancel scope", () => {
      it("skips one occurrence", () => {
        chore("C", { schedule: weekly });
        services.tasks.transition("C", "cancel", { input: { scope: "occurrence" } });
        expect(services.tasks.get("C")?.state).toBe("cancelled");
        expect(choreAttributes(followers("C")[0]!).dueAt).toBe("2026-10-26T09:00:00.000Z");
      });

      it("ends the series", () => {
        chore("C", { schedule: weekly });
        services.tasks.transition("C", "cancel", { input: { scope: "series" } });
        expect(services.tasks.get("C")?.state).toBe("cancelled");
        expect(followers("C")).toEqual([]);
      });

      it("rejects series scope on a one-off chore", () => {
        chore("C", { schedule: { type: "date", date: "2026-11-03", time: "14:30" } });
        expectTaskError(() => services.tasks.transition("C", "cancel", { input: { scope: "series" } }), "validation");
      });

      it("cancels a one-off occurrence without a follower", () => {
        chore("C", { schedule: { type: "timer", minutes: 5 } });
        services.tasks.transition("C", "cancel", { input: { scope: "occurrence" } });
        expect(followers("C")).toEqual([]);
      });
    });

    describe("changing urgency and schedule", () => {
      it("marks a chore urgent without changing its configuration", () => {
        chore("C", { schedule: weekly });
        services.chores.setUrgency("C", "urgent");
        expect(services.chores.isUrgent(services.tasks.get("C")!)).toBe(true);
        expect(attrs("C")).toMatchObject({ urgency: "urgent", baseUrgency: "normal", schedule: weekly });
      });

      it("reschedules from now and carries the schedule forward", () => {
        chore("C", { schedule: weekly });
        setNow("2026-10-14T10:00:00.000Z");
        services.chores.setSchedule("C", { type: "timer", minutes: 15 });
        expect(attrs("C").dueAt).toBe("2026-10-14T10:15:00.000Z");
        services.tasks.transition("C", "complete", { input: { next: true } });
        expect(choreAttributes(followers("C")[0]!).schedule).toEqual({ type: "timer", minutes: 15 });
      });

      it("clears the schedule and due time", () => {
        chore("C", { schedule: weekly });
        services.chores.setSchedule("C", null);
        expect(attrs("C")).toEqual({ urgency: "normal", baseUrgency: "normal", seriesId: "C" });
      });

      it("rejects changes to chores that are not in todo, and to other kinds", () => {
        chore("C");
        services.tasks.transition("C", "complete");
        expectTaskError(() => services.chores.setUrgency("C", "urgent"), "invalid_transition");
        services.tasks.create({ id: "W", projectId: "P", kind: "work", title: "W" });
        expectTaskError(() => services.chores.setUrgency("W", "urgent"), "validation");
        chore("D");
        expectTaskError(() => services.chores.setSchedule("D", { type: "time", time: "99:00" } as Schedule), "validation");
      });
    });

    describe("series", () => {
      it("lists a daily chore's occurrences oldest first", () => {
        chore("C", { schedule: daily });
        setNow("2026-10-14T09:30:00.000Z");
        services.tasks.transition("C", "complete");
        const second = followers("C")[0]!;
        setNow("2026-10-15T09:30:00.000Z");
        services.tasks.transition(second.id, "complete");
        const series = services.chores.series("C");
        expect(series.map((t) => t.state)).toEqual(["done", "done", "todo"]);
        expect(series[0]!.id).toBe("C");
      });
    });

  });
}
