import { expect, type Page, type TestInfo } from "@playwright/test";

export async function openHomeDialog(page: Page, name: "New page" | "New project") {
  const button = page.getByRole("heading", { name: "Home" }).locator("xpath=..").getByRole("button", { name, exact: true });
  const dialog = page.getByRole("dialog", { name });
  // Retry only when the dialog has not opened; this avoids assuming a fixed
  // client-startup delay while testing the observable UI state.
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

export async function createWorkspacePage(page: Page, title: string) {
  await page.goto("/");
  const dialog = await openHomeDialog(page, "New page");
  await dialog.getByRole("textbox", { name: "Title" }).fill(title);
  await dialog.getByRole("button", { name: "Create", exact: true }).click();
  await expect(page).toHaveURL(/\/pages\/[^/]+$/);
  await expect(page.locator(".page-editor")).toBeVisible();
}

export async function saveTitle(page: Page, title: string) {
  const titleBox = page.getByRole("textbox", { name: "Title" });
  // A slash-created page navigates before the editor's document listeners have
  // necessarily attached. Retry the observable save, rather than sleeping and
  // risking text that the browser inserted but the editor never received.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await titleBox.click();
    await page.keyboard.press("Control+a");
    const saved = page.waitForResponse((response) => response.url().endsWith("/api/edits") && response.ok(), { timeout: 2_000 });
    await page.keyboard.type(title);
    try {
      await saved;
      await expect(titleBox).toHaveText(title);
      return;
    } catch {
      // The client was still hydrating; retry the actual editor operation.
    }
  }
  throw new Error("The new page title was not saved");
}

export async function writeParagraphs(page: Page, values: string[]) {
  await page.locator(".editor-empty").click();
  const first = page.locator('.editor-body .editable[data-type="paragraph"]');
  await first.click();
  for (const [index, value] of values.entries()) {
    await page.keyboard.type(value);
    if (index < values.length - 1) await page.keyboard.press("Enter");
  }
}

export const paragraphs = (page: Page) => page.locator('.editor-body .editable[data-type="paragraph"]');

// The web server is shared by Playwright projects, repeats and retries, so
// fixtures must identify each of those passes within the SQLite database.
export const resourceName = (testInfo: TestInfo, title: string) =>
  `${title} (${testInfo.project.name} repeat ${testInfo.repeatEachIndex} retry ${testInfo.retry})`;

