# Agent MCP server

A stdio [MCP](https://modelcontextprotocol.io) server that lets AI agents work tasks in the app through its agent API (`/api/agent/*`). Each tool returns compact JSON with only the fields it documents; lists and texts are capped, and the results say how to get more.

## Setup

1. Register the agent in the app: **Settings → Agents → Register agent**, with the name it should appear under (e.g. `claude`). The app shows its token once. The token decides the agent's name: it appears under that name in task history and comments, and a task it starts is held by it until it's completed, paused or returned. Give each agent its own name and token, and revoke a token in Settings to stop that agent. From the command line: `just account agent claude` prints a new token.

2. Install the server: from the repo, `just install-mcp`. It bundles the server into one file, `~/.local/share/notion-tasks-mcp/server.mjs` (no `node_modules` needed), and installs the launcher `~/.local/bin/notion-tasks-mcp`. Run it again after changing `mcp/`.

3. Make a profile per app you talk to, `~/.config/notion-tasks-mcp/<profile>.env` (keep it private: `chmod 600`):

   ```sh
   APP_URL=https://home.example/task-manager
   AGENT_TOKEN=<the agent's token from Settings>
   # Only for a self-signed certificate:
   NODE_EXTRA_CA_CERTS=/home/me/.config/homelab/caddy-root.crt
   ```

   `APP_URL` is the app's address including its base path when it's served under one. An `AGENT_NAME` left from older profiles is ignored. Variables already set in the environment win over the profile. Without a profile name the launcher uses `default`, so `ln -s homelab.env default.env` makes the homelab the default.

4. Register it with the agent. For Claude Code, from any directory:

   ```sh
   claude mcp add notion-tasks -s user -- ~/.local/bin/notion-tasks-mcp homelab
   claude mcp add notion-tasks-dev -s user -- ~/.local/bin/notion-tasks-mcp dev
   ```

   No secrets end up in the agent's configuration. Reconnect the server (`/mcp`) after reinstalling.

To run from the source instead (while working on `mcp/`): `npm run mcp`, with the two variables set.

## Tools

| Tool | What it does |
|---|---|
| `list_projects` | `[{ id, title }]` |
| `create_project` | A project with its home page and knowledge library |
| `list_tasks` | Filter by `project`, `kind`, `state`, `query`; `limit` (default 10), `cursor` |
| `create_task` | A task of any kind in a project, with a Markdown `description`; chores take `urgency` and `schedule`, updates `iteratesOn` |
| `get_task` | Summary: state, `transitions` you may apply now, `heldBy`, counts |
| `read_description` | The description as Markdown; `maxChars` (default 2000), `offset`, `anchors` (block IDs); uploaded images in `assets` |
| `list_comments` | Newest first; `limit` (default 5), `cursor`, `maxChars` per comment (default 1000) |
| `list_references` | What the task references |
| `transition` | The working flow: `promote` (an exploration or update into work; optional `title`, answers the new `work` ID), `revive`; work `start`, `pause`, `complete`, `return` (with `reason`), `reopen`; chore `complete` (`next`), `cancel` (skips one occurrence) |
| `comment` | Comment on a work task in Markdown; mention with `@[Title](task:id)` or `@[Title](page:id)` |
| `append_description` | Add Markdown to the end of a work task's description |
| `list_findings` | An exploration's findings (its recorded results), newest first; `limit` (default 5), `cursor`, `maxChars` per finding (default 1000) |
| `add_finding` | Record a finding on an exploration in Markdown, without approval |
| `edit_finding` | Replace the content of your own finding |
| `delete_finding` | Delete your own finding |
| `search_pages` | Knowledge library and workspace pages by title |
| `read_page` | A page as Markdown; `maxChars`, `offset`, `anchors` (block IDs); uploaded images in `assets` |
| `read_page_asset` | An uploaded image from a page or description (`page` or `task`, and an `asset` ID from `assets`), as image content the agent can look at |
| `create_page` | A page with Markdown content: global in the workspace, in a project's library (`project`), or inside another page (`parent`) |
| `suggest` | Propose an insert, replace or delete in any page or description, at a block from `anchors`; a human approves or rejects it |
| `suggest_action` | Propose renaming or deleting a project, page or task, a chore's schedule, or an ending transition (cancel work, tombstone an idea, cancel a chore series); a human approves or rejects it |
| `list_suggestions` | Your own open suggestions, oldest first; `state: "changes_requested"` finds the ones the human asked you to change |
| `get_suggestion` | A suggestion's status: pending, changes_requested (with the human's `feedback`), outdated, approved, rejected, withdrawn; `revision`, `note`, and `subject` for actions |
| `revise_suggestion` | Change your own open suggestion in place: new `markdown`, `title` or `schedule`, and a `note` replying to the human |
| `withdraw_suggestion` | Take back your own open suggestion |
| `get_markdown_guide` | The Markdown agents can write (headings to `######`, lists, todos, quotes, pipe tables, ``` code fences, `> [!NOTE]` callouts, marks, links, mentions) and what isn't supported |

Images are written as `![alt](https://…)` on a line of their own; pages read back uploaded images with their absolute URLs. Tools that take Markdown keep anything unsupported (images without an http(s) URL or inside a line of text, raw HTML, footnotes, a table without its `|---|` row, an unclosed fence) as text and say so in `warnings`, by line, e.g. `"Line 3: images need an http(s) URL or an uploaded image; kept as text"`.

Agents create tasks, pages and projects directly, and apply the transitions of their working flow. Everything else goes through suggestions a human approves: changes to existing pages and descriptions (`suggest`), and renaming, deleting, rescheduling, cancelling work, tombstoning ideas and ending a chore series (`suggest_action`). Findings on explorations are the exception: agents add them directly, and edit and delete only their own. A work task another agent started is held by that agent until it leaves in progress.
