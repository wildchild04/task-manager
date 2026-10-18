# Agent MCP server

A stdio [MCP](https://modelcontextprotocol.io) server that lets AI agents work tasks in the app through its agent API (`/api/agent/*`). Each tool returns compact JSON with only the fields it documents; lists and texts are capped, and the results say how to get more.

## Setup

1. Give the app a token. In the app's `.env` (see `.env.example`):

   ```sh
   AGENT_TOKEN=<a long random secret>
   ```

   Generate one with `node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"`, then restart the app. The agent API is off while `AGENT_TOKEN` is unset.

2. Register the server with the agent. For Claude Code, from any directory:

   ```sh
   claude mcp add notion-tasks \
     -e APP_URL=http://localhost:5173 \
     -e AGENT_TOKEN=<the same secret> \
     -e AGENT_NAME=claude \
     -- npx tsx /absolute/path/to/notion-task-manager/mcp/server.ts
   ```

   `APP_URL` is the app's address including its base path when it's served under one (e.g. `https://home.example/task-manager`). `AGENT_NAME` is how the agent appears in task history and comments. Give each agent its own name; a task an agent starts is held by that agent until it's completed, paused or returned.

Run it by hand with `npm run mcp` (the three variables must be set).

## Tools

| Tool | What it does |
|---|---|
| `list_projects` | `[{ id, title }]` |
| `list_tasks` | Filter by `project`, `kind`, `state`, `query`; `limit` (default 10), `cursor` |
| `create_task` | A task of any kind in a project, with a Markdown `description`; chores take `urgency` and `schedule`, updates `iteratesOn` |
| `get_task` | Summary: state, `transitions` you may apply now, `heldBy`, counts |
| `read_description` | The description as Markdown; `maxChars` (default 2000), `offset` |
| `list_comments` | Newest first; `limit` (default 5), `cursor`, `maxChars` per comment (default 1000) |
| `list_references` | What the task references |
| `transition` | `start`, `pause`, `complete`, `return` (with `reason`) on work tasks |
| `comment` | Comment on a work task in Markdown; mention with `@[Title](task:id)` or `@[Title](page:id)` |
| `append_description` | Add Markdown to the end of a work task's description |
| `search_pages` | Knowledge library and workspace pages by title |
| `read_page` | A page as Markdown; `maxChars`, `offset` |

Agents can't cancel, touch chores or explorations, delete anything, or create tasks.
