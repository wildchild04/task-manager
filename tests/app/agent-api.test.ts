import { beforeEach, describe, expect, it } from "vitest";

import { handleAgentRequest } from "../../app/lib/agent/request.server";
import { workspacePageTree } from "../../app/lib/page-search.server";
import { type AppServices, createInMemoryServices } from "~/composition";
import { fromMarkdown } from "~/domain/blocks/markdown";

describe("agent API", () => {
  let services: AppServices;
  let clock: number;

  beforeEach(() => {
    clock = 0;
    services = createInMemoryServices({
      now: () => new Date(Date.UTC(2026, 9, 18, 8, 0, clock++)).toISOString(),
      timeZone: "UTC",
    });
    services.projects.create({ id: "proj0001-0000-0000-0000-000000000000", title: "Taskhub" });
  });

  const P = "proj0001-0000-0000-0000-000000000000";
  const work = (id: string, title = id) => services.tasks.create({ id, projectId: P, kind: "work", title });

  /** Each agent's token, registered the first time it calls. */
  let tokens: Map<string, string>;
  beforeEach(() => (tokens = new Map()));
  const tokenFor = (agent: string) => {
    if (!tokens.has(agent)) tokens.set(agent, services.agentTokens.register(agent).token);
    return tokens.get(agent)!;
  };

  /** Calls the API as `agent` (with its own token) and returns status and body. */
  const call = async (method: "GET" | "POST", path: string, body?: unknown, agent = "builder") => {
    const headers: Record<string, string> = { authorization: `Bearer ${tokenFor(agent)}` };
    if (body !== undefined) headers["content-type"] = "application/json";
    const request = new Request(`http://app/api/agent/${path}`, {
      method,
      headers,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const response = await handleAgentRequest(services, request, path.split("?")[0]!);
    return { status: response.status, body: (await response.json()) as Record<string, any> };
  };

  describe("authentication", () => {
    it("refuses a missing, unknown or revoked token", async () => {
      const raw = (authorization?: string) =>
        handleAgentRequest(
          services,
          new Request("http://app/api/agent/projects", { headers: authorization ? { authorization } : {} }),
          "projects",
        );
      expect((await raw()).status).toBe(401);
      const unknown = await raw("Bearer ntm_nope");
      expect(unknown.status).toBe(401);
      expect(await unknown.json()).toEqual({
        error: {
          code: "unauthorized",
          message: "Missing, unknown or revoked token: register this agent in Settings and use its token",
        },
      });
      const token = tokenFor("builder");
      expect((await raw(`Bearer ${token}`)).status).toBe(200);
      services.agentTokens.revokeByName("builder");
      expect((await raw(`Bearer ${token}`)).status).toBe(401);
    });

    it("takes the agent's name from its token, not from X-Agent-Name", async () => {
      work("aaaa0001-0000-0000-0000-000000000000");
      const response = await handleAgentRequest(
        services,
        new Request("http://app/api/agent/task/aaaa0001/transition", {
          method: "POST",
          headers: { authorization: `Bearer ${tokenFor("builder")}`, "x-agent-name": "reviewer", "content-type": "application/json" },
          body: JSON.stringify({ name: "start" }),
        }),
        "task/aaaa0001/transition",
      );
      expect(response.status).toBe(200);
      expect(services.tasks.history("aaaa0001-0000-0000-0000-000000000000")[0]!.actor).toEqual({ kind: "agent", name: "builder" });
    });

    it("acts as the agent", async () => {
      work("aaaa0001-0000-0000-0000-000000000000");
      await call("POST", "task/aaaa0001/transition", { name: "start" });
      expect(services.tasks.history("aaaa0001-0000-0000-0000-000000000000")[0]!.actor).toEqual({
        kind: "agent",
        name: "builder",
      });
    });
  });

  describe("lean responses", () => {
    it("lists only the documented fields, paging with a cursor", async () => {
      for (let i = 0; i < 25; i++) work(`t${String(i).padStart(7, "0")}-0000-0000-0000-000000000000`, `Task ${i}`);
      const first = await call("GET", "tasks?limit=10");
      expect(first.body.tasks).toHaveLength(10);
      expect(first.body.tasks[0]).toEqual({ id: "t0000024", kind: "work", state: "todo", title: "Task 24" });
      expect(Object.keys(first.body).sort()).toEqual(["cursor", "more", "tasks"]);
      const second = await call("GET", `tasks?limit=10&cursor=${first.body.cursor}`);
      expect(second.body.tasks[0].title).toBe("Task 14");
      const third = await call("GET", `tasks?limit=10&cursor=${second.body.cursor}`);
      expect(third.body).toMatchObject({ more: false });
      expect(third.body.tasks).toHaveLength(5);
      expect((await call("GET", "tasks?limit=99")).status).toBe(400);
    });

    it("cuts long text and continues from the offset", async () => {
      const task = work("aaaa0001-0000-0000-0000-000000000000");
      services.blocks.apply([
        {
          op: "insert",
          block: { id: "long", type: "paragraph", content: [{ text: "x".repeat(5000) }] },
          parentId: task.bodyPageId,
        },
      ]);
      const first = await call("GET", "task/aaaa0001/description");
      expect(first.body).toEqual({ markdown: "x".repeat(2000), more: true, offset: 2000 });
      const last = await call("GET", "task/aaaa0001/description?offset=4000");
      expect(last.body).toEqual({ markdown: "x".repeat(1000), more: false });
    });

    it("finds items by a short ID, and refuses an ambiguous prefix", async () => {
      work("abcdef01-0000-0000-0000-000000000000", "One");
      work("abcdef02-0000-0000-0000-000000000000", "Two");
      expect((await call("GET", "task/abcdef01")).body).toMatchObject({ id: "abcdef01", title: "One" });
      expect((await call("GET", "task/abcdef")).body.error.code).toBe("ambiguous");
      expect((await call("GET", "task/zzzzzz")).status).toBe(404);
    });
  });

  describe("reading", () => {
    it("summarizes a task without its content", async () => {
      work("aaaa0001-0000-0000-0000-000000000000", "Add login");
      services.comments.add({
        id: "c1",
        taskId: "aaaa0001-0000-0000-0000-000000000000",
        blocks: [{ id: "cp", type: "paragraph", content: [{ text: "Hi" }] }],
      });
      expect((await call("GET", "task/aaaa0001")).body).toEqual({
        id: "aaaa0001",
        kind: "work",
        state: "todo",
        title: "Add login",
        project: "proj0001",
        transitions: ["start"],
        counts: { comments: 1, references: 0 },
      });
    });

    it("reads comments newest first, capped, as Markdown", async () => {
      work("aaaa0001-0000-0000-0000-000000000000");
      for (let i = 0; i < 7; i++) {
        services.comments.add({
          id: `c${i}`,
          taskId: "aaaa0001-0000-0000-0000-000000000000",
          author: i === 6 ? { kind: "agent", name: "reviewer" } : undefined,
          blocks: [{ id: `cp${i}`, type: "paragraph", content: [{ text: `Comment ${i}` }] }],
        });
      }
      const page = await call("GET", "task/aaaa0001/comments");
      expect(page.body.comments).toHaveLength(5);
      expect(page.body.comments[0]).toEqual({ id: "c6", author: "reviewer", markdown: "Comment 6" });
      expect(page.body.comments[1].author).toBe("human");
      expect(page.body.more).toBe(true);
    });

    it("searches and reads library pages", async () => {
      const library = services.projects.get(P)!.libraryRootId;
      services.blocks.apply([
        { op: "insert", block: { id: "doc00001-x", type: "page", content: [{ text: "Architecture" }] }, parentId: library },
        {
          op: "insert",
          block: { id: "dp", type: "heading", props: { level: 2 }, content: [{ text: "Layers" }] },
          parentId: "doc00001-x",
        },
      ]);
      expect((await call("GET", "pages?query=arch")).body).toEqual({
        pages: [{ id: "doc00001", title: "Architecture", place: "Taskhub" }],
        more: false,
      });
      expect((await call("GET", "page/doc00001")).body).toEqual({ title: "Architecture", markdown: "## Layers", more: false });
    });
  });

  describe("permissions and claiming", () => {
    beforeEach(() => work("aaaa0001-0000-0000-0000-000000000000", "Add login"));

    it("can't cancel work, only suggest it, and reopens work the human cancelled", async () => {
      expect(await call("POST", "task/aaaa0001/transition", { name: "cancel" })).toMatchObject({
        status: 403,
        body: { error: { code: "forbidden" } },
      });
      expect(services.tasks.get("aaaa0001-0000-0000-0000-000000000000")!.state).toBe("todo");
      services.tasks.transition("aaaa0001-0000-0000-0000-000000000000", "cancel");
      expect((await call("GET", "task/aaaa0001")).body.transitions).toEqual(["reopen"]);
      expect((await call("POST", "task/aaaa0001/transition", { name: "reopen" })).body).toEqual({ ok: true, state: "todo" });
    });

    it("promotes an exploration into work born from it", async () => {
      services.tasks.create({ id: "ex000001-0000-0000-0000-000000000000", projectId: P, kind: "exploration", title: "Idea" });
      expect((await call("GET", "task/ex000001")).body.transitions).toEqual(["promote"]);
      const promoted = await call("POST", "task/ex000001/transition", { name: "promote", title: "Build the idea" });
      expect(promoted.body).toMatchObject({ ok: true, state: "promoted" });
      expect((await call("GET", `task/${promoted.body.work}`)).body).toMatchObject({ kind: "work", state: "todo", title: "Build the idea" });
      expect(services.tasks.history("ex000001-0000-0000-0000-000000000000")[0]!.actor).toEqual({ kind: "agent", name: "builder" });
    });

    it("can't tombstone ideas, but revives them, promoting with the idea's title by default", async () => {
      services.tasks.create({ id: "ex000001-0000-0000-0000-000000000000", projectId: P, kind: "exploration", title: "Idea" });
      expect((await call("POST", "task/ex000001/transition", { name: "tombstone" })).body.error.code).toBe("forbidden");
      services.tasks.transition("ex000001-0000-0000-0000-000000000000", "tombstone");
      expect((await call("POST", "task/ex000001/transition", { name: "revive" })).body).toEqual({ ok: true, state: "open" });
      const promoted = await call("POST", "task/ex000001/transition", { name: "promote" });
      expect((await call("GET", `task/${promoted.body.work}`)).body.title).toBe("Idea");
    });

    it("completes and cancels chores", async () => {
      const chore = (id: string) =>
        services.tasks.create({ id, projectId: P, kind: "chore", title: id, attributes: { urgency: "normal" } });
      chore("ch000001-0000-0000-0000-000000000000");
      chore("ch000002-0000-0000-0000-000000000000");
      expect((await call("POST", "task/ch000001/transition", { name: "complete" })).body).toEqual({ ok: true, state: "done" });
      expect((await call("POST", "task/ch000002/transition", { name: "cancel" })).body).toEqual({ ok: true, state: "cancelled" });
    });

    it("skips one occurrence of a recurring chore, but can't end its series", async () => {
      const schedule = { type: "frequency", every: "weekly", weekday: 1, time: "09:00" };
      services.tasks.create({ id: "ch000001-0000-0000-0000-000000000000", projectId: P, kind: "chore", title: "Water", attributes: { schedule } });
      expect((await call("GET", "task/ch000001")).body.transitions).toEqual(["complete", "cancel"]);
      expect((await call("POST", "task/ch000001/transition", { name: "cancel", scope: "series" })).body.error.code).toBe("forbidden");
      expect((await call("POST", "task/ch000001/transition", { name: "cancel" })).body).toEqual({ ok: true, state: "cancelled" });
      expect(services.chores.series("ch000001-0000-0000-0000-000000000000")).toHaveLength(2);
    });

    it("refuses comments on anything but work", async () => {
      services.tasks.create({ id: "ex000001-0000-0000-0000-000000000000", projectId: P, kind: "exploration", title: "Idea" });
      expect((await call("POST", "task/ex000001/comment", { markdown: "x" })).body.error.code).toBe("forbidden");
    });

    it("lets only the agent that started a task finish it", async () => {
      await call("POST", "task/aaaa0001/transition", { name: "start" });
      const other = await call("POST", "task/aaaa0001/transition", { name: "complete" }, "reviewer");
      expect(other).toMatchObject({
        status: 409,
        body: { error: { code: "claimed", message: "This task is held by builder, who started it" } },
      });
      expect((await call("GET", "task/aaaa0001", undefined, "reviewer")).body).toMatchObject({
        heldBy: "builder",
        transitions: [],
      });
      expect((await call("POST", "task/aaaa0001/comment", { markdown: "me too" }, "reviewer")).status).toBe(409);
      expect((await call("POST", "task/aaaa0001/transition", { name: "complete" })).body).toEqual({ ok: true, state: "done" });
    });

    it("returns work with a reason as a comment, freeing it for others", async () => {
      await call("POST", "task/aaaa0001/transition", { name: "start" });
      expect((await call("POST", "task/aaaa0001/transition", { name: "return" })).body.error.code).toBe("validation");
      expect((await call("POST", "task/aaaa0001/transition", { name: "return", reason: "Missing API key" })).body).toEqual({
        ok: true,
        state: "todo",
      });
      const comments = await call("GET", "task/aaaa0001/comments");
      expect(comments.body.comments[0]).toMatchObject({ author: "builder", markdown: "Missing API key" });
      expect((await call("POST", "task/aaaa0001/transition", { name: "start" }, "reviewer")).body).toEqual({
        ok: true,
        state: "in_progress",
      });
    });

    it("reports transitions not allowed from the state", async () => {
      expect((await call("POST", "task/aaaa0001/transition", { name: "complete" })).body.error.code).toBe("invalid_transition");
    });
  });

  describe("findings", () => {
    const EX = "ex000001-0000-0000-0000-000000000000";
    beforeEach(() => {
      services.tasks.create({ id: EX, projectId: P, kind: "exploration", title: "Idea" });
      work("aaaa0001-0000-0000-0000-000000000000");
    });

    it("records an exploration's results, newest first, and counts them", async () => {
      const first = await call("POST", "task/ex000001/finding", { markdown: "Tables are used on **16** pages" });
      expect(first.body).toEqual({ ok: true, id: expect.any(String) });
      await call("POST", "task/ex000001/finding", { markdown: "Images can wait" });
      expect((await call("POST", `finding/${first.body.id}`, { markdown: "Tables are used on 16 of 20 pages" })).body).toEqual({
        ok: true,
      });
      const list = await call("GET", "task/ex000001/findings");
      expect(list.body).toEqual({
        findings: [
          { id: expect.any(String), author: "builder", markdown: "Images can wait" },
          { id: first.body.id, author: "builder", markdown: "Tables are used on 16 of 20 pages" },
        ],
        more: false,
      });
      expect((await call("GET", "task/ex000001")).body.counts).toEqual({ comments: 0, references: 0, findings: 2 });
      expect((await call("GET", "task/ex000001/comments")).body.comments).toEqual([]);
      expect(services.tasks.get(EX)!.state).toBe("open");
      expect(services.comments.get(services.comments.list(EX, "finding")[0]!.id)!.editedAt).not.toBeNull();
    });

    it("adds findings to a promoted exploration", async () => {
      services.tasks.transition(EX, "promote", { input: { workId: "wk000001-0000-0000-0000-000000000000", title: "Build" } });
      expect((await call("POST", "task/ex000001/finding", { markdown: "Shipped in 514a7c0" })).body.ok).toBe(true);
    });

    it("refuses findings on anything but explorations, and empty ones", async () => {
      expect(await call("POST", "task/aaaa0001/finding", { markdown: "x" })).toMatchObject({
        status: 422,
        body: { error: { code: "validation" } },
      });
      expect((await call("POST", "task/ex000001/finding", { markdown: "  " })).body.error.code).toBe("validation");
      expect((await call("GET", "task/aaaa0001")).body.counts).toEqual({ comments: 0, references: 0 });
    });

    it("lets an agent change only its own findings", async () => {
      const { body } = await call("POST", "task/ex000001/finding", { markdown: "Mine" });
      services.comments.add({ id: "hu000001-0000-0000-0000-000000000000", taskId: EX, kind: "finding", blocks: [] });
      for (const [path, input, agent] of [
        [`finding/${body.id}`, { markdown: "Theirs" }, "reviewer"],
        [`finding/${body.id}/delete`, {}, "reviewer"],
        ["finding/hu000001", { markdown: "x" }, "builder"],
        ["finding/hu000001/delete", {}, "builder"],
      ] as const) {
        expect(await call("POST", path, input, agent)).toMatchObject({ status: 403, body: { error: { code: "forbidden" } } });
      }
      expect((await call("POST", `finding/${body.id}/delete`, {})).body).toEqual({ ok: true });
      expect(services.comments.list(EX, "finding").map((f) => f.id)).toEqual(["hu000001-0000-0000-0000-000000000000"]);
    });

    it("never mixes comment and finding IDs", async () => {
      const { body } = await call("POST", "task/aaaa0001/comment", { markdown: "A comment" });
      expect(await call("POST", `finding/${body.id}`, { markdown: "x" })).toMatchObject({
        status: 404,
        body: { error: { code: "not_found" } },
      });
      expect((await call("POST", `finding/${body.id}/delete`, {})).status).toBe(404);
    });
  });

  describe("creating tasks", () => {
    it("creates work with a description, as the web forms do", async () => {
      const { status, body } = await call(
        "POST",
        "tasks",
        { project: "proj0001", kind: "work", title: "Add login", description: "Use **OAuth**" },
        "planner",
      );
      expect(status).toBe(200);
      expect(Object.keys(body).sort()).toEqual(["id", "ok", "state"]);
      expect(body).toMatchObject({ ok: true, state: "todo" });
      expect(services.tasks.list(P).map((t) => t.title)).toEqual(["Add login"]);
      expect((await call("GET", `task/${body.id}/description`)).body.markdown).toBe("Use **OAuth**");
    });

    it("creates a scheduled chore due at its next time", async () => {
      const { body } = await call("POST", "tasks", {
        project: P,
        kind: "chore",
        title: "Back up the database",
        urgency: "normal",
        schedule: { type: "frequency", every: "weekly", weekday: 1, time: "09:00" },
      });
      const chore = services.tasks.list(P).find((t) => t.kind === "chore")!;
      expect(body).toMatchObject({ ok: true, id: chore.id.slice(0, 8), state: "todo" });
      // 18 Oct 2026 is a Sunday; the workspace time zone here is UTC.
      expect(chore.attributes).toMatchObject({ urgency: "normal", dueAt: "2026-10-19T09:00:00.000Z" });
    });

    it("creates an update only from done work", async () => {
      work("work0001-0000-0000-0000-000000000000", "Search");
      const refused = await call("POST", "tasks", { project: P, kind: "update", title: "Faster search", iteratesOn: "work0001" });
      expect(refused).toMatchObject({ status: 422, body: { error: { code: "validation" } } });
      expect(services.tasks.list(P)).toHaveLength(1);
      services.tasks.transition("work0001-0000-0000-0000-000000000000", "start");
      services.tasks.transition("work0001-0000-0000-0000-000000000000", "complete");
      const created = await call("POST", "tasks", { project: P, kind: "update", title: "Faster search", iteratesOn: "work0001" });
      expect(created.body).toMatchObject({ ok: true, state: "open" });
    });

    it.each([
      [{ kind: "work", title: "  " }, 422, "validation"],
      [{ kind: "epic", title: "X" }, 400, "bad_request"],
      [{ kind: "work", title: "X", urgency: "urgent" }, 422, "validation"],
      [{ kind: "chore", title: "X", schedule: { type: "time", time: "25:00" } }, 422, "validation"],
      [{ kind: "exploration", title: "X", iteratesOn: "work0001" }, 422, "validation"],
      [{ kind: "update", title: "X" }, 422, "validation"],
      [{ kind: "work", title: "X", project: "nope0000" }, 404, "not_found"],
    ])("refuses %j", async (fields, status, code) => {
      const response = await call("POST", "tasks", { project: P, ...fields });
      expect(response).toMatchObject({ status, body: { error: { code } } });
      expect(services.tasks.list(P)).toHaveLength(0);
    });
  });

  describe("creating projects", () => {
    it("creates a project with its home page and library", async () => {
      const created = await call("POST", "projects", { title: " Garden " });
      expect(created.body).toEqual({ ok: true, id: expect.any(String) });
      expect((await call("GET", "projects")).body.projects).toContainEqual({ id: created.body.id, title: "Garden" });
      expect((await call("POST", "projects", { title: " " })).body.error.code).toBe("validation");
    });
  });

  describe("action suggestions", () => {
    const W = "aaaa0001-0000-0000-0000-000000000000";
    beforeEach(() => work(W, "Old migration"));

    it("suggests cancelling work, which the human approves", async () => {
      const made = await call("POST", "suggest-action", { action: "transition", task: "aaaa0001", transition: "cancel", note: "Superseded" });
      expect(made.body).toEqual({ ok: true, id: expect.any(String) });
      expect(services.tasks.get(W)!.state).toBe("todo");
      const status = await call("GET", `suggestion/${made.body.id}`);
      expect(status.body).toEqual({
        id: made.body.id,
        action: "transition",
        status: "pending",
        place: "task:aaaa0001",
        subject: "task:aaaa0001",
        revision: 1,
        note: "Superseded",
      });
      services.suggestions.approve(services.suggestions.idsStartingWith(made.body.id)[0]!);
      expect(services.tasks.get(W)!.state).toBe("cancelled");
      expect((await call("GET", `suggestion/${made.body.id}`)).body).toMatchObject({ status: "approved", resolvedAt: expect.any(String) });
    });

    it("suggests renaming and deleting projects, pages and tasks, and withdraws its own", async () => {
      const page = await call("POST", "pages", { title: "Roadmap" });
      const rename = await call("POST", "suggest-action", { action: "rename", page: page.body.id, title: "Roadmap 2027" });
      expect((await call("GET", `suggestion/${rename.body.id}`)).body).toMatchObject({ subject: `page:${page.body.id}` });
      const project = await call("POST", "suggest-action", { action: "delete", project: "proj0001" });
      expect((await call("GET", `suggestion/${project.body.id}`)).body).toMatchObject({ subject: "project:proj0001", status: "pending" });
      const task = await call("POST", "suggest-action", { action: "rename", task: "aaaa0001", title: "New migration" });
      expect((await call("POST", `suggestion/${task.body.id}/withdraw`, {}, "reviewer")).body.error.code).toBe("forbidden");
      expect((await call("POST", `suggestion/${task.body.id}/withdraw`, {})).body).toEqual({ ok: true });
      expect((await call("GET", `suggestion/${task.body.id}`)).body.status).toBe("withdrawn");
    });

    it("suggests a chore's schedule", async () => {
      services.tasks.create({ id: "ch000001-0000-0000-0000-000000000000", projectId: P, kind: "chore", title: "Back up" });
      const schedule = { type: "frequency", every: "weekly", weekday: 1, time: "09:00" };
      expect((await call("POST", "suggest-action", { action: "schedule", task: "ch000001", schedule })).body.ok).toBe(true);
      expect((await call("POST", "suggest-action", { action: "schedule", task: "ch000001", schedule: null })).body.ok).toBe(true);
      expect((await call("POST", "suggest-action", { action: "schedule", task: "aaaa0001", schedule })).body.error.code).toBe("validation");
    });

    it("refuses wrong fields, subjects and transitions, creating nothing", async () => {
      const refused = async (body: Record<string, unknown>, code = "validation") =>
        expect((await call("POST", "suggest-action", body)).body.error.code).toBe(code);
      await refused({ action: "rename", task: "aaaa0001" });
      await refused({ action: "delete", task: "aaaa0001", page: "aaaa0001" });
      await refused({ action: "delete" });
      await refused({ action: "delete", task: "aaaa0001", title: "x" });
      await refused({ action: "transition", task: "aaaa0001", transition: "tombstone" });
      await refused({ action: "schedule", task: "aaaa0001" });
      await refused({ action: "delete", task: "zzzz0001" }, "not_found");
      expect(services.suggestions.listPending()).toEqual([]);
    });
  });

  describe("creating pages", () => {
    it("creates a workspace page by default, after the existing ones, with content", async () => {
      services.blocks.apply([
        { op: "insert", block: { id: "root0001-x", type: "page", content: [{ text: "Inbox" }] }, parentId: null },
      ]);
      const { status, body } = await call("POST", "pages", { title: "Runbook", markdown: "## Deploy\n\n- [ ] Tag the release" });
      expect(status).toBe(200);
      expect(Object.keys(body).sort()).toEqual(["id", "ok"]);
      expect(workspacePageTree(services).map((p) => p.title)).toEqual(["Inbox", "Runbook"]);
      expect((await call("GET", `page/${body.id}`)).body).toEqual({
        title: "Runbook",
        markdown: "## Deploy\n\n- [ ] Tag the release",
        more: false,
      });
    });

    it("creates a document in a project's library, and pages inside pages", async () => {
      const doc = (await call("POST", "pages", { title: "Architecture", project: "proj0001" })).body;
      const nested = (await call("POST", "pages", { title: "Layers", parent: doc.id })).body;
      expect(services.library.getLibraryTree(P)).toEqual([
        {
          id: expect.stringMatching(`^${doc.id}`),
          title: "Architecture",
          children: [{ id: expect.stringMatching(`^${nested.id}`), title: "Layers", children: [] }],
        },
      ]);
      expect((await call("GET", "pages?query=layers")).body.pages).toEqual([
        { id: nested.id, title: "Layers", place: "Taskhub › Architecture" },
      ]);
      expect(workspacePageTree(services)).toEqual([]);
    });

    it.each([
      [{ title: "  " }, 422, "validation"],
      [{ title: "X", project: "proj0001", parent: "proj0001" }, 422, "validation"],
      [{ title: "X", project: "nope0000" }, 404, "not_found"],
      [{ title: "X", parent: "nope0000" }, 404, "not_found"],
    ])("refuses %j", async (fields, status, code) => {
      const response = await call("POST", "pages", fields);
      expect(response).toMatchObject({ status, body: { error: { code } } });
      expect(workspacePageTree(services)).toEqual([]);
      expect(services.library.getLibraryTree(P)).toEqual([]);
    });
  });

  describe("revising suggestions", () => {
    const fullId = (id: string) => services.suggestions.idsStartingWith(id)[0]!;
    const page = async () => (await call("POST", "pages", { title: "Scratch", markdown: "Ship on Monday" }, "claude")).body.id as string;

    it("lists its own suggestions with feedback, reads the feedback, and revises in place", async () => {
      const pageId = await page();
      const rename = (await call("POST", "suggest-action", { action: "rename", page: pageId, title: "Notes from the Monday meeting" }, "claude")).body.id;
      const insert = (await call("POST", "suggest", { page: pageId, action: "insert", markdown: "- One" }, "claude")).body.id;
      await call("POST", "suggest", { page: pageId, action: "insert", markdown: "- Theirs" }, "reviewer");
      services.suggestions.requestChanges(fullId(rename), "Shorter, please");

      expect((await call("GET", "suggestions", undefined, "claude")).body).toEqual({
        suggestions: [
          { id: rename, action: "rename", status: "changes_requested", place: `page:${pageId}`, subject: `page:${pageId}` },
          { id: insert, action: "insert", status: "pending", place: `page:${pageId}` },
        ],
        more: false,
      });
      expect((await call("GET", "suggestions?state=changes_requested", undefined, "claude")).body.suggestions.map((s: { id: string }) => s.id)).toEqual([
        rename,
      ]);
      expect((await call("GET", "suggestions?limit=1", undefined, "claude")).body).toMatchObject({ more: true, cursor: expect.any(String) });
      expect((await call("GET", `suggestion/${rename}`, undefined, "claude")).body).toEqual({
        id: rename,
        action: "rename",
        status: "changes_requested",
        place: `page:${pageId}`,
        subject: `page:${pageId}`,
        revision: 1,
        feedback: [{ text: "Shorter, please", at: expect.any(String) }],
      });

      const revised = await call("POST", `suggestion/${rename}/revise`, { title: "Monday notes", note: "Shortened" }, "claude");
      expect(revised.body).toEqual({ ok: true, revision: 2 });
      expect((await call("GET", `suggestion/${rename}`, undefined, "claude")).body).toMatchObject({
        status: "pending",
        revision: 2,
        note: "Shortened",
      });
      expect((await call("GET", `suggestion/${rename}`, undefined, "claude")).body.feedback).toBeUndefined();
      expect((await call("GET", "suggestions?state=changes_requested", undefined, "claude")).body.suggestions).toEqual([]);

      expect((await call("POST", `suggestion/${insert}/revise`, { markdown: "1. One\n2. Two" }, "claude")).body).toEqual({ ok: true, revision: 2 });
      expect((await call("GET", `page/${pageId}`)).body.markdown).toContain("1. One\n2. Two");
    });

    it("refuses fields that don't fit, nothing to change, others' suggestions and resolved ones", async () => {
      const pageId = await page();
      const rename = (await call("POST", "suggest-action", { action: "rename", page: pageId, title: "Plans" }, "claude")).body.id;
      const target = services.blocks.getChildren(services.suggestions.get(fullId(rename))!.pageId)[0]!.id.slice(0, 8);
      const del = (await call("POST", "suggest", { page: pageId, action: "delete", target }, "claude")).body.id;
      const refused = async (id: string, body: unknown, agent = "claude") => (await call("POST", `suggestion/${id}/revise`, body, agent)).body.error?.code;

      expect(await refused(rename, { markdown: "- No" })).toBe("validation");
      expect(await refused(del, { markdown: "- No" })).toBe("validation");
      expect(await refused(del, { title: "No" })).toBe("validation");
      expect(await refused(rename, {})).toBe("validation");
      expect(await refused(rename, { colour: "red" })).toBe("bad_request");
      expect(await refused(rename, { note: "Mine" }, "reviewer")).toBe("forbidden");
      expect(await refused("ffffffff", { note: "Who?" })).toBe("not_found");
      expect((await call("POST", `suggestion/${del}/revise`, { note: "Duplicate" }, "claude")).body).toEqual({ ok: true, revision: 2 });
      services.suggestions.reject(fullId(rename));
      expect(await refused(rename, { title: "Late" })).toBe("resolved");
      expect((await call("GET", "suggestions", undefined, "reviewer")).body).toEqual({ suggestions: [], more: false });
    });
  });

  describe("suggestions", () => {
    const exploration = () => {
      const task = services.tasks.create({ id: "expl0001-0000-0000-0000-000000000000", projectId: P, kind: "exploration", title: "Block editor v1" });
      appendMarkdown(task.bodyPageId, "Known candidates:\n\n- Turn into\n- Backspace");
      return task;
    };
    const appendMarkdown = (pageId: string, markdown: string) =>
      services.blocks.apply(
        fromMarkdown(markdown, { findTarget: () => null, newId: () => crypto.randomUUID() }).map((block, i, all) => ({
          op: "insert" as const,
          block,
          parentId: pageId,
          afterId: i === 0 ? null : all[i - 1]!.id,
        })),
      );

    it("reads with anchors, suggests after a block, and reports the status", async () => {
      exploration();
      const read = await call("GET", "task/expl0001/description?anchors=true");
      const lines = read.body.markdown.split("\n");
      expect(lines.every((line: string) => / \^[0-9a-f]{8}$/.test(line) || line === "")).toBe(true);
      const last = /\^([0-9a-f]{8})$/.exec(lines.at(-1))![1]!;

      const made = await call(
        "POST",
        "suggest",
        { task: "expl0001", action: "insert", after: last, markdown: "- Tables\n- Code blocks", note: "From the content audit" },
        "planner",
      );
      expect(made.status).toBe(200);
      expect(Object.keys(made.body).sort()).toEqual(["id", "ok"]);
      expect((await call("GET", "task/expl0001/description")).body.markdown).toBe(
        [
          "Known candidates:",
          "",
          "- Turn into",
          "- Backspace",
          "",
          `<suggestion id="${made.body.id}" by="planner" action="insert" status="pending" note="From the content audit">`,
          "- Tables",
          "- Code blocks",
          "</suggestion>",
        ].join("\n"),
      );
      expect((await call("GET", `suggestion/${made.body.id}`)).body).toEqual({
        id: made.body.id,
        action: "insert",
        status: "pending",
        place: "task:expl0001",
        revision: 1,
        note: "From the content audit",
      });
    });

    it("replaces on a page, reports approved after a human approves", async () => {
      services.blocks.apply([{ op: "insert", block: { id: "page0001-x", type: "page", content: [{ text: "Roadmap" }] }, parentId: null }]);
      appendMarkdown("page0001-x", "Ship on Monday");
      const target = services.blocks.getChildren("page0001-x")[0]!.id.slice(0, 8);
      const made = await call("POST", "suggest", { page: "page0001", action: "replace", target, markdown: "Ship on **Tuesday**" });
      services.suggestions.approve(services.suggestions.idsStartingWith(made.body.id)[0]!);
      const status = await call("GET", `suggestion/${made.body.id}`);
      expect(status.body).toMatchObject({ status: "approved", place: "page:page0001", resolvedAt: expect.any(String) });
      expect((await call("GET", "page/page0001")).body.markdown).toBe("Ship on **Tuesday**");
    });

    it("lets agents suggest on work held by another agent", async () => {
      const task = work("aaaa0001-0000-0000-0000-000000000000");
      await call("POST", "task/aaaa0001/transition", { name: "start" }, "builder");
      const made = await call("POST", "suggest", { task: "aaaa0001", action: "insert", markdown: "A thought" }, "reviewer");
      expect(made.status).toBe(200);
      expect(services.suggestions.pendingOn(task.bodyPageId)).toHaveLength(1);
    });

    it("withdraws only the agent's own, and never approves or rejects", async () => {
      exploration();
      const { body } = await call("POST", "suggest", { task: "expl0001", action: "insert", markdown: "Idea" }, "builder");
      expect(await call("POST", `suggestion/${body.id}/withdraw`, {}, "reviewer")).toMatchObject({ status: 403, body: { error: { code: "forbidden" } } });
      expect(await call("POST", `suggestion/${body.id}/approve`, {}, "builder")).toMatchObject({ status: 403, body: { error: { code: "forbidden" } } });
      expect(await call("POST", `suggestion/${body.id}/reject`, {}, "builder")).toMatchObject({ status: 403 });
      expect(await call("POST", `suggestion/${body.id}/withdraw`, {}, "builder")).toMatchObject({ status: 200, body: { ok: true } });
      expect((await call("GET", `suggestion/${body.id}`)).body.status).toBe("withdrawn");
      expect(await call("POST", `suggestion/${body.id}/withdraw`, {}, "builder")).toMatchObject({ status: 409, body: { error: { code: "resolved" } } });
    });

    it.each([
      [{ action: "replace", target: "BLOCK" }, 422, "validation"],
      [{ action: "insert" }, 422, "validation"],
      [{ action: "insert", markdown: "x", after: "BLOCK", inside: "BLOCK" }, 422, "validation"],
      [{ action: "insert", markdown: "<suggestion>\nx\n</suggestion>" }, 422, "validation"],
      [{ action: "insert", markdown: "x", note: "n".repeat(281) }, 400, "bad_request"],
      [{ action: "delete", target: "zzzz9999" }, 404, "not_found"],
      [{ action: "insert", markdown: "x", page: "nope0000", task: undefined }, 404, "not_found"],
      [{ action: "insert", markdown: "x", page: "page", task: "expl0001" }, 422, "validation"],
    ])("refuses %j, creating nothing", async (fields, status, code) => {
      const task = exploration();
      const blockId = services.blocks.getChildren(task.bodyPageId)[0]!.id.slice(0, 8);
      const body = JSON.parse(JSON.stringify({ task: "expl0001", ...fields }).replaceAll("BLOCK", blockId));
      expect(await call("POST", "suggest", body)).toMatchObject({ status, body: { error: { code } } });
      expect(services.suggestions.listPending()).toEqual([]);
    });

    it("refuses suggestion tags in other Markdown", async () => {
      work("aaaa0001-0000-0000-0000-000000000000");
      expect(await call("POST", "task/aaaa0001/comment", { markdown: "<suggestion>" })).toMatchObject({ status: 422 });
    });
  });

  describe("tables, code and callouts", () => {
    const create = async (markdown: string) => (await call("POST", "pages", { title: "Notes", markdown })).body;

    it("round-trips a table, a code block and a callout", async () => {
      const markdown = [
        "| Subtopic | Rating |\n|---|---|\n| DNS | 🟡 **Shaky** |",
        "```sh\nstrace -f ./server\n```",
        "> [!WARNING] ⚠️ Don't load a movement that scored 0",
      ].join("\n\n");
      const page = await create(markdown);
      expect(page).toEqual({ ok: true, id: expect.any(String) });
      const blocks = services.blocks.getChildren(workspacePageTree(services)[0]!.id);
      expect(blocks.map((b) => b.type)).toEqual(["table", "code", "callout"]);
      expect(blocks[1]).toMatchObject({ props: { language: "sh" } });
      expect(blocks[2]).toMatchObject({ props: { emoji: "⚠️", tone: "warning" } });
      expect((await call("GET", `page/${page.id}`)).body.markdown).toBe(markdown);
    });

    it("tells agents what's supported", async () => {
      const { body } = await call("GET", "markdown");
      expect(body.blocks.find((b: { type: string }) => b.type === "table").example).toContain("|---|");
      expect(body.blocks.find((b: { type: string }) => b.type === "code").markdown).toContain("```");
      const image = body.blocks.find((b: { type: string }) => b.type === "image");
      expect(image.example).toMatch(/^!\[[^\]]+\]\(https:\/\/.+\)$/);
      expect(image.markdown).toContain("alone on a line");
    });

    it("warns about unsupported Markdown by line, and only then", async () => {
      expect(await create("A chart:\n\n![chart](chart.png)")).toEqual({
        ok: true,
        id: expect.any(String),
        warnings: ["Line 3: images need an http(s) URL or an uploaded image; kept as text"],
      });
      work("aaaa0001-0000-0000-0000-000000000000");
      const commented = await call("POST", "task/aaaa0001/comment", { markdown: "| a | b |\n|---|---|\n\n```\ncode\n```" });
      expect(commented.body).toEqual({ ok: true, id: expect.any(String) });
      const appended = await call("POST", "task/aaaa0001/description", { markdown: "See <div>this</div>" });
      expect(appended.body).toEqual({ ok: true, warnings: ["Line 1: HTML (<div>) isn't supported; kept as text"] });
    });

    it("adds images by URL and reads uploaded ones back with absolute URLs", async () => {
      const page = await create("![Latency p95](https://grafana.example/render/p95.png)");
      expect(page).toEqual({ ok: true, id: expect.any(String) });
      const pageId = workspacePageTree(services)[0]!.id;
      const { id } = await services.content.put(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), "image/png");
      const [chart] = services.blocks.getChildren(pageId);
      expect(chart).toMatchObject({ type: "image", props: { url: "https://grafana.example/render/p95.png", alt: "Latency p95" } });
      services.blocks.apply([
        { op: "insert", block: { id: "shot", type: "image", props: { contentId: id, alt: "Error dialog" } }, parentId: pageId, afterId: chart!.id },
      ]);
      expect((await call("GET", `page/${page.id}`)).body.markdown).toBe(
        `![Latency p95](https://grafana.example/render/p95.png)\n\n![Error dialog](http://app/content/${id})`,
      );
      // Written back, the uploaded image's URL becomes the stored item again.
      await create(`![Again](http://app/content/${id})`);
      const again = workspacePageTree(services).find((p) => p.id !== pageId)!;
      expect(services.blocks.getChildren(again.id)[0]).toMatchObject({ type: "image", props: { contentId: id, alt: "Again" } });
    });

    it("refuses a table's cell as a suggestion target, naming the table", async () => {
      const page = await create("| a | b |\n|---|---|\n| c | d |");
      const pageId = workspacePageTree(services)[0]!.id;
      const table = services.blocks.getChildren(pageId)[0]!;
      const cell = services.blocks.getChildren(services.blocks.getChildren(table.id)[0]!.id)[0]!;
      const refused = await call("POST", "suggest", { page: page.id, action: "delete", target: cell.id.slice(0, 8) });
      expect(refused).toMatchObject({ status: 422, body: { error: { code: "validation", message: expect.stringContaining(table.id) } } });
    });
  });

  describe("writing Markdown", () => {
    it("comments and appends to the description as blocks, with mentions", async () => {
      work("aaaa0001-0000-0000-0000-000000000000", "Write parser");
      work("bbbb0001-0000-0000-0000-000000000000", "Add login");
      const markdown = "Fixed in **two** places:\n\n- [x] parser\n- [ ] see @[Add login](task:bbbb0001)";
      const posted = await call("POST", "task/aaaa0001/comment", { markdown });
      expect(posted.body).toEqual({ ok: true, id: expect.stringMatching(/^[0-9a-f]{8}$/) });
      expect((await call("GET", "task/aaaa0001/comments")).body.comments[0].markdown).toBe(markdown);

      expect((await call("POST", "task/aaaa0001/description", { markdown: "## Notes\n\nStarted." })).body).toEqual({ ok: true });
      expect((await call("POST", "task/aaaa0001/description", { markdown: "More." })).body).toEqual({ ok: true });
      expect((await call("GET", "task/aaaa0001/description")).body.markdown).toBe("## Notes\n\nStarted.\n\nMore.");
      expect((await call("POST", "task/aaaa0001/comment", { markdown: "   " })).body.error.code).toBe("validation");
    });
  });

  it("runs a whole work loop with lean answers", async () => {
    work("cccc0001-0000-0000-0000-000000000000", "Write docs");
    const todo = await call("GET", "tasks?state=todo&kind=work&limit=3");
    const id = todo.body.tasks.find((t: { title: string }) => t.title === "Write docs").id;
    expect((await call("GET", `task/${id}/description`)).body).toEqual({ markdown: "", more: false });
    expect((await call("POST", `task/${id}/transition`, { name: "start" })).body).toEqual({ ok: true, state: "in_progress" });
    expect((await call("POST", `task/${id}/comment`, { markdown: "Drafted the outline." })).body.ok).toBe(true);
    expect((await call("POST", `task/${id}/transition`, { name: "complete" })).body).toEqual({ ok: true, state: "done" });
    const history = services.tasks.history("cccc0001-0000-0000-0000-000000000000");
    expect(history.map((r) => [r.name, r.actor])).toEqual([
      ["start", { kind: "agent", name: "builder" }],
      ["complete", { kind: "agent", name: "builder" }],
    ]);
  });
});
