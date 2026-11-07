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

type ToolResult = {
  content: ({ type: "text"; text: string } | { type: "image"; data: string; mimeType: string })[];
  isError?: boolean;
};

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

/**
 * An image from the API as MCP image content, so the agent sees it, followed
 * by its metadata (the API's answer without the bytes) as text.
 */
async function image(call: AgentCall, path: string): Promise<ToolResult> {
  const result = await run(call, "GET", path);
  if (result.isError) return result;
  const { data, ...meta } = JSON.parse((result.content[0] as { text: string }).text) as { data: string; type: string };
  return {
    content: [
      { type: "image", data, mimeType: meta.type },
      { type: "text", text: JSON.stringify(meta) },
    ],
  };
}

const id = z.string().describe("Task ID: the 8-character ID from list_tasks (or the full ID)");
const limit = (fallback: number) =>
  z.number().int().min(1).max(50).optional().describe(`How many to return (default ${fallback}, max 50)`);
const cursor = z.string().optional().describe("The `cursor` from the previous result, to get the next ones");
const maxChars = (fallback: number) =>
  z.number().int().min(1).max(20000).optional().describe(`Cut the text after this many characters (default ${fallback})`);
const offset = z.number().int().min(0).optional().describe("Continue reading from this `offset` (from the previous result)");
const anchors = z
  .boolean()
  .optional()
  .describe("End each block's first line with ` ^` and its block ID, to point `suggest` at it (default false)");

/** What every tool that takes Markdown says about it. */
const MARKDOWN_NOTE =
  " Markdown as described by get_markdown_guide (including pipe tables, ``` code fences and > [!NOTE] callouts); anything unsupported is kept as text and listed in `warnings` by line.";

/** The MCP server for agents: one tool per agent API function. */
export function createAgentServer(call: AgentCall): McpServer {
  const server = new McpServer({ name: "notion-task-manager", version: "0.1.0" });
  const enc = encodeURIComponent;

  server.registerTool("list_projects", { description: "List the projects. Returns [{ id, title }]." }, () =>
    run(call, "GET", "projects"),
  );

  server.registerTool(
    "create_project",
    {
      description: "Create a project, with its home page and knowledge library. Returns { ok, id }.",
      inputSchema: { title: z.string() },
    },
    (input) => run(call, "POST", "projects", input),
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
        "Create a task in a project, in its kind's first state. `description` is Markdown (same as `comment`). Chores take `urgency` and `schedule`; updates take `iteratesOn` (a done work task). Returns { ok, id, state, warnings? }." +
        MARKDOWN_NOTE,
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
        "A task's summary: { id, kind, state, title, project, heldBy?, transitions, counts: { comments, references, findings? } } (`findings` for explorations). `transitions` are the ones you may apply now. Read the description, comments, findings and references with their own tools.",
      inputSchema: { id },
    },
    ({ id }) => run(call, "GET", `task/${enc(id)}`),
  );

  server.registerTool(
    "read_description",
    {
      description:
        "A task's description as Markdown, cut at `maxChars` (default 2000). If `more` is true, call again with the returned `offset`. Pending suggestions show as `<suggestion …>` … `</suggestion>`. Uploaded images are listed in `assets` as { id, alt }: look at one with read_page_asset.",
      inputSchema: { id, maxChars: maxChars(2000), offset, anchors },
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
        "Move a task through its lifecycle; get_task lists the `transitions` you may apply now. Explorations and updates (open, promoted, tombstoned): promote (turn it into a new work task born from it; `title` defaults to the idea's), revive. Work (todo, in_progress, done, cancelled): start (take it; you then hold it until it leaves in_progress), pause, complete, return (back to todo; needs a `reason`, posted as your comment), reopen. Chores (todo, done, cancelled): complete (`next`: create the following occurrence; defaults to yes when recurring), cancel (skips this occurrence). Returns { ok, state, work? } (`work`: the new work task's ID, after promote).",
      inputSchema: {
        id,
        // Not an enum: the app decides what's allowed, and says why when it isn't.
        name: z.string().describe("The transition, e.g. promote, start, complete, return"),
        reason: z.string().optional().describe("return: why you're giving the work back (required)"),
        title: z.string().optional().describe("promote: the new work task's title (default: the idea's title)"),
        next: z.boolean().optional().describe("Chore complete: create the following occurrence"),
        scope: z.literal("occurrence").optional().describe("Chore cancel: this occurrence (the default)"),
      },
    },
    ({ id, ...rest }) => run(call, "POST", `task/${enc(id)}/transition`, rest),
  );

  server.registerTool(
    "comment",
    {
      description:
        "Comment on a work task, in Markdown (paragraphs, # headings, - lists, - [ ] todos, > quotes, **bold**, *italic*, `code`, [links](url); mention with @[Title](task:id) or @[Title](page:id)). Returns { ok, id, warnings? }." +
        MARKDOWN_NOTE,
      inputSchema: { id, markdown: z.string() },
    },
    ({ id, markdown }) => run(call, "POST", `task/${enc(id)}/comment`, { markdown }),
  );

  server.registerTool(
    "list_findings",
    {
      description:
        "An exploration's findings (its recorded results), newest first: at most `limit` (default 5) as { id, author, markdown }, each cut at `maxChars` (default 1000). `author` is \"human\" or an agent's name. Pass `cursor` for older ones.",
      inputSchema: { id, limit: limit(5), cursor, maxChars: maxChars(1000) },
    },
    ({ id, ...rest }) => run(call, "GET", `task/${enc(id)}/findings`, rest),
  );

  server.registerTool(
    "add_finding",
    {
      description:
        "Record a finding on an exploration (in any state): what you learned, decided or ruled out, in Markdown (same as `comment`). Findings are an exploration's results, kept apart from its description; they're added without approval, and you can edit and delete only your own. Returns { ok, id, warnings? }." +
        MARKDOWN_NOTE,
      inputSchema: { id, markdown: z.string() },
    },
    ({ id, markdown }) => run(call, "POST", `task/${enc(id)}/finding`, { markdown }),
  );

  server.registerTool(
    "edit_finding",
    {
      description:
        "Replace the whole content of one of your own findings with `markdown` (same as `comment`); `id` is the finding's ID from add_finding or list_findings. Returns { ok, warnings? }." +
        MARKDOWN_NOTE,
      inputSchema: { id: z.string().describe("The finding's ID"), markdown: z.string() },
    },
    ({ id, markdown }) => run(call, "POST", `finding/${enc(id)}`, { markdown }),
  );

  server.registerTool(
    "delete_finding",
    {
      description: "Delete one of your own findings for good. Returns { ok }.",
      inputSchema: { id: z.string().describe("The finding's ID") },
    },
    ({ id }) => run(call, "POST", `finding/${enc(id)}/delete`, {}),
  );

  server.registerTool(
    "append_description",
    {
      description:
        "Add Markdown to the end of a work task's description (same Markdown as `comment`). Returns { ok, warnings? }." +
        MARKDOWN_NOTE,
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
        "A page as { title, markdown, assets? }, cut at `maxChars` (default 2000). If `more` is true, call again with the returned `offset`. Pending suggestions show as `<suggestion …>` … `</suggestion>`. `assets` lists the page's uploaded images as { id, alt } (the whole page, in order): look at one with read_page_asset.",
      inputSchema: { id: z.string().describe("Page ID from search_pages"), maxChars: maxChars(2000), offset, anchors },
    },
    ({ id, ...rest }) => run(call, "GET", `page/${enc(id)}`, rest),
  );

  server.registerTool(
    "read_page_asset",
    {
      description:
        "Look at an uploaded image from a page or a task's description: give `page` or `task`, and `asset`, an ID from the `assets` that read_page or read_description returned. Returns the image (PNG, JPEG, GIF or WebP) and { id, type, size, width?, height? }. Only images uploaded to that page or description; external image URLs are never fetched.",
      inputSchema: {
        page: z.string().optional().describe("Page ID from search_pages"),
        task: z.string().optional().describe("Task ID: its description"),
        asset: z.string().describe("An image ID from `assets`"),
      },
    },
    ({ page, task, asset }) =>
      (page === undefined) === (task === undefined)
        ? { content: [{ type: "text", text: "validation: Give `page` or `task`, not both" }], isError: true }
        : image(call, page !== undefined ? `page/${enc(page)}/asset/${enc(asset)}` : `task/${enc(task!)}/asset/${enc(asset)}`),
  );

  server.registerTool(
    "create_page",
    {
      description:
        "Create a page titled `title`, with optional Markdown content (same as `comment`; mention with `@[Title](page:id)`). Where it goes: a workspace page by default; with `project`, a document at the top of that project's library; with `parent`, a page inside that page (workspace or library). Give `project` or `parent`, not both. It's added after the existing pages there. Returns { ok, id, warnings? }." +
        MARKDOWN_NOTE,
      inputSchema: {
        title: z.string(),
        project: z.string().optional().describe("Project ID from list_projects: create in its knowledge library"),
        parent: z.string().optional().describe("Page ID from search_pages: create inside that page"),
        markdown: z.string().optional().describe("The page's content, in Markdown"),
      },
    },
    (input) => run(call, "POST", "pages", input),
  );

  server.registerTool(
    "suggest",
    {
      description:
        "Propose a change to a page or a task's description; a human approves or rejects it, and nothing changes until then. Read it first with `anchors: true` to get block IDs. `insert` adds `markdown` after the block `after`, as the last children of `inside`, or at the end; `replace` swaps the block `target` for `markdown`; `delete` removes `target` and what's nested in it. `note` (at most 280 characters) tells the human why. Works on any page or task, including work another agent holds. A table is suggested on as a whole: its rows and cells can't be targets. Returns { ok, id, warnings? }." +
        MARKDOWN_NOTE,
      inputSchema: {
        page: z.string().optional().describe("Page ID from search_pages (or give `task`)"),
        task: z.string().optional().describe("Task ID: suggest on its description (or give `page`)"),
        action: z.enum(["insert", "replace", "delete"]),
        after: z.string().optional().describe("insert: the block ID to follow"),
        inside: z.string().optional().describe("insert: the block ID to add under"),
        target: z.string().optional().describe("replace and delete: the block ID"),
        markdown: z.string().optional().describe("insert and replace: the proposed blocks, in Markdown"),
        note: z.string().optional().describe("Why, for the human reviewing it"),
      },
    },
    (input) => run(call, "POST", "suggest", input),
  );

  server.registerTool(
    "suggest_action",
    {
      description:
        "Propose an action for a human to approve or reject; nothing changes until then. On exactly one of `project`, `page` or `task`: `rename` (with `title`) or `delete` a project, a page or a task; `schedule` a chore in to do (`schedule`, or `null` to remove it); `transition`: cancel work, tombstone an exploration or update, or cancel a recurring chore's whole series (`transition: \"cancel\"`, `scope: \"series\"`). `note` (at most 280 characters) tells the human why. If the subject changes first, the suggestion becomes outdated. Returns { ok, id }.",
      inputSchema: {
        action: z.enum(["rename", "delete", "schedule", "transition"]),
        project: z.string().optional().describe("Project ID from list_projects"),
        page: z.string().optional().describe("Page ID from search_pages"),
        task: z.string().optional().describe("Task ID from list_tasks"),
        title: z.string().optional().describe("rename: the new title"),
        schedule: z
          .record(z.string(), z.unknown())
          .nullable()
          .optional()
          .describe("schedule: as for create_task, or null to remove the chore's schedule"),
        transition: z.enum(["cancel", "tombstone"]).optional().describe("transition: cancel (work, chore series) or tombstone (ideas)"),
        scope: z.literal("series").optional().describe("transition: a chore's cancel needs scope series"),
        note: z.string().optional().describe("Why, for the human reviewing it"),
      },
    },
    (input) => run(call, "POST", "suggest-action", input),
  );

  server.registerTool(
    "get_suggestion",
    {
      description:
        "A suggestion's status: { id, action, status, place, subject?, revision, note?, feedback?, resolvedAt? } (`subject`: what an action from suggest_action acts on). Status is pending, changes_requested (the human asked for changes: `feedback` is [{ text, at }], oldest first; revise it with revise_suggestion), outdated (its target or subject changed since; revise it against the page as it is now, or withdraw it), approved, rejected or withdrawn.",
      inputSchema: { id: z.string().describe("Suggestion ID from suggest or suggest_action") },
    },
    ({ id }) => run(call, "GET", `suggestion/${enc(id)}`),
  );

  server.registerTool(
    "list_suggestions",
    {
      description:
        "Your own open suggestions (from suggest and suggest_action), oldest first: at most `limit` (default 10) as { id, action, status, place, subject? }, plus `more`; pass the returned `cursor` for the next ones. `state` narrows them to pending, outdated or changes_requested; a changes_requested one has the human's feedback, which get_suggestion shows. Check it to find suggestions to revise.",
      inputSchema: {
        state: z.enum(["pending", "outdated", "changes_requested"]).optional().describe("Only suggestions in this state"),
        limit: z.number().int().min(1).max(50).optional().describe("How many to return (default 10, max 50)"),
        cursor: z.string().optional().describe("The `cursor` from the previous result, to get the next ones"),
      },
    },
    (input) => run(call, "GET", "suggestions", input),
  );

  server.registerTool(
    "revise_suggestion",
    {
      description:
        "Change your own open suggestion in place, usually after the human asked for changes (see get_suggestion's `feedback`); the human then reviews it again. It keeps its ID, action, place and target or subject, and is checked against them as they are now. Give what fits its action: insert and replace take `markdown` (the new proposed blocks, replacing the old ones), rename takes `title`, schedule takes `schedule` (or null); any suggestion takes `note` (at most 280 characters), your reply to the human. To change the action, target or subject, withdraw it and suggest again. Returns { ok, revision, warnings? }." +
        MARKDOWN_NOTE,
      inputSchema: {
        id: z.string().describe("Suggestion ID from list_suggestions, suggest or suggest_action"),
        markdown: z.string().optional().describe("insert and replace: the new proposed blocks, in Markdown"),
        title: z.string().optional().describe("rename: the new title"),
        schedule: z
          .record(z.string(), z.unknown())
          .nullable()
          .optional()
          .describe("schedule: as for create_task, or null to remove the chore's schedule"),
        note: z.string().optional().describe("Your reply to the human"),
      },
    },
    ({ id, ...input }) => run(call, "POST", `suggestion/${enc(id)}/revise`, input),
  );

  server.registerTool(
    "withdraw_suggestion",
    {
      description: "Take back your own open suggestion (pending, outdated or changes_requested; from suggest or suggest_action). Returns { ok }.",
      inputSchema: { id: z.string().describe("Suggestion ID from suggest or suggest_action") },
    },
    ({ id }) => run(call, "POST", `suggestion/${enc(id)}/withdraw`, {}),
  );

  server.registerTool(
    "get_markdown_guide",
    {
      description:
        "The Markdown you can write in comments, descriptions, pages and suggestions: { blocks: [{ type, markdown, example }], inline, unsupported }. Check it before writing tables, code or callouts; what's unsupported is kept as text and reported in `warnings`.",
    },
    () => run(call, "GET", "markdown"),
  );

  return server;
}
