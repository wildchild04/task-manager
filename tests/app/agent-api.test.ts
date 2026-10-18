import { beforeEach, describe, expect, it } from "vitest";

import { handleAgentRequest } from "../../app/lib/agent/request.server";
import { type AppServices, createInMemoryServices } from "~/composition";

const TOKEN = "secret-token";

describe("agent API", () => {
  let services: AppServices;
  let clock: number;

  beforeEach(() => {
    clock = 0;
    services = createInMemoryServices({ now: () => new Date(Date.UTC(2026, 9, 18, 8, 0, clock++)).toISOString() });
    services.projects.create({ id: "proj0001-0000-0000-0000-000000000000", title: "Taskhub" });
  });

  const P = "proj0001-0000-0000-0000-000000000000";
  const work = (id: string, title = id) => services.tasks.create({ id, projectId: P, kind: "work", title });

  /** Calls the API as `agent` and returns status and body. */
  const call = async (method: "GET" | "POST", path: string, body?: unknown, agent = "builder", token: string | null = TOKEN) => {
    const headers: Record<string, string> = { authorization: `Bearer ${TOKEN}`, ...(agent ? { "x-agent-name": agent } : {}) };
    if (body !== undefined) headers["content-type"] = "application/json";
    const request = new Request(`http://app/api/agent/${path}`, {
      method,
      headers,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const response = await handleAgentRequest(services, request, path.split("?")[0]!, token ?? undefined);
    return { status: response.status, body: (await response.json()) as Record<string, any> };
  };

  describe("authentication", () => {
    it("refuses a wrong token, a missing name, and everything when the API is off", async () => {
      work("aaaa0001-0000-0000-0000-000000000000");
      const wrong = await handleAgentRequest(
        services,
        new Request("http://app/api/agent/projects", { headers: { authorization: "Bearer nope", "x-agent-name": "builder" } }),
        "projects",
        TOKEN,
      );
      expect(wrong.status).toBe(401);
      expect((await call("GET", "projects", undefined, "")).status).toBe(400);
      expect((await call("GET", "projects", undefined, "builder", null)).body).toEqual({
        error: { code: "disabled", message: "The agent API is off: set AGENT_TOKEN in the app's environment" },
      });
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

    it("refuses cancelling and changing anything but work", async () => {
      const cancel = await call("POST", "task/aaaa0001/transition", { name: "cancel" });
      expect(cancel).toMatchObject({ status: 403, body: { error: { code: "forbidden" } } });
      services.tasks.create({ id: "ex000001-0000-0000-0000-000000000000", projectId: P, kind: "exploration", title: "Idea" });
      expect((await call("POST", "task/ex000001/comment", { markdown: "x" })).body.error.code).toBe("forbidden");
      expect((await call("POST", "task/ex000001/transition", { name: "tombstone" })).body.error.code).toBe("forbidden");
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
