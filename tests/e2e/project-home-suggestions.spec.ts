import { expect, test } from "@playwright/test";

import { agent, openHomeDialog, resourceName } from "./helpers";

test.describe.configure({ mode: "serial" });

/**
 * Spec coverage:
 * - agent-mcp: Suggesting on a project home through its project ID
 * - project-screens: Reviewing a pending project-home suggestion
 */
test("a project home suggestion made through the project ID is reviewed on the project home", async ({ page, request }, testInfo) => {
  const title = resourceName(testInfo, "Project-home suggestions");
  await page.goto("/");
  const dialog = await openHomeDialog(page, "New project");
  await dialog.getByRole("textbox", { name: "Title" }).fill(title);
  await dialog.getByRole("button", { name: "Create", exact: true }).click();
  await expect(page).toHaveURL(/\/projects\/[^/]+$/);
  await expect(page.locator(".page-editor")).toBeVisible();

  const projectId = new URL(page.url()).pathname.split("/").at(-1)!.slice(0, 8);
  await agent(request, "suggest", { page: projectId, action: "insert", markdown: "The shared release plan" });

  const box = page.getByLabel("builder: Suggests adding");
  await expect(box).toBeVisible();
  await expect(box).toContainText("The shared release plan");
  await box.getByRole("button", { name: "Approve" }).click();
  await expect(page.locator('.editor-body .editable[data-type="paragraph"]')).toHaveText("The shared release plan");
});
