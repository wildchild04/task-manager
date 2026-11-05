import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { beforeEach, describe, expect, it } from "vitest";

import { handleAgentRequest } from "../app/lib/agent/request.server";
import { type AgentCall, createAgentServer } from "../mcp/tools";
import { type AppServices, createInMemoryServices } from "~/composition";

/** A real MCP client talking to the agent server, which calls the app in-process. */
/** Agents' tokens, registered the first time each one connects. */
const tokens = new WeakMap<AppServices, Map<string, string>>();
function tokenFor(services: AppServices, agent: string): string {
  const known = tokens.get(services) ?? new Map<string, string>();
  tokens.set(services, known);
  if (!known.has(agent)) known.set(agent, services.agentTokens.register(agent).token);
  return known.get(agent)!;
}

async function connect(services: AppServices, agent = "builder") {
  const token = tokenFor(services, agent);
  const call: AgentCall = async (method, path, input) => {
    const url = new URL(`http://app/api/agent/${path}`);
    if (method === "GET") for (const [key, value] of Object.entries(input ?? {})) url.searchParams.set(key, String(value));
    const request = new Request(url, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        ...(method === "POST" ? { "content-type": "application/json" } : {}),
      },
      ...(method === "POST" ? { body: JSON.stringify(input ?? {}) } : {}),
    });
    const response = await handleAgentRequest(services, request, path);
    return { status: response.status, body: await response.json() };
  };
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await createAgentServer(call).connect(serverSide);
  const client = new Client({ name: "test", version: "1" });
  await client.connect(clientSide);
  return client;
}

const text = (result: Awaited<ReturnType<Client["callTool"]>>) => (result.content as { text: string }[])[0]!.text;

describe("MCP server", () => {
  let services: AppServices;

  beforeEach(() => {
    services = createInMemoryServices();
    services.projects.create({ id: "proj0001-0000-0000-0000-000000000000", title: "Taskhub" });
    for (let i = 0; i < 5; i++) {
      services.tasks.create({
        id: `task000${i}-0000-0000-0000-000000000000`,
        projectId: "proj0001-0000-0000-0000-000000000000",
        kind: "work",
        title: `Task ${i}`,
      });
    }
  });

  it("offers the twenty-five tools, each describing its defaults", async () => {
    const client = await connect(services);
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([
      "add_finding",
      "append_description",
      "comment",
      "create_page",
      "create_project",
      "create_task",
      "delete_finding",
      "edit_finding",
      "get_markdown_guide",
      "get_suggestion",
      "get_task",
      "list_comments",
      "list_findings",
      "list_projects",
      "list_references",
      "list_suggestions",
      "list_tasks",
      "read_description",
      "read_page",
      "revise_suggestion",
      "search_pages",
      "suggest",
      "suggest_action",
      "transition",
      "withdraw_suggestion",
    ]);
    expect(tools.find((t) => t.name === "list_tasks")!.description).toContain("default 10");
    expect(tools.find((t) => t.name === "list_suggestions")!.description).toContain("changes_requested");
    expect(tools.find((t) => t.name === "revise_suggestion")!.description).toContain("withdraw it and suggest again");
    for (const name of ["comment", "append_description", "add_finding", "edit_finding", "create_task", "create_page", "suggest", "revise_suggestion"]) {
      expect(tools.find((t) => t.name === name)!.description).toContain("get_markdown_guide");
    }
  });

  it("gives the Markdown guide", async () => {
    const client = await connect(services);
    const guide = JSON.parse(text(await client.callTool({ name: "get_markdown_guide", arguments: {} })));
    expect(guide.blocks.map((b: { type: string }) => b.type)).toContain("table");
  });

  it("returns compact results with only the API's fields", async () => {
    const client = await connect(services);
    const result = await client.callTool({ name: "list_tasks", arguments: { state: "todo", limit: 3 } });
    expect(result.isError).toBeFalsy();
    const body = JSON.parse(text(result));
    expect(body.tasks).toHaveLength(3);
    expect(Object.keys(body.tasks[0]).sort()).toEqual(["id", "kind", "state", "title"]);
    expect(text(result)).not.toContain("\n");
  });

  it("creates a task with a description", async () => {
    const client = await connect(services);
    const result = await client.callTool({
      name: "create_task",
      arguments: { project: "proj0001", kind: "exploration", title: "Try search", description: "Look at **FTS5**" },
    });
    expect(result.isError).toBeFalsy();
    const { id, state } = JSON.parse(text(result));
    expect(state).toBe("open");
    const description = await client.callTool({ name: "read_description", arguments: { id } });
    expect(JSON.parse(text(description)).markdown).toBe("Look at **FTS5**");
  });

  it("creates a page in a project's library", async () => {
    const client = await connect(services);
    const result = await client.callTool({
      name: "create_page",
      arguments: { title: "Architecture", project: "proj0001", markdown: "Three **layers**" },
    });
    expect(result.isError).toBeFalsy();
    const { id } = JSON.parse(text(result));
    const page = await client.callTool({ name: "read_page", arguments: { id } });
    expect(JSON.parse(text(page))).toEqual({ title: "Architecture", markdown: "Three **layers**", more: false });
  });

  it("suggests at an anchor and reports the status", async () => {
    const client = await connect(services);
    await client.callTool({ name: "append_description", arguments: { id: "task0001", markdown: "First idea" } });
    const read = JSON.parse(text(await client.callTool({ name: "read_description", arguments: { id: "task0001", anchors: true } })));
    const after = /\^(\w{8})$/.exec(read.markdown)![1];
    const made = await client.callTool({ name: "suggest", arguments: { task: "task0001", action: "insert", after, markdown: "Second idea" } });
    expect(made.isError).toBeFalsy();
    const { id } = JSON.parse(text(made));
    expect(JSON.parse(text(await client.callTool({ name: "get_suggestion", arguments: { id } })))).toMatchObject({ status: "pending" });
  });

  it("works a task end to end as the agent", async () => {
    const client = await connect(services);
    expect(text(await client.callTool({ name: "transition", arguments: { id: "task0001", name: "start" } }))).toBe(
      '{"ok":true,"state":"in_progress"}',
    );
    await client.callTool({ name: "comment", arguments: { id: "task0001", markdown: "Done with **step one**" } });
    const comments = JSON.parse(text(await client.callTool({ name: "list_comments", arguments: { id: "task0001" } })));
    expect(comments.comments[0]).toMatchObject({ author: "builder", markdown: "Done with **step one**" });
  });

  it("records findings on an exploration", async () => {
    services.tasks.create({ id: "expl0001-0000-0000-0000-000000000000", projectId: services.projects.list()[0]!.id, kind: "exploration", title: "Idea" });
    const client = await connect(services);
    const added = JSON.parse(text(await client.callTool({ name: "add_finding", arguments: { id: "expl0001", markdown: "It works" } })));
    expect(added).toEqual({ ok: true, id: expect.any(String) });
    const listed = JSON.parse(text(await client.callTool({ name: "list_findings", arguments: { id: "expl0001" } })));
    expect(listed.findings[0]).toEqual({ id: added.id, author: "builder", markdown: "It works" });
    const refused = await client.callTool({ name: "add_finding", arguments: { id: "task0001", markdown: "x" } });
    expect(text(refused)).toMatch(/^validation: /);
  });

  it("creates a project and suggests deleting a page", async () => {
    const client = await connect(services);
    const project = JSON.parse(text(await client.callTool({ name: "create_project", arguments: { title: "Garden" } })));
    expect(project).toEqual({ ok: true, id: expect.any(String) });
    const projects = JSON.parse(text(await client.callTool({ name: "list_projects", arguments: {} })));
    expect(projects.projects).toContainEqual({ id: project.id, title: "Garden" });

    const page = JSON.parse(text(await client.callTool({ name: "create_page", arguments: { title: "Scratch" } })));
    const made = JSON.parse(text(await client.callTool({ name: "suggest_action", arguments: { action: "delete", page: page.id } })));
    expect(made).toEqual({ ok: true, id: expect.any(String) });
    const status = JSON.parse(text(await client.callTool({ name: "get_suggestion", arguments: { id: made.id } })));
    expect(status).toMatchObject({ status: "pending", subject: `page:${page.id}` });
  });

  it("finds the human's feedback and revises the suggestion", async () => {
    const client = await connect(services);
    const call = async (name: string, args: Record<string, unknown>) => JSON.parse(text(await client.callTool({ name, arguments: args })));
    const page = await call("create_page", { title: "Scratch" });
    const made = await call("suggest_action", { action: "rename", page: page.id, title: "Notes from the Monday meeting" });
    services.suggestions.requestChanges(services.suggestions.idsStartingWith(made.id)[0]!, "Shorter, please");

    const listed = await call("list_suggestions", { state: "changes_requested" });
    expect(listed).toEqual({
      suggestions: [{ id: made.id, action: "rename", status: "changes_requested", place: `page:${page.id}`, subject: `page:${page.id}` }],
      more: false,
    });
    expect(await call("get_suggestion", { id: made.id })).toMatchObject({ feedback: [{ text: "Shorter, please" }] });
    expect(await call("revise_suggestion", { id: made.id, title: "Monday notes", note: "Shortened" })).toEqual({ ok: true, revision: 2 });
    expect(await call("get_suggestion", { id: made.id })).toMatchObject({ status: "pending", revision: 2, note: "Shortened" });
  });

  it("returns refusals as tool errors with the API's code", async () => {
    const client = await connect(services);
    const result = await client.callTool({ name: "transition", arguments: { id: "task0001", name: "complete" } });
    expect(result.isError).toBe(true);
    expect(text(result)).toMatch(/^invalid_transition: /);
    const missing = await client.callTool({ name: "get_task", arguments: { id: "nothere" } });
    expect(text(missing)).toMatch(/^not_found: /);
  });
});
