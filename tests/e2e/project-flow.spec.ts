import { expect, test } from "@playwright/test";

test.describe.configure({ mode: "serial" });

async function openHomeDialog(page: import("@playwright/test").Page, name: "New page" | "New project") {
  const button = page.getByRole("heading", { name: "Home" }).locator("xpath=..").getByRole("button", { name, exact: true });
  const dialog = page.getByRole("dialog", { name });
  // Server HTML appears before React binds its click handler. Retrying on the
  // observable dialog state makes this robust without guessing a delay.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    await button.click();
    try {
      await expect(dialog).toBeVisible({ timeout: 1_000 });
      return dialog;
    } catch {
      // The first click can land during hydration; retry once after it settles.
    }
  }
  await expect(dialog).toBeVisible();
  return dialog;
}

async function createWorkspacePage(page: import("@playwright/test").Page, title: string) {
  await page.goto("/");
  const dialog = await openHomeDialog(page, "New page");
  await dialog.getByRole("textbox", { name: "Title" }).fill(title);
  await dialog.getByRole("button", { name: "Create", exact: true }).click();
  await expect(page).toHaveURL(/\/pages\/[^/]+$/);
  await expect(page.locator(".page-editor")).toBeVisible();
}

/**
 * Spec coverage:
 * - project-screens: Create a project; Quick-add work
 * - app-shell: project navigation and project sections
 *
 * This deliberately crosses the browser, route actions/loaders, service wiring
 * and SQLite instead of calling view-model helpers directly.
 */
test("a user creates a project and quick-adds work from its navigation", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Home" })).toBeVisible();

  // The main-page action has text, unlike the shell's icon-only action.
  const dialog = await openHomeDialog(page, "New project");
  await dialog.getByRole("textbox", { name: "Title" }).fill("Taskhub");
  await dialog.getByRole("button", { name: "Create", exact: true }).click();

  await expect(page).toHaveURL(/\/projects\/[^/]+$/);
  await expect(page.getByRole("heading", { name: "Taskhub" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Projects" }).getByRole("link", { name: "Taskhub" })).toBeVisible();

  await page.getByRole("navigation", { name: "Taskhub sections" }).getByRole("link", { name: "Work" }).click();
  await expect(page).toHaveURL(/\/projects\/[^/]+\/work$/);

  const quickAdd = page.getByRole("textbox", { name: "New work title" });
  await quickAdd.fill("Add login");
  await quickAdd.press("Enter");

  await expect(page.getByRole("link", { name: "Add login" })).toBeVisible();
  await expect(page.getByText("To do", { exact: true })).toBeVisible();
});

test("a page can create a sub-page through the slash menu", async ({ page }) => {
  await createWorkspacePage(page, "Editor parent");

  await page.locator(".editor-empty").click();
  const paragraph = page.locator('.editor-body .editable[data-type="paragraph"]');
  await paragraph.click();
  await page.keyboard.type("/page");
  await expect(page.getByRole("option", { name: "Page" })).toBeVisible();
  const parentUrl = page.url();
  await paragraph.press("Enter");

  await expect(page).not.toHaveURL(parentUrl);
  await expect(page.getByRole("textbox", { name: "Title" })).toBeFocused();
  await page.keyboard.type("Child page");
  await expect(page.getByRole("link", { name: "Child page" })).toBeVisible();
});

test("selected blocks can be turned into a list from the block-action menu", async ({ page }) => {
  await createWorkspacePage(page, "Selection playground");

  await page.locator(".editor-empty").click();
  const paragraph = page.locator('.editor-body .editable[data-type="paragraph"]');
  await paragraph.click();
  await page.keyboard.type("First paragraph");
  await paragraph.press("Enter");
  await page.keyboard.type("Second paragraph");
  await page.keyboard.press("Enter");
  await page.keyboard.type("Third paragraph");

  const paragraphs = page.locator('.editor-body .editable[data-type="paragraph"]');
  await paragraphs.nth(0).click();
  await page.keyboard.press("Escape");
  await expect(page.locator('[data-selected="true"]')).toHaveText(["First paragraph"]);
  await page.keyboard.press("Shift+ArrowDown");
  await expect(page.locator('[data-selected="true"]')).toHaveText(["First paragraph", "Second paragraph"]);

  const firstBlock = page.locator(".editor-body > [data-block]").first();
  await firstBlock.hover();
  await firstBlock.getByRole("button", { name: "Drag to move, or open block actions" }).click();
  await page.getByRole("menuitem", { name: "Turn into" }).click();
  await page.getByRole("menuitem", { name: "Bulleted list" }).click();

  await expect(page.locator('.editor-body .editable[data-type="bulleted_list_item"]')).toHaveCount(2);
  await expect(page.locator('.editor-body .editable[data-type="paragraph"]')).toHaveText(["Third paragraph"]);
});

test("ArrowDown from the final table cell creates a paragraph after the table", async ({ page }) => {
  await createWorkspacePage(page, "Table playground");

  await page.locator(".editor-empty").click();
  const paragraph = page.locator('.editor-body .editable[data-type="paragraph"]');
  await paragraph.click();
  await page.keyboard.type("/table");
  await expect(page.getByRole("option", { name: "Table" })).toBeVisible();
  await paragraph.press("Enter");

  const cells = page.locator('.editable[data-type="table_cell"]');
  await expect(cells).toHaveCount(9);
  await cells.last().click();
  await page.keyboard.press("ArrowDown");

  await expect(page.locator('.editor-body > [data-block] .editable[data-type="paragraph"]')).toHaveCount(1);
  await expect(page.locator('.editor-body > [data-block] .editable[data-type="paragraph"]')).toBeFocused();
});
