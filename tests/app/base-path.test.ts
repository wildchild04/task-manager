import { describe, expect, it } from "vitest";

import { appBasePath } from "../../app-base-path";

describe("APP_BASE_PATH", () => {
  it.each([
    ["", "/"],
    ["/", "/"],
    ["task-manager", "/task-manager"],
    ["/task-manager/", "/task-manager"],
    [" /apps/tasks ", "/apps/tasks"],
  ])("normalises %j to %j", (value, base) => {
    expect(appBasePath(value)).toBe(base);
  });

  it("refuses a URL", () => {
    expect(() => appBasePath("https://example.com/tasks")).toThrow(/APP_BASE_PATH/);
  });
});
