import { expect, test } from "@playwright/test";

import { agent, resourceName } from "./helpers";

/**
 * Spec coverage:
 * - app-shell: App shell and navigation (the page scrolls as a whole, with no inner scroll bar under the top bar)
 */

test("document pages widen at large viewport breakpoints", async ({ page, request }, testInfo) => {
  const title = resourceName(testInfo, "Responsive document");
  await agent(request, "pages", { title, markdown: "Document content" });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  await page.getByRole("link", { name: title, exact: true }).first().click();
  const documentPage = page.locator(".document-page");
  for (const [width, expected] of [[1280, 760], [1600, 920], [2200, 1080], [2800, 1240]] as const) {
    await page.setViewportSize({ width, height: 800 });
    await expect.poll(async () => (await documentPage.boundingBox())?.width).toBe(expected);
  }
});

test("a page ending in a code block scrolls with the window, not inside the shell", async ({ page, request }, testInfo) => {
  const title = resourceName(testInfo, "Ends in code");
  const lines = Array.from({ length: 40 }, (_, i) => `line ${i + 1}`).join("\n");
  await agent(request, "pages", { title, markdown: `Some text first.\n\n\`\`\`ruby\n${lines}\n\`\`\`\n` });

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  await page.getByRole("link", { name: title }).first().click();
  await expect(page.locator(".editor-code")).toBeVisible();

  // The code surface's "Copied" announcer is 1px, not as tall as the code block, so nothing hangs below the page.
  const main = page.locator('[data-page-shell="main"]');
  const overflow = await main.evaluate((element) => element.scrollHeight - element.clientHeight);
  expect(overflow).toBeLessThanOrEqual(1);
  const status = page.locator('.editor-code span[role="status"]');
  expect(await status.evaluate((element) => element.getBoundingClientRect().height)).toBeLessThanOrEqual(1);
});

test("a long mention wraps inside an editor table cell", async ({ page, request }, testInfo) => {
  const longTitle = resourceName(testInfo, `A very long task title ${"withoutbreaks".repeat(12)}`);
  const target = await agent(request, "pages", { title: longTitle });
  const title = resourceName(testInfo, "Mention table");
  await agent(request, "pages", {
    title,
    markdown: `| Mention | Other |\n| --- | --- |\n| @[${longTitle}](page:${target.id}) | Value |`,
  });

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  await page.getByRole("link", { name: title, exact: true }).first().click();
  const mention = page.locator('.editable[data-type="table_cell"] .mention');
  await expect(mention).toHaveCount(1);
  const dimensions = await mention.evaluate((element) => {
    const cell = element.closest("td, th")!;
    const table = element.closest("table")!;
    const range = document.createRange();
    range.selectNode(element);
    return { lines: range.getClientRects().length, cellWidth: cell.getBoundingClientRect().width, tableWidth: table.getBoundingClientRect().width, available: table.parentElement!.clientWidth };
  });
  expect(dimensions.lines).toBeGreaterThan(1);
  expect(dimensions.cellWidth).toBeLessThan(dimensions.available);
  expect(dimensions.tableWidth).toBeLessThanOrEqual(dimensions.available + 1);
});
