# Agent MCP server

A stdio [MCP](https://modelcontextprotocol.io) server that lets AI agents work tasks in the app through its agent API (`/api/agent/*`). Each tool returns compact JSON with only the fields it documents; lists and texts are capped, and the results say how to get more.

## Setup

1. Give the app a token. In the app's `.env` (see `.env.example`):

   ```sh
   AGENT_TOKEN=<a long random secret>
   ```

   Generate one with `node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"`, then restart the app. The agent API is off while `AGENT_TOKEN` is unset.

2. Install the server: from the repo, `just install-mcp`. It bundles the server into one file, `~/.local/share/notion-tasks-mcp/server.mjs` (no `node_modules` needed), and installs the launcher `~/.local/bin/notion-tasks-mcp`. Run it again after changing `mcp/`.

3. Make a profile per app you talk to, `~/.config/notion-tasks-mcp/<profile>.env` (keep it private: `chmod 600`):

   ```sh
   APP_URL=https://home.example/task-manager
   AGENT_TOKEN=<the same secret>
   AGENT_NAME=claude
   # Only for a self-signed certificate:
   NODE_EXTRA_CA_CERTS=/home/me/.config/homelab/caddy-root.crt
   ```

   `APP_URL` is the app's address including its base path when it's served under one. `AGENT_NAME` is how the agent appears in task history and comments. Give each agent its own name; a task an agent starts is held by that agent until it's completed, paused or returned. Variables already set in the environment win over the profile.

4. Register it with the agent. For Claude Code, from any directory:

   ```sh
   claude mcp add notion-tasks -s user -- ~/.local/bin/notion-tasks-mcp homelab
   claude mcp add notion-tasks-dev -s user -- ~/.local/bin/notion-tasks-mcp dev
   ```

   No secrets end up in the agent's configuration. Reconnect the server (`/mcp`) after reinstalling.

To run from the source instead (while working on `mcp/`): `npm run mcp`, with the three variables set.

## Tools

| Tool | What it does |
|---|---|
| `list_projects` | `[{ id, title }]` |
| `list_tasks` | Filter by `project`, `kind`, `state`, `query`; `limit` (default 10), `cursor` |
| `create_task` | A task of any kind in a project, with a Markdown `description`; chores take `urgency` and `schedule`, updates `iteratesOn` |
| `get_task` | Summary: state, `transitions` you may apply now, `heldBy`, counts |
| `read_description` | The description as Markdown; `maxChars` (default 2000), `offset`, `anchors` (block IDs) |
| `list_comments` | Newest first; `limit` (default 5), `cursor`, `maxChars` per comment (default 1000) |
| `list_references` | What the task references |
| `transition` | `start`, `pause`, `complete`, `return` (with `reason`) on work tasks |
| `comment` | Comment on a work task in Markdown; mention with `@[Title](task:id)` or `@[Title](page:id)` |
| `append_description` | Add Markdown to the end of a work task's description |
| `search_pages` | Knowledge library and workspace pages by title |
| `read_page` | A page as Markdown; `maxChars`, `offset`, `anchors` (block IDs) |
| `create_page` | A page with Markdown content: global in the workspace, in a project's library (`project`), or inside another page (`parent`) |
| `suggest` | Propose an insert, replace or delete in any page or description, at a block from `anchors`; a human approves or rejects it |
| `get_suggestion` | A suggestion's status: pending, outdated, approved, rejected, withdrawn |
| `withdraw_suggestion` | Take back your own pending suggestion |
| `get_markdown_guide` | The Markdown agents can write (headings to `######`, lists, todos, quotes, pipe tables, ``` code fences, `> [!NOTE]` callouts, marks, links, mentions) and what isn't supported |

Tools that take Markdown keep anything unsupported (images, raw HTML, footnotes, a table without its `|---|` row, an unclosed fence) as text and say so in `warnings`, by line, e.g. `"Line 3: images aren't supported yet; kept as text"`.

Agents can't cancel, change chores or explorations, or delete anything, and they change existing pages and descriptions only through suggestions a human approves.
