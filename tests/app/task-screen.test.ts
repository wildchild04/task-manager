import { beforeEach, describe, expect, it } from "vitest";

import type { ActionResult } from "../../app/lib/forms.server";
import { taskAction } from "../../app/lib/task-actions.server";
import { taskOverviewView } from "../../app/lib/task-overview.server";
import { applyEdit } from "../../app/lib/page-edit.server";
import { paragraphsFromText } from "../../app/lib/text.server";
import { type AppServices, createInMemoryServices } from "~/composition";

/** A comment as the editor posts it: its blocks as JSON (here, paragraphs of plain text). */
const blocksOf = (text: string) => JSON.stringify(paragraphsFromText(text));

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
};

describe("task screen", () => {
  let services: AppServices;

  beforeEach(() => {
    services = createInMemoryServices({ now: () => "2026-10-14T08:00:00.000Z", timeZone: "UTC" }); // a Wednesday
    services.projects.create({ id: "P", title: "Taskhub" });
  });

  const create = (id: string, kind: "exploration" | "work" | "chore", title = id, attributes?: Record<string, unknown>) =>
    services.tasks.create({ id, projectId: "P", kind, title, ...(attributes ? { attributes } : {}) });
  const post = (taskId: string, fields: Record<string, string>) => taskAction(services, taskId, form(fields)) as ActionResult;
  const transition = (taskId: string, name: string, fields: Record<string, string> = {}) =>
    post(taskId, { intent: "transition", transition: name, ...fields });
  const view = (taskId: string) => taskOverviewView(services, taskId)!;
  const doneWork = (id: string) => {
    create(id, "work");
    services.tasks.transition(id, "start");
    services.tasks.transition(id, "complete");
  };
  const weekly = { schedule: { type: "frequency", every: "weekly", weekday: 1, time: "09:00" } };

  describe("transitions", () => {
    it("offers only the transitions allowed from the current state", () => {
      create("W", "work");
      services.tasks.transition("W", "start");
      expect(view("W").transitions.map((t) => t.name)).toEqual(["pause", "return", "complete", "cancel"]);
      expect(view("W").transitions.find((t) => t.name === "return")).toMatchObject({ label: "Return", form: "return" });
    });

    it("starts work and records the human in the history", () => {
      create("W", "work");
      expect(transition("W", "start")).toMatchObject({ ok: true });
      expect(view("W").task.state).toBe("in_progress");
      expect(view("W").history).toEqual([
        expect.objectContaining({ label: "Start", from: "To do", to: "In progress", actor: "You" }),
      ]);
    });

    it("revives a tombstoned exploration", () => {
      create("E", "exploration");
      transition("E", "tombstone");
      transition("E", "revive");
      expect(view("E").task.state).toBe("open");
      expect(view("E").transitions.map((t) => t.name)).toEqual(["promote", "tombstone"]);
    });

    it("shows a rejected transition as a form error", () => {
      create("W", "work");
      expect(transition("W", "complete")).toMatchObject({ ok: false, formError: "Cannot complete a work that is todo" });
    });
  });

  describe("promote", () => {
    it("creates the work born from the idea and opens it", () => {
      create("E", "exploration", "Passkeys");
      const result = transition("E", "promote", { title: "Add passkey login" });
      expect(result).toMatchObject({ ok: true });
      const workId = result.ok ? result.id : "";
      expect(result).toMatchObject({ redirectTo: `/tasks/${workId}` });
      expect(services.tasks.get(workId)).toMatchObject({ kind: "work", title: "Add passkey login" });
      expect(view("E").task.state).toBe("promoted");
    });

    it("rejects an empty title", () => {
      create("E", "exploration");
      expect(transition("E", "promote", { title: " " })).toMatchObject({
        ok: false,
        fieldErrors: { title: "A title is required" },
      });
      expect(view("E").task.state).toBe("open");
    });
  });

  describe("return", () => {
    beforeEach(() => {
      create("W", "work");
      services.blocks.apply([
        {
          op: "insert",
          block: { id: "intro", type: "paragraph", content: [{ text: "Intro" }] },
          parentId: services.tasks.get("W")!.bodyPageId,
        },
      ]);
      services.tasks.transition("W", "start");
    });

    it("posts the reason as a comment, notes it in history and appends the description", () => {
      expect(
        transition("W", "return", { reason: "Blocked on the API key", description: "Needs the staging key first." }),
      ).toMatchObject({ ok: true });
      const screen = view("W");
      expect(screen.task.state).toBe("todo");
      const returned = screen.comments!.at(-1)!;
      expect(returned.author).toBe("You");
      expect(returned.blocks.map((b) => (b.kind === "content" ? b.content[0]?.text : b.kind))).toEqual([
        "Blocked on the API key",
      ]);
      expect(screen.history[0]).toMatchObject({ label: "Return", note: "Blocked on the API key" });
      expect(screen.body!.blocks.map((b) => (b.kind === "content" ? b.content[0]?.text : b.kind))).toEqual([
        "Intro",
        "Needs the staging key first.",
      ]);
    });

    it("requires a reason", () => {
      expect(transition("W", "return", { reason: "" })).toMatchObject({
        ok: false,
        fieldErrors: { reason: "A return needs a reason" },
      });
      expect(view("W").task.state).toBe("in_progress");
    });
  });

  describe("chores", () => {
    const series = () => services.chores.series("C");

    it("asks for a follower, yes by default when the chore repeats", () => {
      create("C", "chore", "Water plants", weekly);
      expect(view("C").chore!.follower).toEqual({ offered: true, default: true });
      create("D", "chore", "Renew", { schedule: { type: "date", date: "2026-11-03", time: "14:30" } });
      expect(view("D").chore!.follower.offered).toBe(false);
      create("N", "chore", "Tidy");
      expect(view("N").chore!.follower).toEqual({ offered: true, default: false });
    });

    it("completes a weekly chore with a follower due the next week", () => {
      create("C", "chore", "Water plants", weekly);
      expect(transition("C", "complete", { next: "yes" })).toMatchObject({ ok: true });
      expect(series().map((c) => [c.state, c.attributes.dueAt])).toEqual([
        ["done", "2026-10-19T09:00:00.000Z"],
        ["todo", "2026-10-26T09:00:00.000Z"],
      ]);
    });

    it("completes without a follower when answered no", () => {
      create("C", "chore", "Water plants", weekly);
      transition("C", "complete");
      expect(series().map((c) => c.state)).toEqual(["done"]);
    });

    it("cancels the whole series, and asks for the scope only when the chore repeats", () => {
      create("C", "chore", "Feed cat", { schedule: { type: "frequency", every: "daily", time: "09:00" } });
      expect(view("C").transitions.find((t) => t.name === "cancel")!.form).toBe("cancel-chore");
      transition("C", "cancel", { scope: "series" });
      expect(series().map((c) => c.state)).toEqual(["cancelled"]);
      create("N", "chore", "Tidy");
      expect(view("N").transitions.find((t) => t.name === "cancel")!.form).toBe("direct");
      expect(transition("N", "cancel")).toMatchObject({ ok: true });
    });

    it("marks one occurrence urgent, keeping the configuration", () => {
      create("C", "chore", "Water plants", weekly);
      expect(view("C").chore!.urgencyAction).toEqual({ urgency: "urgent", label: "Mark urgent" });
      post("C", { intent: "urgency", urgency: "urgent" });
      expect(view("C").chore).toMatchObject({ urgent: true, urgencyAction: { urgency: "normal", label: "Mark normal" } });
      transition("C", "complete", { next: "yes" });
      expect(series()[1]!.attributes.urgency).toBe("normal");
      expect(view("C").chore!.urgencyAction).toBeUndefined();
    });
  });

  describe("history", () => {
    it("names agents and shows notes, newest first", () => {
      create("W", "work");
      services.tasks.transition("W", "start");
      services.tasks.transition("W", "return", {
        actor: { kind: "agent", name: "builder" },
        input: { reason: "Tests fail on CI" },
      });
      expect(view("W").history[0]).toMatchObject({
        label: "Return",
        from: "In progress",
        to: "To do",
        actor: "builder",
        note: "Tests fail on CI",
        at: "14 Oct 2026, 08:00",
      });
    });
  });

  describe("comments", () => {
    beforeEach(() => create("W", "work"));

    it("adds a comment with one paragraph per blank-line-separated block", () => {
      expect(post("W", { intent: "comment-add", blocks: blocksOf("First line\n\nSecond paragraph") })).toMatchObject({
        ok: true,
      });
      const comment = view("W").comments!.at(-1)!;
      expect(comment).toMatchObject({ author: "You", edited: false });
      expect(comment.blocks.map((b) => (b.kind === "content" ? b.content[0]?.text : b.kind))).toEqual([
        "First line",
        "Second paragraph",
      ]);
    });

    it("rejects an empty comment", () => {
      expect(post("W", { intent: "comment-add", blocks: blocksOf("  \n\n ") })).toMatchObject({
        ok: false,
        fieldErrors: { text: "The comment is empty" },
      });
      expect(view("W").comments).toEqual([]);
    });

    it("posts any block type, marks and mentions, but no pages", () => {
      services.blocks.apply([
        { op: "insert", block: { id: "arch", type: "page", content: [{ text: "Architecture" }] }, parentId: null },
      ]);
      const blocks = [
        {
          id: "p",
          type: "paragraph",
          content: [
            { text: "See ", marks: ["bold"] },
            { text: "\uFFFC", mention: { pageId: "arch" } },
          ],
        },
        {
          id: "l",
          type: "bulleted_list_item",
          content: [{ text: "Point" }],
          children: [{ id: "n", type: "paragraph", content: [{ text: "Nested" }] }],
        },
      ];
      expect(post("W", { intent: "comment-add", blocks: JSON.stringify(blocks) })).toMatchObject({ ok: true });
      const comment = view("W").comments![0]!;
      expect(comment.mentions).toEqual({ arch: { title: "Architecture", href: "/pages/arch" } });
      expect(comment.blocks.map((b) => (b.kind === "content" ? b.type : b.kind))).toEqual(["paragraph", "bulleted_list_item"]);

      const page = [{ id: "x", type: "page", content: [{ text: "Sub" }] }];
      expect(post("W", { intent: "comment-add", blocks: JSON.stringify(page) })).toMatchObject({ ok: false });
      expect(post("W", { intent: "comment-add", blocks: "not json" })).toMatchObject({
        ok: false,
        formError: "The comment couldn't be read",
      });
      expect(view("W").comments).toHaveLength(1);
    });

    it("edits a comment in place through the comment surface, marking it edited", () => {
      const added = post("W", { intent: "comment-add", blocks: blocksOf("Old") });
      const commentId = added.ok ? added.id : "";
      const first = services.comments.body(commentId)!.children![0]!.block.id;
      expect(
        applyEdit(services, {
          surface: "comment",
          id: commentId,
          batch: [{ op: "update", id: first, content: [{ text: "Updated text" }] }],
        }),
      ).toMatchObject({ ok: true });
      const comment = view("W").comments![0]!;
      expect(comment).toMatchObject({ id: commentId, edited: true });
      expect(comment.blocks.map((b) => (b.kind === "content" ? b.content[0]?.text : b.kind))).toEqual(["Updated text"]);

      const root = services.comments.get(commentId)!.bodyBlockId;
      expect(
        applyEdit(services, {
          surface: "comment",
          id: commentId,
          batch: [{ op: "insert", block: { id: "pg", type: "page" }, parentId: root }],
        }),
      ).toEqual({
        ok: false,
        message: "A page block can't be created here",
      });
    });

    it("deletes a comment", () => {
      const added = post("W", { intent: "comment-add", blocks: blocksOf("Bye") });
      post("W", { intent: "comment-delete", commentId: added.ok ? added.id : "" });
      expect(view("W").comments).toEqual([]);
    });

    it("refuses comments of another task", () => {
      create("W2", "work");
      const added = post("W2", { intent: "comment-add", blocks: blocksOf("Mine") });
      expect(post("W", { intent: "comment-delete", commentId: added.ok ? added.id : "" })).toMatchObject({ ok: false });
      expect(view("W2").comments).toHaveLength(1);
    });

    it("shows no comments for explorations", () => {
      create("E", "exploration");
      expect(view("E").comments).toBeUndefined();
    });
  });

  describe("lineage", () => {
    it("shows the whole feature with the current task marked", () => {
      create("E", "exploration", "Passkeys");
      services.tasks.transition("E", "promote", { input: { workId: "W", title: "Add passkeys" } });
      services.tasks.transition("W", "start");
      services.tasks.transition("W", "complete");
      services.tasks.create({ id: "U", projectId: "P", kind: "update", title: "Faster", iteratesOn: "W" });
      expect(view("W").lineage).toEqual({
        id: "E",
        label: "Exploration · Passkeys · Promoted",
        current: false,
        children: [
          {
            id: "W",
            label: "Work · Add passkeys · Done",
            current: true,
            children: [{ id: "U", label: "Update · Faster · Open", current: false, children: [] }],
          },
        ],
      });
    });

    it("is hidden for a task alone in its lineage and for chores", () => {
      create("W", "work");
      create("C", "chore");
      expect(view("W").lineage).toBeUndefined();
      expect(view("C").lineage).toBeUndefined();
    });
  });

  describe("references", () => {
    it("adds and removes a reference, shown on both tasks", () => {
      create("W", "work");
      create("E", "exploration", "Passkeys");
      expect(view("W").referenceCandidates).toEqual([{ id: "E", label: "Exploration: Passkeys" }]);
      expect(post("W", { intent: "reference-add", targetId: "E" })).toMatchObject({ ok: true });
      expect(view("W").references).toEqual([
        { relationId: expect.any(String), target: { status: "ok", kind: "task", title: "Passkeys", href: "/tasks/E" } },
      ]);
      expect(view("W").referenceCandidates).toEqual([]);
      expect(view("E").referencedBy).toEqual([{ id: "W", title: "W", kindLabel: "work" }]);

      post("W", { intent: "reference-remove", relationId: view("W").references[0]!.relationId });
      expect(view("W").references).toEqual([]);
      expect(view("E").referencedBy).toEqual([]);
    });

    it("rejects tasks of other projects", () => {
      services.projects.create({ id: "P2", title: "Garden" });
      services.tasks.create({ id: "X", projectId: "P2", kind: "work", title: "X" });
      create("W", "work");
      expect(post("W", { intent: "reference-add", targetId: "X" })).toMatchObject({
        ok: false,
        fieldErrors: { targetId: "Choose a task of this project" },
      });
    });

    it("links comments and blocks to where they are shown, and marks deleted targets missing", () => {
      create("W", "work");
      const added = post("W", { intent: "comment-add", blocks: blocksOf("An idea") });
      const commentId = added.ok ? added.id : "";
      const bodyPageId = services.tasks.get("W")!.bodyPageId;
      const libraryRoot = services.projects.get("P")!.libraryRootId;
      services.blocks.apply([
        { op: "insert", block: { id: "b1", type: "paragraph", content: [{ text: "Body line" }] }, parentId: bodyPageId },
        { op: "insert", block: { id: "doc", type: "page", content: [{ text: "Doc" }] }, parentId: libraryRoot },
        { op: "insert", block: { id: "b2", type: "paragraph", content: [{ text: "Doc line" }] }, parentId: "doc" },
      ]);
      create("E", "exploration");
      services.tasks.addReference("E", { kind: "comment", id: commentId });
      services.tasks.addReference("E", { kind: "block", id: "b1" });
      services.tasks.addReference("E", { kind: "block", id: "b2" });
      expect(view("E").references.map((r) => r.target)).toEqual([
        { status: "ok", kind: "comment", title: "An idea", href: `/tasks/W#comment-${commentId}` },
        { status: "ok", kind: "block", title: "Body line", href: "/tasks/W" },
        { status: "ok", kind: "block", title: "Doc line", href: "/pages/doc" },
      ]);

      post("W", { intent: "comment-delete", commentId });
      expect(view("E").references[0]!.target).toEqual({ status: "missing", kind: "comment" });
    });
  });

  describe("starting from anything", () => {
    it("starts an exploration from a cancelled work task", () => {
      create("W", "work");
      services.tasks.transition("W", "cancel");
      const result = post("W", { intent: "start-exploration", title: "Rethink sync" });
      const id = result.ok ? result.id : "";
      expect(result).toMatchObject({ ok: true, redirectTo: `/tasks/${id}` });
      expect(view(id).task).toMatchObject({ kind: "exploration", title: "Rethink sync", state: "open" });
      expect(view(id).references.map((r) => r.target)).toEqual([{ status: "ok", kind: "task", title: "W", href: "/tasks/W" }]);
    });

    it("starts an exploration from a comment", () => {
      create("W", "work");
      const added = post("W", { intent: "comment-add", blocks: blocksOf("What about offline?") });
      const commentId = added.ok ? added.id : "";
      const result = post("W", { intent: "start-exploration", commentId, title: "Offline mode" });
      const id = result.ok ? result.id : "";
      expect(view(id).references.map((r) => r.target)).toEqual([
        { status: "ok", kind: "comment", title: "What about offline?", href: `/tasks/W#comment-${commentId}` },
      ]);
    });

    it("starts an update from done work, only when it is done", () => {
      doneWork("W");
      expect(view("W").canStartUpdate).toBe(true);
      const result = post("W", { intent: "start-update", title: "Faster login" });
      const id = result.ok ? result.id : "";
      expect(result).toMatchObject({ ok: true, redirectTo: `/tasks/${id}` });
      expect(view(id).lineage).toMatchObject({ id: "W", children: [{ id, current: true }] });

      create("T", "work");
      expect(view("T").canStartUpdate).toBe(false);
      expect(post("T", { intent: "start-update", title: "Nope" })).toMatchObject({
        ok: false,
        formError: "An update must iterate on work that is done",
      });
    });

    it("requires a title", () => {
      create("W", "work");
      expect(post("W", { intent: "start-exploration", title: "" })).toMatchObject({
        ok: false,
        fieldErrors: { title: "A title is required" },
      });
    });
  });

  describe("dispatch", () => {
    it("answers unknown tasks and intents with a status", () => {
      create("W", "work");
      expect(taskAction(services, "nope", form({ intent: "transition" }))).toEqual({ status: "not_found" });
      expect(taskAction(services, "W", form({ intent: "explode" }))).toEqual({ status: "bad_request" });
    });
  });
});

describe("plain text helpers", () => {
  it("splits paragraphs on blank lines and keeps single newlines", () => {
    let n = 0;
    expect(paragraphsFromText("One\nline two\r\n\r\n  \n\nThree  ", () => `p${++n}`)).toEqual([
      { id: "p1", type: "paragraph", content: [{ text: "One\nline two" }] },
      { id: "p2", type: "paragraph", content: [{ text: "Three" }] },
    ]);
  });
});
