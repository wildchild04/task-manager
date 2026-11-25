import { expect, test } from "@playwright/test";

import { agent, openHomeDialog, resourceName } from "./helpers";

test("completed tasks can be shown across project tabs and survive reload", async ({ page, request }, testInfo) => {
  const title = resourceName(testInfo, "Completed tasks");
  await page.goto("/");
  const dialog = await openHomeDialog(page, "New project");
  await dialog.getByRole("textbox", { name: "Title" }).fill(title);
  await dialog.getByRole("button", { name: "Create", exact: true }).click();
  await expect(page).toHaveURL(/\/projects\/[^/]+$/);
  const projectId = new URL(page.url()).pathname.split("/").at(-1)!;

  await agent(request, "tasks", { project: projectId, kind: "work", title: "Still to do" });
  const done = await agent(request, "tasks", { project: projectId, kind: "work", title: "Shipped already" });
  await agent(request, `task/${done.id}/transition`, { name: "start" });
  await agent(request, `task/${done.id}/transition`, { name: "complete" });
  await page.reload();

  await page.getByRole("tab", { name: "Work (1)" }).click();
  const toggle = page.getByRole("switch", { name: "Show completed (1)" });
  await expect(toggle).not.toBeChecked();
  await expect(page.getByRole("link", { name: "Shipped already" })).toHaveCount(0);
  await toggle.click();
  await expect(page).toHaveURL(/completed=1/);
  await expect(toggle).toBeChecked();
  const completed = page.getByRole("region", { name: "Completed" });
  await expect(completed.getByRole("link", { name: "Shipped already" })).toBeVisible();
  await expect(completed).toContainText("Done");
  await page.reload();
  await expect(page.getByRole("switch", { name: "Show completed (1)" })).toBeChecked();
  await expect(completed.getByRole("link", { name: "Shipped already" })).toBeVisible();
  await page.getByRole("tab", { name: "Explorations" }).click();
  await expect(page.getByRole("switch", { name: "Show completed (0)" })).toBeChecked();
  await page.getByRole("switch", { name: "Show completed (0)" }).click();
  await expect(page).not.toHaveURL(/completed=1/);
  await page.getByRole("tab", { name: "Work (1)" }).click();
  await expect(page.getByRole("link", { name: "Shipped already" })).toHaveCount(0);
});
