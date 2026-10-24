import { expect, type Locator, type Page, test } from "@playwright/test";

import { agent, openNewTask, resourceName } from "./helpers";

test.describe.configure({ mode: "serial" });

/**
 * Spec coverage:
 * - vim-mode: the setting, modes and indicator, Normal-mode input, motions, Insert, operators, Visual, the leader, shortcuts
 * - block-editor: Block selection (Space then Esc in Vim mode)
 */

const DESCRIPTION = [
  "one two three four",
  "abcdef",
  "uvwxyz",
  "![Pic](https://example.com/pic.png)",
  "after image",
  "```text\nline one\nline two\nline three\n```",
  "- item one",
  "- [ ] Buy milk",
  "old value",
].join("\n\n");

const toggle = (page: Page) => page.getByRole("button", { name: "Vim mode" });
const indicator = (page: Page) => page.locator(".vim-mode");
/** The text block (of any type) holding exactly `text`. */
const block = (page: Page, text: string | RegExp) =>
  page.locator(".editor-body .editable").filter({ hasText: typeof text === "string" ? new RegExp(`^${escape(text)}$`) : text });
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const texts = (page: Page) => page.locator(".editor-body .editable").allTextContents();

/** Where the DOM caret is: its block's text and the offset in it. */
const caretAt = (page: Page) =>
  page.evaluate(() => {
    const selection = window.getSelection()!;
    const node = selection.focusNode!;
    const element = (node instanceof Element ? node : node.parentElement)!.closest<HTMLElement>("[data-block-id]")!;
    const range = document.createRange();
    range.selectNodeContents(element);
    range.setEnd(node, selection.focusOffset);
    return { text: element.textContent, offset: range.toString().length };
  });

/** Presses keys one by one; `<Esc>` and `<Space>` are named. */
async function keys(page: Page, sequence: string) {
  for (const token of sequence.match(/<[^>]+>|./gsu) ?? []) {
    if (token === "<Esc>") await page.keyboard.press("Escape");
    else if (token === "<Space>") await page.keyboard.press(" ");
    else await page.keyboard.press(token);
  }
}

/** Clicks into a block and puts the Normal-mode cursor at its start. */
async function into(page: Page, target: Locator) {
  await target.click();
  await keys(page, "0");
}

/** A task whose description holds the fixture, open, with Vim mode on. */
async function openFixture(page: Page, request: Parameters<typeof agent>[0], name: string) {
  const id = await openNewTask(page, name, "Vim task");
  await agent(request, `task/${id}/description`, { markdown: DESCRIPTION });
  await expect(block(page, "old value")).toBeVisible();
  if ((await toggle(page).getAttribute("aria-pressed")) !== "true") await toggle(page).click();
  await expect(indicator(page)).toHaveText(/^NORMAL/);
}

test("Vim mode is off by default, turned on with the header toggle and kept across reloads", async ({ page, request }, testInfo) => {
  const id = await openNewTask(page, resourceName(testInfo, "Vim setting"), "Setting task");
  await agent(request, `task/${id}/description`, { markdown: "Hello" });
  await expect(block(page, "Hello")).toBeVisible();
  await expect(toggle(page)).toHaveAttribute("aria-pressed", "false");
  await expect(indicator(page)).toHaveCount(0);

  // Off, the editor types as usual.
  await block(page, "Hello").click();
  await page.keyboard.press("End");
  await page.keyboard.type("jk");
  await expect(block(page, "Hellojk")).toBeVisible();

  await toggle(page).click();
  await expect(indicator(page)).toHaveText(/^NORMAL/);
  await page.reload();
  await expect(toggle(page)).toHaveAttribute("aria-pressed", "true");
  await expect(indicator(page)).toHaveText(/^NORMAL/);

  // Normal mode swallows typing; the title keeps its keys.
  await block(page, "Hellojk").click();
  await keys(page, "qz");
  await expect(block(page, "Hellojk")).toBeVisible();
  const title = page.getByRole("textbox", { name: "Title" });
  await title.click();
  await page.keyboard.press("End");
  await page.keyboard.type("jk");
  await expect(title).toHaveText("Setting taskjk");

  // ? in Normal mode, or a click on the indicator, lists the keys; closing goes back to the editor.
  await into(page, block(page, "Hellojk"));
  await keys(page, "?");
  const help = page.getByRole("dialog", { name: "Vim mode keys" });
  await expect(help).toBeVisible();
  await expect(help.getByText("The first or last line of the cursor's block")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(help).toHaveCount(0);
  await keys(page, "x");
  await expect(block(page, "ellojk")).toBeVisible();
  await indicator(page).getByText(/NORMAL/).click();
  await expect(help).toBeVisible();
  await help.getByRole("button", { name: "Close" }).click();
  await expect(help).toHaveCount(0);

  await toggle(page).click();
  await expect(indicator(page)).toHaveCount(0);
});

test("motions: counts, j across blocks and onto an image, gg and G in a code block", async ({ page, request }, testInfo) => {
  await openFixture(page, request, resourceName(testInfo, "Vim motions"));
  await into(page, block(page, "one two three four"));
  await keys(page, "3w");
  expect(await caretAt(page)).toEqual({ text: "one two three four", offset: 14 });
  await keys(page, "$");
  expect(await caretAt(page)).toEqual({ text: "one two three four", offset: 17 });
  // The title is out of reach: k stays in the first block.
  await keys(page, "k");
  expect(await caretAt(page)).toEqual({ text: "one two three four", offset: 17 });
  await expect(indicator(page)).toHaveText(/^NORMAL/);

  await into(page, block(page, "abcdef"));
  await keys(page, "llj");
  expect(await caretAt(page)).toEqual({ text: "uvwxyz", offset: 2 });
  await keys(page, "j");
  await expect(page.locator('[data-selected="true"] .block-image')).toBeVisible();
  await keys(page, "j");
  await expect(page.locator('[data-selected="true"]')).toHaveCount(0);
  expect((await caretAt(page)).text).toBe("after image");

  await block(page, /^line one/).click();
  await keys(page, "ggjll");
  expect(await caretAt(page)).toEqual({ text: "line one\nline two\nline three", offset: 11 });
  await keys(page, "G");
  expect(await caretAt(page)).toEqual({ text: "line one\nline two\nline three", offset: 18 });
  await keys(page, "gg");
  expect(await caretAt(page)).toEqual({ text: "line one\nline two\nline three", offset: 0 });
});

test("Insert mode: A and o in a list, Esc back to Normal", async ({ page, request }, testInfo) => {
  await openFixture(page, request, resourceName(testInfo, "Vim insert"));
  await into(page, block(page, "item one"));
  await keys(page, "A");
  await expect(indicator(page)).toHaveText(/^INSERT/);
  await page.keyboard.type("!");
  await keys(page, "<Esc>");
  await expect(indicator(page)).toHaveText(/^NORMAL/);
  await expect(block(page, "item one!")).toBeVisible();
  // The block cursor shows over the last character in Normal mode, and goes in Insert.
  const cursor = page.locator(".vim-cursor");
  await expect(cursor).toBeVisible();
  const box = (await cursor.boundingBox())!;
  expect(box.width).toBeGreaterThan(2);
  await keys(page, "o");
  await expect(cursor).toBeHidden();
  await page.keyboard.type("item two");
  await keys(page, "<Esc>");
  await expect(page.locator('.editor-body .editable[data-type="bulleted_list_item"]')).toHaveText(["item one!", "item two"]);
});

test("operators: dd, yy p, cw and 3x, with undo", async ({ page, request }, testInfo) => {
  await openFixture(page, request, resourceName(testInfo, "Vim operators"));
  await into(page, block(page, "abcdef"));
  await keys(page, "3x");
  await expect(block(page, "def")).toBeVisible();
  await keys(page, "u");
  await expect(block(page, "abcdef")).toBeVisible();

  await keys(page, "dd");
  await expect(block(page, "abcdef")).toHaveCount(0);
  expect((await caretAt(page)).text).toBe("uvwxyz");
  await keys(page, "u");
  await expect(block(page, "abcdef")).toBeVisible();

  await into(page, block(page, "Buy milk"));
  await keys(page, "yyp");
  await expect(block(page, "Buy milk")).toHaveCount(2);
  await keys(page, "u");
  await expect(block(page, "Buy milk")).toHaveCount(1);

  await into(page, block(page, "old value"));
  await keys(page, "cw");
  await page.keyboard.type("new");
  await keys(page, "<Esc>");
  await expect(block(page, "new value")).toBeVisible();
});

test("Visual mode deletes across blocks, and Ctrl+B bolds a Visual selection", async ({ page, request }, testInfo) => {
  await openFixture(page, request, resourceName(testInfo, "Vim visual"));
  await into(page, block(page, "abcdef"));
  await keys(page, "llv");
  await expect(indicator(page)).toHaveText(/^VISUAL/);
  await keys(page, "jd");
  await expect(indicator(page)).toHaveText(/^NORMAL/);
  await expect(block(page, "abxyz")).toBeVisible();
  await expect(block(page, "uvwxyz")).toHaveCount(0);

  await into(page, block(page, "one two three four"));
  await keys(page, "wve");
  await page.keyboard.press("ControlOrMeta+b");
  await expect(block(page, "one two three four").locator("strong")).toHaveText("two");
  await keys(page, "<Esc>");
  await expect(indicator(page)).toHaveText(/^NORMAL/);
});

test("the leader opens the slash and mention menus and selects the block; Esc closes a menu first", async ({ page, request }, testInfo) => {
  await openFixture(page, request, resourceName(testInfo, "Vim leader"));
  await into(page, block(page, "after image"));
  await keys(page, "$<Space>/");
  await expect(indicator(page)).toHaveText(/^INSERT/);
  const menu = page.getByRole("listbox", { name: "Turn into" });
  await expect(menu).toBeVisible();
  await keys(page, "<Esc>");
  await expect(menu).toHaveCount(0);
  await expect(indicator(page)).toHaveText(/^INSERT/);
  await keys(page, "<Esc>");
  await expect(indicator(page)).toHaveText(/^NORMAL/);
  await keys(page, "x");
  await expect(block(page, "after image")).toBeVisible();

  await keys(page, "<Space>@");
  await expect(page.getByRole("listbox", { name: "Mention a page" })).toBeVisible();
  await keys(page, "<Esc><Esc>x");
  await expect(block(page, "after image")).toBeVisible();

  // Esc alone does nothing in Normal mode; Space then Esc selects the block.
  await keys(page, "<Esc>");
  await expect(page.locator('[data-selected="true"]')).toHaveCount(0);
  await keys(page, "<Space><Esc>");
  await expect(page.locator('[data-selected="true"]')).toHaveCount(1);
  await keys(page, "<Esc>");
  await expect(page.locator('[data-selected="true"]')).toHaveCount(0);
  await expect(indicator(page)).toHaveText(/^NORMAL/);
});
