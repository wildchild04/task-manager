import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { beforeEach, describe, expect, it } from "vitest";

import { handleAgentRequest } from "../app/lib/agent/request.server";
import { type AgentCall, createAgentServer } from "../mcp/tools";
import { type AppServices, createInMemoryServices } from "~/composition";

/** A real MCP client talking to the agent server, which calls the app in-process. */
async function connect(services: AppServices, agent = "builder") {
  const call: AgentCall = async (method, path, input) => {
    const url = new URL(`http://app/api/agent/${path}`);
    if (method === "GET") for (const [key, value] of Object.entries(input ?? {})) url.searchParams.set(key, String(value));
    const request = new Request(url, {
      method,
      headers: {
        authorization: "Bearer t",
        "x-agent-name": agent,
        ...(method === "POST" ? { "content-type": "application/json" } : {}),
      },
      ...(method === "POST" ? { body: JSON.stringify(input ?? {}) } : {}),
    });
    const response = await handleAgentRequest(services, request, path, "t");
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

  it("offers the eleven tools, each describing its defaults", async () => {
    const client = await connect(services);
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([
      "append_description",
      "comment",
      "get_task",
      "list_comments",
      "list_projects",
      "list_references",
      "list_tasks",
      "read_description",
      "read_page",
      "search_pages",
      "transition",
    ]);
    expect(tools.find((t) => t.name === "list_tasks")!.description).toContain("default 10");
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

  it("works a task end to end as the agent", async () => {
    const client = await connect(services);
    expect(text(await client.callTool({ name: "transition", arguments: { id: "task0001", name: "start" } }))).toBe(
      '{"ok":true,"state":"in_progress"}',
    );
    await client.callTool({ name: "comment", arguments: { id: "task0001", markdown: "Done with **step one**" } });
    const comments = JSON.parse(text(await client.callTool({ name: "list_comments", arguments: { id: "task0001" } })));
    expect(comments.comments[0]).toMatchObject({ author: "builder", markdown: "Done with **step one**" });
  });

  it("returns refusals as tool errors with the API's code", async () => {
    const client = await connect(services);
    const result = await client.callTool({ name: "transition", arguments: { id: "task0001", name: "cancel" } });
    expect(result.isError).toBe(true);
    expect(text(result)).toMatch(/^forbidden: /);
    const missing = await client.callTool({ name: "get_task", arguments: { id: "nothere" } });
    expect(text(missing)).toMatch(/^not_found: /);
  });
});
