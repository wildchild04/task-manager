import { expect, test } from "@playwright/test";

import { agent, openNewTask, resourceName } from "./helpers";

test.describe.configure({ mode: "serial" });

/**
 * Spec coverage:
 * - task-screen: Findings on the exploration page (an agent's finding appears; adding one in the editor)
 * - task-screen: Task page tabs (Exploration tabs; Link to a finding)
 */

test("findings on an exploration: an agent's, one written here, and a link to one", async ({ page, request }, testInfo) => {
  const id = await openNewTask(page, resourceName(testInfo, "Findings project"), "Block editor v2", "exploration");
  const tabs = page.getByRole("tablist", { name: "Task sections" }).getByRole("tab");
  await expect(tabs).toHaveText(["Description", "Findings", "Lineage", "References", "History"]);

  await agent(request, `task/${id}/finding`, { markdown: "Tables are used on **16** of 20 pages" });
  await page.getByRole("tab", { name: "Findings (1)" }).click();
  await expect(page).toHaveURL(/\?tab=findings$/);
  await expect(page.getByText("Tables are used on 16 of 20 pages")).toBeVisible();
  await expect(page.getByText("builder", { exact: true })).toBeVisible();
  const finding = page.locator('[id^="finding-"]').first();
  await expect(finding.getByRole("button", { name: "Edit" })).toBeVisible();
  await expect(finding.getByRole("button", { name: "Start exploration…" })).toHaveCount(0);

  const composer = page.locator(".comment-composer").last();
  await composer.locator('.editable[data-type="paragraph"]').click();
  await page.keyboard.type("Images can come after v1");
  await page.getByRole("button", { name: "Add finding" }).click();
  await expect(page.getByRole("tab", { name: "Findings (2)" })).toBeVisible();
  await expect(page.getByText("Images can come after v1")).toBeVisible();

  const anchor = await page.locator('[id^="finding-"]').first().getAttribute("id");
  await page.goto(`${new URL(page.url()).pathname}#${anchor}`);
  await expect(page).toHaveURL(/\?tab=findings#finding-/);
  await expect(page.locator(`#${anchor}`)).toBeInViewport();
});
