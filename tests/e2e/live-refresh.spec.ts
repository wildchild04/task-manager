import { expect, type Page, test } from "@playwright/test";

import { agent, createWorkspacePage, openNewTask, paragraphs, resourceName, writeParagraphs } from "./helpers";

test.describe.configure({ mode: "serial" });

/**
 * Spec coverage:
 * - live-refresh: Open tabs refresh themselves (a second tab follows; an agent's comment appears; own saves don't refresh)
 * - block-editor: Saving edits (an agent appends to the open description; unsaved edits are kept)
 */

/** Waits until the editor's edits are all saved. */
const saved = (page: Page) => expect(page.getByRole("status", { name: "Saved" })).toBeVisible();

/** The paragraph block holding the DOM caret, by its text. */
const caretParagraph = (page: Page) =>
  page.evaluate(() => {
    const node = window.getSelection()?.anchorNode;
    const element = node instanceof Element ? node : node?.parentElement;
    return element?.closest('[data-type="paragraph"]')?.textContent ?? null;
  });

test("a second tab shows a paragraph added in the first", async ({ page, context }, testInfo) => {
  await createWorkspacePage(page, resourceName(testInfo, "Shared page"));
  const other = await context.newPage();
  await other.goto(page.url());
  await expect(other.locator(".page-editor")).toBeVisible();

  await writeParagraphs(page, ["Written in the first tab"]);
  await saved(page);
  await expect(paragraphs(other)).toHaveText(["Written in the first tab"]);
});

test("an agent's comment and returned work appear on the open task and in the bell", async ({ page, request }, testInfo) => {
  const id = await openNewTask(page, resourceName(testInfo, "Live project"), "Live task");
  const bell = page.getByRole("button", { name: /^Notifications/ });
  const before = (await bell.getAttribute("aria-label")) ?? "";

  await agent(request, `task/${id}/comment`, { markdown: "Looking into it" });
  await expect(page.getByRole("tab", { name: "Comments (1)" })).toBeVisible();

  await agent(request, `task/${id}/transition`, { name: "start" });
  await agent(request, `task/${id}/transition`, { name: "return", reason: "Needs an API key" });
  await expect(page.getByRole("tab", { name: "Comments (2)" })).toBeVisible();
  await expect(bell).not.toHaveAttribute("aria-label", before);
  await bell.click();
  await expect(page.getByText("Returned by builder").first()).toBeVisible();
  await page.keyboard.press("Escape");

  await page.getByRole("tab", { name: "Comments (2)" }).click();
  await expect(page.getByText("Looking into it")).toBeVisible();
  await expect(page.getByText("Needs an API key")).toBeVisible();
});

test("the caret stays in its paragraph when an agent appends to the open description", async ({ page, request }, testInfo) => {
  const id = await openNewTask(page, resourceName(testInfo, "Caret project"), "Caret task");
  await writeParagraphs(page, ["First", "Second"]);
  await paragraphs(page).nth(1).click();
  await page.keyboard.press("End");
  await saved(page);
  expect(await caretParagraph(page)).toBe("Second");

  await agent(request, `task/${id}/description`, { markdown: "From the agent" });
  await expect(paragraphs(page)).toHaveText(["First", "Second", "From the agent"]);
  expect(await caretParagraph(page)).toBe("Second");
  await page.keyboard.type("!");
  await expect(paragraphs(page)).toHaveText(["First", "Second!", "From the agent"]);
});

test("unsaved edits survive a change made elsewhere, which appears once they're saved", async ({ page, request }, testInfo) => {
  const id = await openNewTask(page, resourceName(testInfo, "Unsaved project"), "Unsaved task");
  await writeParagraphs(page, ["Mine"]);
  await saved(page);

  // Hold the next save back until the agent's change has been shown to the tab.
  let release!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route("**/api/edits", async (route) => {
    await held;
    await route.continue();
  });
  await page.keyboard.type(" and more");
  await expect(page.getByRole("status", { name: "Saving…" })).toBeVisible();
  const reread = page.waitForResponse((response) => response.url().includes(".data"));
  await agent(request, `task/${id}/description`, { markdown: "Theirs" });
  await reread;
  await expect(paragraphs(page)).toHaveText(["Mine and more"]);

  release();
  await page.unroute("**/api/edits");
  await expect(paragraphs(page)).toHaveText(["Mine and more", "Theirs"]);
  await saved(page);
  await page.reload();
  await expect(paragraphs(page)).toHaveText(["Mine and more", "Theirs"]);
});

test("the tab's own typing doesn't re-read the screen", async ({ page }, testInfo) => {
  await createWorkspacePage(page, resourceName(testInfo, "Quiet page"));
  const rereads: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes(".data")) rereads.push(request.url());
  });
  await writeParagraphs(page, ["One", "Two", "Three"]);
  await saved(page);
  await page.keyboard.type(" more");
  await saved(page);
  // Longer than the refresh's coalescing delay.
  await page.waitForTimeout(500);
  expect(rereads).toEqual([]);
});
