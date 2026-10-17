import { beforeEach, describe, expect, it } from "vitest";

import { describeSchedule } from "../../app/lib/format";
import { createDocumentAction, libraryView } from "../../app/lib/library.server";
import { buildPageView } from "../../app/lib/page-view.server";
import { createProjectAction, projectHomeView, projectsHomeView } from "../../app/lib/projects.server";
import { shellView } from "../../app/lib/shell.server";
import { taskOverviewView } from "../../app/lib/task-overview.server";
import { createTaskAction, scheduleFromForm, taskListView } from "../../app/lib/task-lists.server";
import { type AppServices, createInMemoryServices } from "~/composition";

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
};

describe("project screens", () => {
  let services: AppServices;
  let clock: string;

  beforeEach(() => {
    clock = "2026-10-14T08:00:00.000Z"; // a Wednesday
    services = createInMemoryServices({ now: () => clock, timeZone: "UTC" });
    services.projects.create({ id: "P", title: "Taskhub" });
  });

  const work = (id: string) => services.tasks.create({ id, projectId: "P", kind: "work", title: id });
  const libraryRoot = () => services.projects.get("P")!.libraryRootId;

  describe("projects home", () => {
    it("creates a project and lists it", () => {
      const result = createProjectAction(services, form({ title: "Garden" }));
      expect(result).toMatchObject({ ok: true });
      expect(projectsHomeView(services).projects.map((p) => p.title)).toEqual(["Taskhub", "Garden"]);
    });

    it("rejects an empty title, keeping the input", () => {
      expect(createProjectAction(services, form({ title: "  " }))).toMatchObject({
        ok: false,
        fieldErrors: { title: "A project needs a title" },
      });
      expect(services.projects.list()).toHaveLength(1);
    });
  });

  describe("navigation", () => {
    beforeEach(() => {
      services.projects.create({ id: "P2", title: "Garden" });
      work("W");
      services.blocks.apply([
        { op: "insert", block: { id: "doc", type: "page", content: [{ text: "Doc" }] }, parentId: libraryRoot() },
        { op: "insert", block: { id: "wp", type: "page", content: [{ text: "Welcome" }] }, parentId: null },
      ]);
    });

    it("lists projects in order and workspace pages separately", () => {
      const view = shellView(services, "/");
      expect(view.projects.map((p) => p.title)).toEqual(["Taskhub", "Garden"]);
      expect(view.pages).toEqual([{ id: "wp", title: "Welcome" }]);
      expect(view.current).toBeNull();
    });

    it.each([
      ["/projects/P", "home"],
      ["/projects/P/chores", "chores"],
      ["/projects/P/library", "library"],
      ["/tasks/W", "work"],
      ["/pages/doc", "library"],
    ])("marks the section for %s", (path, section) => {
      expect(shellView(services, path).current).toEqual({ id: "P", title: "Taskhub", section });
    });

    it("marks home for the project's home page and nothing for workspace pages", () => {
      expect(shellView(services, `/pages/${services.projects.get("P")!.homePageId}`).current?.section).toBe("home");
      expect(shellView(services, "/pages/wp").current).toBeNull();
    });
  });

  describe("project home and dashboard", () => {
    it("shows counts, links and empty sections", () => {
      work("W");
      services.tasks.transition("W", "start");
      const view = projectHomeView(services, "P")!;
      const wip = view.dashboard.find((c) => c.id === "work-in-progress")!;
      expect(wip).toMatchObject({ title: "Work in progress", count: 1 });
      expect(wip.items[0]).toMatchObject({ id: "W", href: "/tasks/W", stateLabel: "In progress" });
      expect(view.dashboard.find((c) => c.id === "open-updates")).toMatchObject({ count: 0, items: [] });
      expect(view.home?.id).toBe(services.projects.get("P")!.homePageId);
    });

    it("marks overdue chores urgent with their due time", () => {
      services.tasks.create({
        id: "C",
        projectId: "P",
        kind: "chore",
        title: "Renew cert",
        attributes: { schedule: { type: "date", date: "2026-10-13", time: "09:00" } },
      });
      const chores = projectHomeView(services, "P")!.dashboard.find((c) => c.id === "chores")!;
      expect(chores.items[0]).toMatchObject({ id: "C", urgent: true, due: "13 Oct 2026, 09:00" });
    });

    it("links library items to their page", () => {
      services.blocks.apply([{ op: "insert", block: { id: "doc", type: "page" }, parentId: libraryRoot() }]);
      const library = projectHomeView(services, "P")!.dashboard.find((c) => c.id === "library")!;
      expect(library.items[0]).toMatchObject({ id: "doc", href: "/pages/doc", title: "Untitled" });
    });

    it("returns nothing for an unknown project", () => {
      expect(projectHomeView(services, "nope")).toBeUndefined();
    });
  });

  describe("task lists", () => {
    it("filters by the default state and by the URL filter", () => {
      services.tasks.create({ id: "E1", projectId: "P", kind: "exploration", title: "Open idea" });
      services.tasks.create({ id: "E2", projectId: "P", kind: "exploration", title: "Dead idea" });
      services.tasks.transition("E2", "tombstone");
      expect(taskListView(services, "P", "explorations", null)!.rows.map((r) => r.id)).toEqual(["E1"]);
      expect(taskListView(services, "P", "explorations", "tombstoned")!.rows.map((r) => r.id)).toEqual(["E2"]);
      expect(taskListView(services, "P", "explorations", "all")!.rows).toHaveLength(2);
      expect(taskListView(services, "P", "explorations", "bogus")!.filter).toBe("open");
    });

    it("groups todo and in-progress work as active", () => {
      work("A");
      work("B");
      work("C");
      services.tasks.transition("B", "start");
      services.tasks.transition("C", "start");
      services.tasks.transition("C", "complete");
      expect(taskListView(services, "P", "work", null)!.rows.map((r) => r.id).sort()).toEqual(["A", "B"]);
      expect(taskListView(services, "P", "work", "done")!.rows.map((r) => r.id)).toEqual(["C"]);
    });

    it("quick-adds work in todo", () => {
      expect(createTaskAction(services, "P", "work", form({ title: "Add login" }))).toMatchObject({ ok: true });
      expect(taskListView(services, "P", "work", null)!.rows).toMatchObject([{ title: "Add login", state: "todo" }]);
    });

    it("rejects an empty title", () => {
      expect(createTaskAction(services, "P", "explorations", form({ title: "" }))).toMatchObject({
        ok: false,
        fieldErrors: { title: "A title is required" },
      });
    });

    it("offers done work for updates and requires choosing one", () => {
      expect(taskListView(services, "P", "updates", null)!.doneWork).toEqual([]);
      expect(createTaskAction(services, "P", "updates", form({ title: "Next" }))).toMatchObject({
        ok: false,
        fieldErrors: { iteratesOn: expect.any(String) },
      });
      work("W");
      services.tasks.transition("W", "start");
      services.tasks.transition("W", "complete");
      expect(taskListView(services, "P", "updates", null)!.doneWork).toEqual([{ id: "W", title: "W" }]);
      expect(createTaskAction(services, "P", "updates", form({ title: "Next", iteratesOn: "W" }))).toMatchObject({ ok: true });
    });

    it("creates a weekly chore due next Monday at 09:00", () => {
      const result = createTaskAction(
        services,
        "P",
        "chores",
        form({ title: "Water plants", urgency: "normal", scheduleType: "frequency", every: "weekly", weekday: "1", time: "09:00" }),
      );
      expect(result).toMatchObject({ ok: true });
      expect(taskListView(services, "P", "chores", null)!.rows).toMatchObject([
        { title: "Water plants", urgent: false, due: "19 Oct 2026, 09:00" },
      ]);
    });

    it("shows a time error and keeps the other fields", () => {
      const result = createTaskAction(
        services,
        "P",
        "chores",
        form({ title: "Feed cat", scheduleType: "time", time: "25:00" }),
      );
      expect(result).toMatchObject({
        ok: false,
        fieldErrors: { time: "Enter a time as HH:MM, e.g. 09:00" },
        values: { title: "Feed cat", time: "25:00" },
      });
      expect(services.tasks.list("P", { kind: "chore" })).toEqual([]);
    });

    it("orders chores urgent first", () => {
      createTaskAction(services, "P", "chores", form({ title: "Later", scheduleType: "date", date: "2026-10-20", time: "09:00" }));
      createTaskAction(services, "P", "chores", form({ title: "Now", urgency: "urgent" }));
      expect(taskListView(services, "P", "chores", null)!.rows.map((r) => r.title)).toEqual(["Now", "Later"]);
    });
  });

  describe("schedule form", () => {
    it.each([
      [{ scheduleType: "none" }, undefined],
      [{ scheduleType: "timer", minutes: "30" }, { type: "timer", minutes: 30 }],
      [{ scheduleType: "date", date: "2026-11-03", time: "14:30" }, { type: "date", date: "2026-11-03", time: "14:30" }],
      [
        { scheduleType: "frequency", every: "monthly", dayOfMonth: "31", time: "09:00", weekday: "3" },
        { type: "frequency", every: "monthly", dayOfMonth: 31, time: "09:00" },
      ],
      [{ scheduleType: "interval", amount: "6", unit: "hours" }, { type: "interval", amount: 6, unit: "hours" }],
    ])("parses %j", (values, schedule) => {
      expect(scheduleFromForm(values as Record<string, string>)).toEqual({ ...(schedule ? { schedule } : {}), errors: {} });
    });

    it("names the missing fields", () => {
      expect(scheduleFromForm({ scheduleType: "interval", unit: "hours" }).errors).toHaveProperty("amount");
      expect(scheduleFromForm({ scheduleType: "frequency", every: "weekly", time: "09:00" }).errors).toHaveProperty("weekday");
    });

    it.each([
      [{ type: "time", time: "09:00" }, "At 09:00"],
      [{ type: "date", date: "2026-11-03", time: "14:30" }, "On 3 Nov 2026 at 14:30"],
      [{ type: "timer", minutes: 30 }, "30 minutes after it was set"],
      [{ type: "frequency", every: "weekly", weekday: 1, time: "09:00" }, "Every Monday at 09:00"],
      [{ type: "interval", amount: 1, unit: "hours" }, "Every hour"],
      [{ type: "interval", amount: 6, unit: "hours" }, "Every 6 hours"],
    ] as const)("describes %j", (schedule, words) => {
      expect(describeSchedule(schedule)).toBe(words);
    });
  });

  describe("knowledge library", () => {
    it("creates nested documents after the parent's last child", () => {
      createDocumentAction(services, "P", form({ title: "Architecture" }));
      const arch = libraryView(services, "P")!.tree[0]!.id;
      createDocumentAction(services, "P", form({ title: "Auth design", parentId: arch }));
      createDocumentAction(services, "P", form({ title: "Storage", parentId: arch }));
      const view = libraryView(services, "P")!;
      expect(view.tree[0]).toMatchObject({ title: "Architecture", children: [{ title: "Auth design" }, { title: "Storage" }] });
      expect(view.parents.map((p) => [p.title, p.depth])).toEqual([
        ["Architecture", 0],
        ["Auth design", 1],
        ["Storage", 1],
      ]);
    });

    it("rejects an empty title and a parent outside the project", () => {
      expect(createDocumentAction(services, "P", form({ title: "" }))).toMatchObject({ ok: false });
      services.projects.create({ id: "P2", title: "Other" });
      services.blocks.apply([
        { op: "insert", block: { id: "foreign", type: "page" }, parentId: services.projects.get("P2")!.libraryRootId },
      ]);
      expect(createDocumentAction(services, "P", form({ title: "x", parentId: "foreign" }))).toMatchObject({
        ok: false,
        fieldErrors: { parentId: expect.any(String) },
      });
    });
  });

  describe("page viewer scope", () => {
    it("opens library documents with their project, but not task bodies", () => {
      services.blocks.apply([{ op: "insert", block: { id: "doc", type: "page" }, parentId: libraryRoot() }]);
      expect(buildPageView(services.blocks, "doc")?.projectId).toBe("P");
      expect(buildPageView(services.blocks, services.projects.get("P")!.homePageId)?.projectId).toBe("P");
      expect(buildPageView(services.blocks, work("W").bodyPageId)).toBeUndefined();
    });
  });

  describe("task overview", () => {
    it("describes a weekly chore and its next due time", () => {
      services.tasks.create({
        id: "C",
        projectId: "P",
        kind: "chore",
        title: "Water plants",
        attributes: { schedule: { type: "frequency", every: "weekly", weekday: 1, time: "09:00" } },
      });
      expect(taskOverviewView(services, "C")).toMatchObject({
        task: { title: "Water plants", kindLabel: "chore", stateLabel: "To do" },
        project: { id: "P", listSlug: "chores" },
        chore: { urgent: false, schedule: "Every Monday at 09:00", due: "19 Oct 2026, 09:00" },
      });
    });

    it("shows a task's body and returns nothing for unknown tasks", () => {
      const task = work("W");
      services.blocks.apply([
        { op: "insert", block: { id: "p", type: "paragraph", content: [{ text: "Steps" }] }, parentId: task.bodyPageId },
      ]);
      expect(taskOverviewView(services, "W")?.body?.blocks).toHaveLength(1);
      expect(taskOverviewView(services, "nope")).toBeUndefined();
    });
  });
});
