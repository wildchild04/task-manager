import { expect, type Page, test } from "@playwright/test";

import { OWNER } from "./accounts";
import { resourceName } from "./helpers";

/**
 * Spec coverage:
 * - accounts: Signing in and out (back to where I was; wrong password; sign out)
 * - accounts: Everything requires signing in
 * - agent-tokens: Registering agents, Showing a token again, Revoking agents, The settings page
 * - app-shell: Account menu
 *
 * These tests sign in with their own session: signing out ends it, and the shared one must survive.
 */
test.use({ storageState: { cookies: [], origins: [] } });

async function signIn(page: Page, password = OWNER.password) {
  await page.getByRole("textbox", { name: "Email" }).fill(OWNER.email.toUpperCase());
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

test("signing in goes back to the page asked for, and signing out locks the app again", async ({ page, request }) => {
  await page.goto("/settings");
  await expect(page).toHaveURL(/\/login\?next=%2Fsettings$/);
  expect((await request.post("/api/edits", { data: {} })).status()).toBe(401);

  await signIn(page, "not the password");
  await expect(page.getByRole("alert")).toHaveText("Wrong email or password");
  await signIn(page);
  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.getByText(`Signed in as ${OWNER.email}`)).toBeVisible();

  await page.getByRole("button", { name: `Account: ${OWNER.email}` }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/");
  await expect(page).toHaveURL(/\/login\?next=%2F$/);
});

test("an agent registered in Settings works with its token until revoked", async ({ page, request }, testInfo) => {
  const name = resourceName(testInfo, "e2e").replace(/[^A-Za-z0-9]+/g, "-").slice(0, 40);
  await page.goto("/settings");
  await signIn(page);
  await expect(page).toHaveURL(/\/settings$/);

  await page.getByRole("textbox", { name: "Agent name" }).fill(name);
  await page.getByRole("button", { name: "Register agent" }).click();
  const dialog = page.getByRole("dialog", { name: `${name}'s token` });
  await expect(dialog).toContainText("You can show it again here, after your password.");
  const line = (await dialog.locator("code").textContent())!;
  expect(line).toMatch(/^AGENT_TOKEN=ntm_/);
  await dialog.getByRole("button", { name: "Done" }).click();

  const authorization = `Bearer ${line.slice("AGENT_TOKEN=".length)}`;
  const asAgent = () => request.get("/api/agent/projects", { headers: { authorization } });
  expect((await asAgent()).status()).toBe(200);
  await expect(page.getByText(name, { exact: true })).toBeVisible();

  // Shown again, after the password.
  const row = page.getByText(name, { exact: true }).locator("xpath=ancestor::li");
  await row.getByRole("button", { name: "Show token…" }).click();
  const ask = page.getByRole("dialog", { name: `Show ${name}'s token` });
  await ask.getByLabel("Password").fill("not the password");
  await ask.getByRole("button", { name: "Show" }).click();
  await expect(ask.getByText("Wrong password")).toBeVisible();
  await ask.getByLabel("Password").fill(OWNER.password);
  await ask.getByRole("button", { name: "Show" }).click();
  const again = page.getByRole("dialog", { name: `${name}'s token` });
  await expect(again.locator("code")).toHaveText(line);
  await again.getByRole("button", { name: "Done" }).click();

  await page.getByText(name, { exact: true }).locator("xpath=ancestor::li").getByRole("button", { name: "Revoke" }).click();
  await page.getByRole("dialog", { name: `Revoke ${name}'s token?` }).getByRole("button", { name: "Revoke" }).click();
  await expect(page.getByText(name, { exact: true })).toHaveCount(0);
  expect((await asAgent()).status()).toBe(401);
});
