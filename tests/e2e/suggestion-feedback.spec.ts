import { expect, test } from "@playwright/test";

import { agentHeaders } from "./accounts";
import { agent, openNewTask, resourceName } from "./helpers";

test.describe.configure({ mode: "serial" });

/**
 * Spec coverage:
 * - suggestion-feedback: Requesting changes on screen (a suggestion box and an action bar; Revised after the
 *   agent's revision), Revising a suggestion (through the API)
 * - agent-api: Agents revise suggestions (listing those with changes requested, revising them)
 * - app-shell: Notification bell (suggestions with changes requested aren't counted until revised)
 */

test("the human asks for changes, the bell waits on the agent, and the agent's revisions come back for review", async ({
  page,
  request,
}, testInfo) => {
  const id = await openNewTask(page, resourceName(testInfo, "Feedback project"), "Old migration");
  const bell = page.getByRole("button", { name: /^Notifications/ });
  const before = (await bell.getAttribute("aria-label")) ?? "";

  const insert = await agent(request, "suggest", { task: id, action: "insert", markdown: "- Back up\n- Migrate" });
  const rename = await agent(request, "suggest-action", { action: "rename", task: id, title: "Migrate the old database to the new one" });

  // Live refresh brings both to the open task.
  const box = page.getByLabel("builder: Suggests adding");
  const bar = page.getByRole("status").filter({ hasText: "builder suggests renaming this work" });
  await expect(box).toBeVisible();
  await expect(bar).toBeVisible();
  await expect(bell).not.toHaveAttribute("aria-label", before);

  const ask = async (button: ReturnType<typeof page.getByRole>, text: string) => {
    await button.click();
    const dialog = page.getByRole("dialog", { name: "Request changes" });
    await expect(dialog.getByRole("button", { name: "Send" })).toBeDisabled();
    await dialog.getByRole("textbox", { name: "What should change?" }).fill(text);
    await dialog.getByRole("button", { name: "Send" }).click();
    await expect(dialog).toHaveCount(0);
  };
  await ask(box.getByRole("button", { name: "Request changes" }), "Use a numbered list");
  await expect(box).toContainText("Changes requested");
  await expect(box).toContainText("You asked: Use a numbered list");
  await ask(bar.getByRole("button", { name: "Request changes" }), "Shorter, please");
  await expect(bar).toContainText("Changes requested");
  await expect(bar).toContainText("You asked: Shorter, please");
  // Both wait on the agent now, not on the human.
  await expect(bell).toHaveAttribute("aria-label", before);

  const listed = await request.get("/api/agent/suggestions?state=changes_requested", { headers: agentHeaders("builder") });
  const ids = ((await listed.json()) as { suggestions: { id: string }[] }).suggestions.map((s) => s.id);
  expect(ids).toEqual(expect.arrayContaining([insert.id, rename.id]));

  await agent(request, `suggestion/${insert.id}/revise`, { markdown: "1. Back up\n2. Migrate", note: "Numbered now" });
  await agent(request, `suggestion/${rename.id}/revise`, { title: "Migrate the database", note: "Shortened" });
  await expect(box).toContainText("Revised");
  await expect(box).toContainText("Numbered now");
  await expect(bar).toContainText("Revised");
  await expect(bar).toContainText('suggests renaming this work to "Migrate the database"');
  await expect(bell).not.toHaveAttribute("aria-label", before);

  await bar.getByRole("button", { name: "Approve" }).click();
  await expect(page.getByRole("textbox", { name: "Title" })).toHaveText("Migrate the database");
  await box.getByRole("button", { name: "Approve" }).click();
  await expect(page.locator('.editor-body .editable[data-type="numbered_list_item"]')).toHaveText(["Back up", "Migrate"]);
  await expect(bell).toHaveAttribute("aria-label", before);
});
