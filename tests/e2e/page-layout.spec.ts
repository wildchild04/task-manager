import { expect, test } from "@playwright/test";

import { agent, resourceName } from "./helpers";

/**
 * Spec coverage:
 * - app-shell: App shell and navigation (the page scrolls as a whole, with no inner scroll bar under the top bar)
 */

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
