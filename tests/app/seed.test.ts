import { describe, expect, it } from "vitest";

import { seed } from "../../scripts/seed-data";
import { createInMemoryServices } from "~/composition";
import { TASK_KINDS } from "~/domain/tasks/types";

describe("seed", () => {
  it("seeds an empty database with the pages and a project with every kind of task", () => {
    const services = createInMemoryServices();
    expect(seed(services)).toEqual({ pages: true, project: true });
    expect(services.blocks.listRootPages().map((p) => p.content[0]?.text)).toEqual(["Welcome", "Block showcase"]);
    const tasks = services.tasks.list("seed-project");
    for (const kind of TASK_KINDS) expect(tasks.some((t) => t.kind === kind), kind).toBe(true);
    const workStates = new Set(tasks.filter((t) => t.kind === "work").map((t) => t.state));
    expect([...workStates].sort()).toEqual(["cancelled", "done", "in_progress", "todo"]);
    expect(services.library.getLibraryTree("seed-project")?.[0]?.children.length).toBeGreaterThan(0);
  });

  it("adds nothing the second time", () => {
    const services = createInMemoryServices();
    seed(services);
    const count = services.tasks.list("seed-project").length;
    expect(seed(services)).toEqual({ pages: false, project: false });
    expect(services.blocks.listRootPages()).toHaveLength(2);
    expect(services.projects.list()).toHaveLength(1);
    expect(services.tasks.list("seed-project")).toHaveLength(count);
  });

  it("adds only the project to a database seeded before it existed", () => {
    const services = createInMemoryServices();
    seed(services);
    const pages = services.blocks.listRootPages();
    const older = createInMemoryServices();
    // Recreate an older database: the pages exist, the project does not.
    older.blocks.apply(
      pages.map((p, i) => ({ op: "insert" as const, block: { id: p.id, type: "page" as const, content: p.content }, parentId: null, afterId: pages[i - 1]?.id ?? null })),
    );
    expect(seed(older)).toEqual({ pages: false, project: true });
    expect(older.blocks.listRootPages()).toHaveLength(2);
    expect(older.projects.get("seed-project")).toBeDefined();
  });

  it("includes returned work, an overdue chore and an urgent chore for the dashboard", () => {
    const services = createInMemoryServices();
    seed(services);
    const dashboard = services.dashboard.getDashboard("seed-project")!;
    expect(dashboard.find((s) => s.id === "returned-work")?.count).toBe(1);
    const chores = dashboard.find((s) => s.id === "chores")!;
    expect(chores.items.filter((i) => i.urgent).length).toBeGreaterThanOrEqual(2);
  });
});
