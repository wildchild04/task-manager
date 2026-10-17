import { beforeEach, describe, expect, it } from "vitest";

import type { AppServices } from "~/composition";
import type { DashboardSectionResult } from "~/domain/projects/dashboard";

import type { ServicesFactory } from "./project.contract";

/** A clock that moves one second per call, so "most recently updated" is deterministic. */
function tickingClock() {
  let t = Date.parse("2026-01-01T00:00:00Z");
  return () => new Date((t += 1000)).toISOString();
}

export function dashboardContract(name: string, factory: ServicesFactory) {
  describe(`${name}: dashboard contract`, () => {
    let services: AppServices;

    const dashboard = (limit?: number) => services.dashboard.getDashboard("P", limit)!;
    const section = (id: string, limit?: number): DashboardSectionResult => dashboard(limit).find((s) => s.id === id)!;
    const ids = (id: string, limit?: number) => section(id, limit).items.map((item) => item.id);
    const work = (id: string) => services.tasks.create({ id, projectId: "P", kind: "work", title: id });

    beforeEach(() => {
      services = factory({ now: tickingClock() });
      services.projects.create({ id: "P", title: "Project" });
    });

    it("returns every core section in order, including empty ones", () => {
      expect(dashboard().map((s) => [s.id, s.count, s.items.length])).toEqual([
        ["work-in-progress", 0, 0],
        ["returned-work", 0, 0],
        ["open-explorations", 0, 0],
        ["open-updates", 0, 0],
        ["chores", 0, 0],
        ["library", 0, 0],
      ]);
    });

    it("reflects changes immediately", () => {
      work("W");
      expect(ids("work-in-progress")).toEqual([]);
      services.tasks.transition("W", "start");
      expect(section("work-in-progress").items).toEqual([{ id: "W", title: "W", kind: "work", state: "in_progress" }]);
    });

    it("shows returned work, not paused work, and not in progress", () => {
      work("R");
      work("S");
      services.tasks.transition("R", "start");
      services.tasks.transition("R", "return", { input: { reason: "blocked" } });
      services.tasks.transition("S", "start");
      services.tasks.transition("S", "pause");
      expect(ids("returned-work")).toEqual(["R"]);
      expect(ids("work-in-progress")).toEqual([]);
    });

    it("counts everything but lists the N most recently updated", () => {
      for (let i = 1; i <= 8; i++) services.tasks.create({ id: `E${i}`, projectId: "P", kind: "exploration", title: `E${i}` });
      // Touch E2 so it becomes the most recently updated.
      services.tasks.transition("E2", "tombstone");
      services.tasks.transition("E2", "revive");
      const explorations = section("open-explorations", 5);
      expect(explorations.count).toBe(8);
      expect(explorations.items.map((item) => item.id)).toEqual(["E2", "E8", "E7", "E6", "E5"]);
      expect(section("open-explorations", 3).items).toHaveLength(3);
    });

    it("fills the update, chore and library sections", () => {
      work("W");
      services.tasks.transition("W", "start");
      services.tasks.transition("W", "complete");
      services.tasks.create({ id: "U", projectId: "P", kind: "update", title: "U", iteratesOn: "W" });
      services.tasks.create({ id: "C", projectId: "P", kind: "chore", title: "C" });
      services.blocks.apply([
        {
          op: "insert",
          block: { id: "D", type: "page", content: [{ text: "Architecture" }] },
          parentId: services.projects.get("P")!.libraryRootId,
        },
      ]);
      expect(ids("open-updates")).toEqual(["U"]);
      expect(ids("chores")).toEqual(["C"]);
      expect(section("library").items).toEqual([{ id: "D", title: "Architecture" }]);
    });

    it("only shows the project's own tasks", () => {
      services.projects.create({ id: "P2", title: "Other" });
      services.tasks.create({ id: "X", projectId: "P2", kind: "chore", title: "X" });
      expect(section("chores").count).toBe(0);
      expect(services.dashboard.getDashboard("nope")).toBeUndefined();
    });

    it("lets later changes register a section in position", () => {
      services.dashboardSections.register(
        { id: "recent-logs", title: "Recent logs", query: () => [{ id: "L1", title: "Log" }] },
        { after: "chores" },
      );
      expect(dashboard().map((s) => s.id)).toEqual([
        "work-in-progress",
        "returned-work",
        "open-explorations",
        "open-updates",
        "chores",
        "recent-logs",
        "library",
      ]);
      expect(section("recent-logs")).toMatchObject({ count: 1, items: [{ id: "L1" }] });
    });
  });
}
