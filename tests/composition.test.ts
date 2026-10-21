import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { createInMemoryServices, createServices } from "~/composition";

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
