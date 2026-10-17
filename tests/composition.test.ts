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
