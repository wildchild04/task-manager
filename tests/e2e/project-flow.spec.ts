import { expect, test } from "@playwright/test";

import { createWorkspacePage, openHomeDialog, paragraphs, resourceName, saveTitle, writeParagraphs } from "./helpers";

test.describe.configure({ mode: "serial" });

/**
 * Spec coverage:
 * - project-screens: Create a project; Quick-add work
 * - app-shell: project navigation and project sections
 *
 * This deliberately crosses the browser, route actions/loaders, service wiring
 * and SQLite instead of calling view-model helpers directly.
 */
test("a user creates a project and quick-adds work from its navigation", async ({ page }, testInfo) => {
  const projectName = resourceName(testInfo, "Taskhub");
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Home" })).toBeVisible();

  // The main-page action has text, unlike the shell's icon-only action.
  const dialog = await openHomeDialog(page, "New project");
  await dialog.getByRole("textbox", { name: "Title" }).fill(projectName);
  await dialog.getByRole("button", { name: "Create", exact: true }).click();

  await expect(page).toHaveURL(/\/projects\/[^/]+$/);
  const projectPath = new URL(page.url()).pathname;
  await expect(page.getByRole("heading", { name: projectName })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Projects" }).locator(`a[href="${projectPath}"]`)).toBeVisible();

  await page.getByRole("navigation", { name: `${projectName} sections` }).getByRole("link", { name: "Work" }).click();
  await expect(page).toHaveURL(/\/projects\/[^/]+\/work$/);

  const quickAdd = page.getByRole("textbox", { name: "New work title" });
  await quickAdd.fill("Add login");
  await quickAdd.press("Enter");

  await expect(page.getByRole("link", { name: "Add login" })).toBeVisible();
  await expect(page.getByText("To do", { exact: true })).toBeVisible();
});

test("a page can create a sub-page through the slash menu", async ({ page }, testInfo) => {
  await createWorkspacePage(page, resourceName(testInfo, "Editor parent"));

  await page.locator(".editor-empty").click();
  const paragraph = page.locator('.editor-body .editable[data-type="paragraph"]');
  await paragraph.click();
  await page.keyboard.type("/page");
  await expect(page.getByRole("option", { name: "Page" })).toBeVisible();
  const parentUrl = page.url();
  await paragraph.press("Enter");

  await expect(page).not.toHaveURL(parentUrl);
  await expect(page.getByRole("textbox", { name: "Title" })).toBeFocused();
  const childName = resourceName(testInfo, "Child page");
  await saveTitle(page, childName);
  await expect(page.getByRole("complementary", { name: "Workspace navigation" }).getByText(childName, { exact: true })).toBeVisible({
    timeout: 15_000,
  });
});

test("selected blocks can be turned into a list from the block-action menu", async ({ page }, testInfo) => {
  await createWorkspacePage(page, resourceName(testInfo, "Selection playground"));
  await writeParagraphs(page, ["First paragraph", "Second paragraph", "Third paragraph"]);

  const items = paragraphs(page);
  await items.nth(0).click();
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

test("ArrowDown from the final table cell creates a paragraph after the table", async ({ page }, testInfo) => {
  await createWorkspacePage(page, resourceName(testInfo, "Table playground"));

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

test("the add button and formatting bar edit a block through visible controls", async ({ page }, testInfo) => {
  await createWorkspacePage(page, resourceName(testInfo, "Editor controls"));
  await writeParagraphs(page, ["Format me"]);
  const paragraph = paragraphs(page);
  await paragraph.click();
  await paragraph.press("Control+a");

  const formatting = page.getByRole("toolbar", { name: "Formatting" });
  await expect(formatting).toBeVisible();
  await formatting.getByRole("button", { name: /Bold/ }).click();
  await expect(paragraph.locator("strong")).toHaveText("Format me");

  const block = page.locator(".editor-body > [data-block]").first();
  await block.hover();
  await block.getByRole("button", { name: "Add a block below (Alt+click: above)" }).click();
  await expect(paragraphs(page)).toHaveCount(2);
});

test("block-selection shortcuts duplicate selected blocks and undo restores the selection", async ({ page }, testInfo) => {
  await createWorkspacePage(page, resourceName(testInfo, "Block shortcuts"));
  await writeParagraphs(page, ["One", "Two", "Three"]);

  await paragraphs(page).nth(1).click();
  await page.keyboard.press("Escape");
  await page.keyboard.press("Shift+ArrowDown");
  await expect(page.locator('[data-selected="true"]')).toHaveText(["Two", "Three"]);

  await page.keyboard.press("Control+d");
  await expect(paragraphs(page)).toHaveText(["One", "Two", "Three", "Two", "Three"]);
  await expect(page.locator('[data-selected="true"]')).toHaveText(["Two", "Three"]);

  await page.keyboard.press("Control+z");
  await expect(paragraphs(page)).toHaveText(["One", "Two", "Three"]);
  await expect(page.locator('[data-selected="true"]')).toHaveText(["Two", "Three"]);
});

test("dragging a block moves it as a single undoable editor operation", async ({ page }, testInfo) => {
  await createWorkspacePage(page, resourceName(testInfo, "Block drag"));
  await writeParagraphs(page, ["First", "Second", "Third"]);

  const blocks = page.locator(".editor-body > [data-block]");
  await blocks.first().hover();
  const handle = await blocks.first().getByRole("button", { name: "Drag to move, or open block actions" }).boundingBox();
  const target = await blocks.nth(2).boundingBox();
  if (!handle || !target) throw new Error("Editor block geometry was unavailable");

  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
  await page.mouse.down();
  await page.mouse.move(target.x + target.width / 2, target.y + target.height + 8, { steps: 12 });
  await page.mouse.up();
  await expect(paragraphs(page)).toHaveText(["Second", "Third", "First"]);

  await page.keyboard.press("Control+z");
  await expect(paragraphs(page)).toHaveText(["First", "Second", "Third"]);
});

test("typing over a drag selection spanning paragraphs replaces and joins them", async ({ page }, testInfo) => {
  await createWorkspacePage(page, resourceName(testInfo, "Cross-block selection"));
  await writeParagraphs(page, ["Alpha one", "Beta two"]);

  const first = await paragraphs(page).nth(0).boundingBox();
  const second = await paragraphs(page).nth(1).boundingBox();
  if (!first || !second) throw new Error("Editor paragraph geometry was unavailable");

  await page.mouse.move(first.x + 42, first.y + first.height / 2);
  await page.mouse.down();
  await page.mouse.move(second.x + 38, second.y + second.height / 2, { steps: 12 });
  await page.mouse.up();
  await page.keyboard.type("X");

  await expect(paragraphs(page)).toHaveCount(1);
  await expect(paragraphs(page)).toContainText("X");
});

test("copying and pasting a block selection preserves its block structure", async ({ page }, testInfo) => {
  await createWorkspacePage(page, resourceName(testInfo, "Clipboard"));
  await writeParagraphs(page, ["Copy me", "Paste target"]);

  await paragraphs(page).first().click();
  await page.keyboard.press("Escape");
  const markdown = await page.locator(".page-editor").evaluate((root) => {
    const clipboard = new DataTransfer();
    const event = new Event("copy", { bubbles: true, cancelable: true });
    Object.defineProperty(event, "clipboardData", { value: clipboard });
    root.dispatchEvent(event);
    return clipboard.getData("application/x-taskhub-markdown");
  });
  expect(markdown).toContain("Copy me");
  await paragraphs(page).nth(1).click();
  await page.keyboard.press("End");
  await page.keyboard.press("Enter");
  await paragraphs(page).nth(2).evaluate((target, value) => {
    const clipboard = new DataTransfer();
    clipboard.setData("application/x-taskhub-markdown", value);
    clipboard.setData("text/plain", value);
    const event = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(event, "clipboardData", { value: clipboard });
    target.dispatchEvent(event);
  }, markdown);

  await expect(paragraphs(page)).toHaveText(["Copy me", "Paste target", "Copy me"]);
});
