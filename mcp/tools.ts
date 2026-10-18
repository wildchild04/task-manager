import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

/**
 * Calls the app's agent API: `GET`/`POST /api/agent/<path>` with a query or a
 * JSON body. Returns the HTTP status and the parsed JSON answer.
 */
export type AgentCall = (
  method: "GET" | "POST",
  path: string,
  input?: Record<string, unknown>,
) => Promise<{ status: number; body: unknown }>;

type ToolResult = { content: { type: "text"; text: string }[]; isError?: boolean };

/** The API's answer as a tool result: compact JSON, or the error's code and message. */
async function run(call: AgentCall, method: "GET" | "POST", path: string, input?: Record<string, unknown>): Promise<ToolResult> {
  // Leave out parameters the agent didn't pass, so the API's defaults apply.
  const given = input && Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined));
  const { status, body } = await call(method, path, given);
  const error = (body as { error?: { code: string; message: string } } | null)?.error;
  if (status >= 400 || error)
    return {
      content: [{ type: "text", text: `${error?.code ?? status}: ${error?.message ?? "request failed"}` }],
      isError: true,
    };
  return { content: [{ type: "text", text: JSON.stringify(body) }] };
}

const id = z.string().describe("Task ID: the 8-character ID from list_tasks (or the full ID)");
const limit = (fallback: number) =>
  z.number().int().min(1).max(50).optional().describe(`How many to return (default ${fallback}, max 50)`);
const cursor = z.string().optional().describe("The `cursor` from the previous result, to get the next ones");
const maxChars = (fallback: number) =>
  z.number().int().min(1).max(20000).optional().describe(`Cut the text after this many characters (default ${fallback})`);
const offset = z.number().int().min(0).optional().describe("Continue reading from this `offset` (from the previous result)");

/** The MCP server for agents: one tool per agent API function. */
export function createAgentServer(call: AgentCall): McpServer {
  const server = new McpServer({ name: "notion-task-manager", version: "0.1.0" });
  const enc = encodeURIComponent;

  server.registerTool("list_projects", { description: "List the projects. Returns [{ id, title }]." }, () =>
    run(call, "GET", "projects"),
  );

  server.registerTool(
    "list_tasks",
    {
      description:
        "List tasks, most recently updated first. Returns at most `limit` tasks (default 10) as { id, kind, state, title }, plus `more`; pass the returned `cursor` for the next ones. Kinds: exploration, update, work, chore. Work states: todo, in_progress, done, cancelled.",
      inputSchema: {
        project: z.string().optional().describe("Only this project's tasks (ID from list_projects)"),
        kind: z.enum(["exploration", "update", "work", "chore"]).optional(),
        state: z.string().optional().describe("Only tasks in this state, e.g. todo"),
        query: z.string().optional().describe("Only tasks whose title contains this"),
        limit: limit(10),
        cursor,
      },
    },
    (input) => run(call, "GET", "tasks", input),
  );

  server.registerTool(
    "create_task",
    {
      description:
        "Create a task in a project, in its kind's first state. `description` is Markdown (same as `comment`). Chores take `urgency` and `schedule`; updates take `iteratesOn` (a done work task). Returns { ok, id, state }.",
      inputSchema: {
        project: z.string().describe("Project ID from list_projects"),
        kind: z.enum(["exploration", "update", "work", "chore"]),
        title: z.string(),
        description: z.string().optional().describe("The task's description, in Markdown"),
        urgency: z.enum(["normal", "urgent"]).optional().describe("Chores only (default normal)"),
        schedule: z
          .record(z.string(), z.unknown())
          .optional()
          .describe(
            'Chores only. One of: { type: "time", time: "HH:mm" }, { type: "date", date: "YYYY-MM-DD", time }, { type: "timer", minutes }, { type: "frequency", every: "daily" | "weekly" | "monthly", time, weekday? (1 = Monday, weekly), dayOfMonth? (monthly) }, { type: "interval", amount, unit: "minutes" | "hours" | "days" | "weeks" }',
          ),
        iteratesOn: z.string().optional().describe("Updates only: the done work task's ID"),
      },
    },
    (input) => run(call, "POST", "tasks", input),
  );

  server.registerTool(
    "get_task",
    {
      description:
        "A task's summary: { id, kind, state, title, project, heldBy?, transitions, counts: { comments, references } }. `transitions` are the ones you may apply now. Read the description, comments and references with their own tools.",
      inputSchema: { id },
    },
    ({ id }) => run(call, "GET", `task/${enc(id)}`),
  );

  server.registerTool(
    "read_description",
    {
      description:
        "A task's description as Markdown, cut at `maxChars` (default 2000). If `more` is true, call again with the returned `offset`.",
      inputSchema: { id, maxChars: maxChars(2000), offset },
    },
    ({ id, ...rest }) => run(call, "GET", `task/${enc(id)}/description`, rest),
  );

  server.registerTool(
    "list_comments",
    {
      description:
        "A task's comments, newest first: at most `limit` (default 5) as { id, author, markdown }, each cut at `maxChars` (default 1000). `author` is \"human\" or an agent's name. Pass `cursor` for older ones.",
      inputSchema: { id, limit: limit(5), cursor, maxChars: maxChars(1000) },
    },
    ({ id, ...rest }) => run(call, "GET", `task/${enc(id)}/comments`, rest),
  );

  server.registerTool(
    "list_references",
    {
      description:
        "What a task references: at most `limit` (default 10) as { kind, id, title } (or { kind, id, missing: true }).",
      inputSchema: { id, limit: limit(10) },
    },
    ({ id, ...rest }) => run(call, "GET", `task/${enc(id)}/references`, rest),
  );

  server.registerTool(
    "transition",
    {
      description:
        "Move a work task: start (take it; you then hold it until it leaves in_progress), pause, complete, or return (give it back to todo; needs a `reason`, posted as your comment). Returns { ok, state }.",
      inputSchema: {
        id,
        // Not an enum: the app decides what's allowed, and says why when it isn't.
        name: z.string().describe("start, pause, complete or return"),
        reason: z.string().optional().describe("Why you're returning the task (required for return)"),
      },
    },
    ({ id, ...rest }) => run(call, "POST", `task/${enc(id)}/transition`, rest),
  );

  server.registerTool(
    "comment",
    {
      description:
        "Comment on a work task, in Markdown (paragraphs, # headings, - lists, - [ ] todos, > quotes, **bold**, *italic*, `code`, [links](url); mention with @[Title](task:id) or @[Title](page:id)). Returns { ok, id }.",
      inputSchema: { id, markdown: z.string() },
    },
    ({ id, markdown }) => run(call, "POST", `task/${enc(id)}/comment`, { markdown }),
  );

  server.registerTool(
    "append_description",
    {
      description: "Add Markdown to the end of a work task's description (same Markdown as `comment`). Returns { ok }.",
      inputSchema: { id, markdown: z.string() },
    },
    ({ id, markdown }) => run(call, "POST", `task/${enc(id)}/description`, { markdown }),
  );

  server.registerTool(
    "search_pages",
    {
      description:
        "Find knowledge library and workspace pages whose title contains `query`. Returns at most `limit` (default 10) as { id, title, place }.",
      inputSchema: { query: z.string(), limit: limit(10) },
    },
    (input) => run(call, "GET", "pages", input),
  );

  server.registerTool(
    "read_page",
    {
      description:
        "A page as { title, markdown }, cut at `maxChars` (default 2000). If `more` is true, call again with the returned `offset`.",
      inputSchema: { id: z.string().describe("Page ID from search_pages"), maxChars: maxChars(2000), offset },
    },
    ({ id, ...rest }) => run(call, "GET", `page/${enc(id)}`, rest),
  );

  return server;
}
