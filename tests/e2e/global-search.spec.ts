import { expect, test } from "@playwright/test";

import { BASE_URL } from "./accounts";
import { agent, resourceName } from "./helpers";

test("searches workspace items by title and ID and opens the selection", async ({ page, request }, testInfo) => {
  const title = resourceName(testInfo, "Searchable notes");
  const created = await agent(request, "pages", { title, markdown: "Body" });
  const projectTitle = resourceName(testInfo, "Search project");
  const project = await agent(request, "projects", { title: projectTitle });
  const taskTitle = resourceName(testInfo, "Searchable task");
  const task = await agent(request, "tasks", { project: project.id, kind: "work", title: taskTitle });

  await page.goto("/");
  const search = page.getByRole("combobox", { name: "Search workspace" });
  const geometry = await page.locator(".global-search").boundingBox();
  expect(geometry).not.toBeNull();
  expect(Math.abs(geometry!.x + geometry!.width / 2 - (page.viewportSize()!.width / 2))).toBeLessThan(2);
  await search.fill(title);
  const pageResult = page.getByRole("option", { name: new RegExp("Searchable notes.*Pages") });
  await expect(pageResult).toBeVisible();
  await pageResult.click();
  await expect(page).toHaveURL(/\/pages\/[^/]+$/);
  await expect(search).toHaveValue("");

  await search.fill(task.id);
  const taskResult = page.getByRole("option", { name: new RegExp(`Searchable task.*Task.*${task.id}`) });
  await expect(taskResult).toBeVisible();
  await search.press("ArrowDown");
  await search.press("Enter");
  await expect(page).toHaveURL(new RegExp(`/tasks/${task.id}`));
  await expect(search).toHaveValue("");

  await search.fill(project.id);
  const projectResult = page.getByRole("option", { name: new RegExp(`Search project.*Project.*${project.id}`) });
  await expect(projectResult).toBeVisible();
  await projectResult.click();
  await expect(page).toHaveURL(new RegExp(`/projects/${project.id}`));
  await search.fill(`not-found-${created.id}`);
  await expect(page.locator(".MuiAutocomplete-noOptions")).toHaveText("No matches");
});

test("global search stays usable on a narrow screen", async ({ page, request }, testInfo) => {
  const title = resourceName(testInfo, "Mobile search result");
  await agent(request, "pages", { title });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const search = page.getByRole("combobox", { name: "Search workspace" });
  await search.fill(title);
  await expect(page.getByRole("option", { name: /Mobile search result/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test("global search requires a signed-in account", async ({ playwright }) => {
  const anonymous = await playwright.request.newContext({ baseURL: BASE_URL, storageState: { cookies: [], origins: [] } });
  try {
    const response = await anonymous.get("/api/search?q=example");
    expect(response.status()).toBe(401);
  } finally {
    await anonymous.dispose();
  }
});

test("a failed search can be retried", async ({ page, request }, testInfo) => {
  const title = resourceName(testInfo, "Retry search result");
  await agent(request, "pages", { title });
  let calls = 0;
  await page.route("**/api/search?*", async (route) => {
    if (calls++ === 0) await route.fulfill({ status: 503, body: "Unavailable" });
    else await route.continue();
  });
  await page.goto("/");
  await page.getByRole("combobox", { name: "Search workspace" }).fill(title);
  await expect(page.getByText("Search failed", { exact: true }).first()).toBeVisible();
  const response = page.waitForResponse((item) => item.url().includes("/api/search?") && item.ok());
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await response;
  await page.getByRole("combobox", { name: "Search workspace" }).click();
  await expect(page.getByRole("option", { name: /Retry search result/ })).toBeVisible();
});
