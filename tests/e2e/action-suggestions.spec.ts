import { expect, test } from "@playwright/test";

import { agent, openNewTask, resourceName } from "./helpers";

test.describe.configure({ mode: "serial" });

/**
 * Spec coverage:
 * - action-suggestions: Action suggestions at their control (a rename under the title; a page deletion
 *   approved through the delete dialog, going to the parent)
 * - app-shell: Notification bell (an action suggestion is counted, and the count follows the decision)
 */

test("an agent's suggested rename is approved from its bar, and the bell follows", async ({ page, request }, testInfo) => {
  const id = await openNewTask(page, resourceName(testInfo, "Action project"), "Old migration");
  const bell = page.getByRole("button", { name: /^Notifications/ });
  const before = (await bell.getAttribute("aria-label")) ?? "";

  await agent(request, "suggest-action", { action: "rename", task: id, title: "New migration", note: "Matches the new importer" });
  // Live refresh brings the suggestion to the open task.
  const bar = page.getByRole("status").filter({ hasText: 'builder suggests renaming this work to "New migration"' });
  await expect(bar).toBeVisible();
  await expect(bar).toContainText("Matches the new importer");
  await expect(bell).not.toHaveAttribute("aria-label", before);

  await bar.getByRole("button", { name: "Approve" }).click();
  await expect(bar).toHaveCount(0);
  await expect(page.getByRole("textbox", { name: "Title" })).toHaveText("New migration");
  await expect(bell).toHaveAttribute("aria-label", before);
});

test("an agent's suggested page deletion is confirmed like the delete button's", async ({ page, request }, testInfo) => {
  const title = resourceName(testInfo, "Scratch");
  const scratch = await agent(request, "pages", { title });
  await agent(request, "pages", { title: "Inside", parent: scratch.id });
  await agent(request, "suggest-action", { action: "delete", page: scratch.id, note: "Empty since June" });

  // The agent API answers short IDs; the app's routes take full ones, so open the page from the sidebar.
  await page.goto("/");
  await page.getByRole("navigation", { name: "Workspace pages" }).getByText(title, { exact: true }).click();
  await expect(page).toHaveURL(/\/pages\/[^/]+$/);
  const pageUrl = new URL(page.url()).pathname;
  const bar = page.getByRole("status").filter({ hasText: "builder suggests deleting this page" });
  await expect(bar).toBeVisible();
  // The editor mounts once the page is hydrated, so the button then responds.
  await expect(page.locator(".page-editor")).toBeVisible();
  await bar.getByRole("button", { name: "Approve" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("1 page inside it will be deleted too.");
  await dialog.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  expect((await request.get(pageUrl)).status()).toBe(404);
});
