import { beforeEach, describe, expect, it } from "vitest";

import { createWorkspacePageAction } from "../../app/lib/workspace-pages.server";
import { type AppServices, createInMemoryServices } from "~/composition";
import { plainText } from "~/domain/blocks/text";

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
};

describe("creating workspace pages", () => {
  let services: AppServices;
  beforeEach(() => {
    services = createInMemoryServices();
  });

  it("adds a top-level page after the existing ones", () => {
    expect(createWorkspacePageAction(services, form({ title: "Welcome" }))).toMatchObject({ ok: true });
    expect(createWorkspacePageAction(services, form({ title: "Notes" }))).toMatchObject({ ok: true });
    expect(services.blocks.listRootPages().map((p) => plainText(p.content))).toEqual(["Welcome", "Notes"]);
  });

  it("requires a title", () => {
    expect(createWorkspacePageAction(services, form({ title: "  " }))).toMatchObject({
      ok: false,
      fieldErrors: { title: "A page needs a title" },
    });
    expect(services.blocks.listRootPages()).toEqual([]);
  });
});
