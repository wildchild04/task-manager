import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { handleAgentRequest } from "../app/lib/agent/request.server";
import { type AppServices, createInMemoryServices, createServices } from "~/composition";

describe("composition", () => {
  it.each([
    ["sqlite", () => createServices(":memory:")],
    ["memory", () => createInMemoryServices()],
  ])("builds working block services (%s)", (_name, create) => {
    const services = create();
    services.blocks.apply([
      { op: "insert", block: { id: "P", type: "page", content: [{ text: "Home" }] }, parentId: null },
    ]);
    expect(services.blocks.listRootPages().map((p) => p.id)).toEqual(["P"]);
    services.close();
  });
});

describe.each([
  ["sqlite", () => createServices(":memory:")],
  ["memory", () => createInMemoryServices()],
])("the change feed (%s)", (_name, create: () => AppServices) => {
  const P = "proj0001-0000-0000-0000-000000000000";

  /** The numbers listeners were told while `write` ran. */
  function seen(services: AppServices, write: () => unknown): number[] {
    const numbers: number[] = [];
    const unsubscribe = services.changes.subscribe((seq) => numbers.push(seq));
    try {
      write();
    } catch {
      // Rejected writes are part of what's checked.
    } finally {
      unsubscribe();
    }
    return numbers;
  }

  it("counts a block batch", () => {
    const services = create();
    const insert = { op: "insert" as const, block: { id: "P", type: "page" as const }, parentId: null };
    expect(seen(services, () => services.blocks.apply([insert]))).toEqual([1]);
    expect(services.changes.current).toBe(1);
    services.close();
  });

  it("counts a unit of work holding a block batch once", () => {
    const services = create();
    expect(seen(services, () => services.projects.create({ id: P, title: "Taskhub" }))).toEqual([1]);
    services.close();
  });

  it("doesn't count a rejected batch or unit of work", () => {
    const services = create();
    const orphan = { op: "insert" as const, block: { id: "C", type: "paragraph" as const }, parentId: "missing" };
    expect(seen(services, () => services.blocks.apply([orphan]))).toEqual([]);
    expect(seen(services, () => services.tasks.create({ id: "t1", projectId: "missing", kind: "work", title: "x" }))).toEqual([]);
    expect(services.changes.current).toBe(0);
    services.close();
  });

  it("counts an agent's comment", async () => {
    const services = create();
    services.projects.create({ id: P, title: "Taskhub" });
    services.tasks.create({ id: "aaaa0001-0000-0000-0000-000000000000", projectId: P, kind: "work", title: "Add login" });
    const before = services.changes.current;
    const numbers: number[] = [];
    services.changes.subscribe((seq) => numbers.push(seq));
    const request = new Request("http://app/api/agent/task/aaaa0001/comment", {
      method: "POST",
      headers: { authorization: "Bearer t", "x-agent-name": "builder", "content-type": "application/json" },
      body: JSON.stringify({ markdown: "Looks good" }),
    });
    const response = await handleAgentRequest(services, request, "task/aaaa0001/comment", "t");
    expect(response.status).toBe(200);
    expect(numbers).toEqual([before + 1]);
    services.close();
  });
});

describe("content in the composition", () => {
  it("keeps content beside the database, served under the base path", async () => {
    const dir = mkdtempSync(join(tmpdir(), "composition-"));
    const services = createServices(join(dir, "app.sqlite"), { basePath: "/task-manager" });
    const { id } = await services.content.put(new Uint8Array([0xff, 0xd8, 0xff, 1]), "image/jpeg");
    expect(existsSync(join(dir, "content", id.slice(0, 2), id))).toBe(true);
    expect(services.content.url(id)).toBe(`/task-manager/content/${id}`);
    services.close();
  });

  it("keeps content in memory for in-memory services", async () => {
    const services = createInMemoryServices();
    const { id } = await services.content.put(new Uint8Array([0xff, 0xd8, 0xff, 2]), "image/jpeg");
    expect(await services.content.get(id)).toMatchObject({ id, type: "image/jpeg" });
    expect(services.content.url(id)).toBe(`/content/${id}`);
  });
});
