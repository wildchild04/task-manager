import { beforeEach, describe, expect, it, vi } from "vitest";

import { homeView, relativeTime } from "../../app/lib/home.server";
import { type AppServices, createInMemoryServices } from "~/composition";

describe("home dashboard", () => {
  let services: AppServices;
  let clock: string;
  const builder = { kind: "agent" as const, name: "builder" };

  beforeEach(() => {
    clock = "2026-10-14T08:00:00.000Z";
    services = createInMemoryServices({ now: () => clock, timeZone: "UTC" });
    services.projects.create({ id: "A", title: "Garden" });
    services.projects.create({ id: "B", title: "Kitchen" });
  });

  const task = (
    id: string,
    projectId: string,
    kind: "work" | "chore" | "exploration" | "update",
    title = id,
    attributes?: Record<string, unknown>,
  ) => services.tasks.create({ id, projectId, kind, title, ...(attributes ? { attributes } : {}) });

  it("lists what needs attention: overdue chores, work returned by agents, work in progress", () => {
    task("C", "A", "chore", "Water plants", { schedule: { type: "time", time: "09:00" } }); // due 09:00 today
    task("R", "B", "work", "Fix oven");
    services.tasks.transition("R", "start", { actor: builder });
    services.tasks.transition("R", "return", { actor: builder, input: { reason: "No parts" } });
    task("P", "B", "work", "Bake bread");
    services.tasks.transition("P", "start", { actor: builder });
    task("T", "B", "work", "Clean"); // plain to do: not listed
    clock = "2026-10-14T10:00:00.000Z"; // the chore is now overdue

    expect(homeView(services, clock).attention).toEqual({
      items: [
        {
          id: "C",
          title: "Water plants",
          href: "/tasks/C",
          project: "Garden",
          reason: "Overdue · due 14 Oct 2026, 09:00",
          tone: "error",
        },
        { id: "R", title: "Fix oven", href: "/tasks/R", project: "Kitchen", reason: "Returned by builder", tone: "warning" },
        { id: "P", title: "Bake bread", href: "/tasks/P", project: "Kitchen", reason: "In progress · builder", tone: "info" },
      ],
      more: 0,
    });
  });

  it("caps the list and says how many more", () => {
    for (let i = 0; i < 12; i++) {
      task(`W${i}`, "A", "work");
      services.tasks.transition(`W${i}`, "start");
    }
    const { items, more } = homeView(services, clock).attention;
    expect(items).toHaveLength(10);
    expect(more).toBe(2);
    expect(items[0]!.reason).toBe("In progress");
  });

  it("counts active work, open ideas and urgent chores per project", () => {
    task("W1", "A", "work");
    task("W2", "A", "work");
    task("W3", "A", "work");
    services.tasks.transition("W3", "start");
    task("W4", "A", "work");
    services.tasks.transition("W4", "start");
    services.tasks.transition("W4", "complete");
    task("E", "A", "exploration");
    task("C", "A", "chore", "Urgent", { urgency: "urgent" });
    expect(homeView(services, clock).projects).toEqual([
      { id: "A", title: "Garden", activeWork: 3, openIdeas: 1, urgentChores: 1 },
      { id: "B", title: "Kitchen", activeWork: 0, openIdeas: 0, urgentChores: 0 },
    ]);
  });

  it("lists the most recently edited pages and tasks, with their place", () => {
    // Block edits are stamped with the system clock.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-14T08:00:00.000Z"));
    const library = services.projects.get("A")!.libraryRootId;
    services.blocks.apply([{ op: "insert", block: { id: "doc", type: "page", content: [{ text: "Plan" }] }, parentId: library }]);
    task("W", "B", "work", "Fix oven");
    vi.setSystemTime(new Date("2026-10-14T09:00:00.000Z"));
    services.blocks.apply([
      {
        op: "insert",
        block: { id: "tp", type: "paragraph", content: [{ text: "x" }] },
        parentId: services.tasks.get("W")!.bodyPageId,
      },
    ]);
    vi.setSystemTime(new Date("2026-10-14T09:30:00.000Z"));
    services.blocks.apply([{ op: "insert", block: { id: "dp", type: "paragraph", content: [{ text: "y" }] }, parentId: "doc" }]);
    vi.useRealTimers();

    const recent = homeView(services, "2026-10-14T11:30:00.000Z").recent;
    expect(recent.slice(0, 2)).toEqual([
      { kind: "page", id: "doc", title: "Plan", place: "Garden", href: "/pages/doc", edited: "2 h ago" },
      {
        kind: "task",
        id: services.tasks.get("W")!.bodyPageId,
        title: "Fix oven",
        place: "Task · work · Kitchen",
        href: "/tasks/W",
        edited: "2 h ago",
      },
    ]);
  });

  it("lists pages and tasks with suggestions waiting, the oldest first, with counts and agents", () => {
    const explore = task("E", "A", "exploration", "Block editor v1");
    services.blocks.apply([
      { op: "insert", block: { id: "road", type: "page", content: [{ text: "Roadmap" }] }, parentId: null },
    ]);
    const para = (id: string) => [{ id, type: "paragraph" as const, content: [{ text: id }] }];
    const suggest = (pageId: string, id: string, author: string) =>
      services.suggestions.suggest({ pageId, action: "insert", blocks: para(id), author });
    expect(homeView(services, clock).review).toEqual([]);
    suggest(explore.bodyPageId, "s1", "builder");
    clock = "2026-10-14T08:01:00.000Z";
    suggest("road", "s2", "planner");
    clock = "2026-10-14T08:02:00.000Z";
    suggest(explore.bodyPageId, "s3", "builder");
    expect(homeView(services, clock).review).toEqual([
      {
        id: explore.bodyPageId,
        title: "Block editor v1",
        place: "Task · exploration · Garden",
        href: "/tasks/E",
        count: 2,
        agents: ["builder"],
      },
      { id: "road", title: "Roadmap", place: "Pages", href: "/pages/road", count: 1, agents: ["planner"] },
    ]);
  });

  it("includes the workspace page tree", () => {
    services.blocks.apply([{ op: "insert", block: { id: "wp", type: "page", content: [{ text: "Welcome" }] }, parentId: null }]);
    expect(homeView(services, clock).pages).toEqual([{ id: "wp", title: "Welcome", children: [] }]);
  });

  it.each([
    ["2026-10-14T07:59:40.000Z", "just now"],
    ["2026-10-14T07:55:00.000Z", "5 min ago"],
    ["2026-10-14T05:00:00.000Z", "3 h ago"],
    ["2026-10-11T08:00:00.000Z", "3 d ago"],
    ["2026-09-01T08:00:00.000Z", "1 Sept 2026, 08:00"],
  ])("describes %s as %j", (iso, words) => {
    expect(relativeTime(iso, "2026-10-14T08:00:00.000Z", "UTC")).toBe(words);
  });
});
