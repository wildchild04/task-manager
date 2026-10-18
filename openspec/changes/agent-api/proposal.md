## Why

The app was built so AI agents can take tasks, work them and report back; the domain already records agents as actors (`{ kind: "agent", name }`) in history and comments, and work can be returned with a reason. Nothing lets an agent reach it. Agents work through MCP tools, and their context is the scarcest resource they have, so the interface must hand back only what they ask for.

## What Changes

- **`/api/agent/*` in the app**: resource routes over the existing domain services, acting as the calling agent. Every request carries a shared token (from the app's environment) and the agent's name; without a configured token the API is off.
- **Lean by default**: summaries unless more is asked for; every list capped (`limit`, `cursor`, `more`); every text capped (`maxChars`, `offset`, `more`); 8-character ID prefixes in responses (full IDs or unique prefixes accepted); writes answer with the least that's useful (`{ ok, state }`).
- **Markdown in and out**: task descriptions, comments and pages are read as Markdown (with mentions as `@[Title](task:id)` / `@[Title](page:id)`); comments and description additions are written as Markdown and stored as blocks.
- **What agents may do**: read projects, tasks, comments, references and the knowledge library; start, pause, complete and return work tasks; comment on work; append to a work task's description. Nothing else: no cancelling, no chores, no deleting, no creating tasks.
- **Claiming**: the agent that starts a work task holds it; only that agent can pause, complete or return it while it's in progress (the human can always act on it from the app).
- **MCP server** (`mcp/` in this repo): a stdio MCP server whose tools call the API (`list_projects`, `list_tasks`, `get_task`, `read_description`, `list_comments`, `list_references`, `transition`, `comment`, `append_description`, `search_pages`, `read_page`), configured with the app's URL, the token and the agent's name. Tool descriptions state defaults and caps.

## Capabilities

### New Capabilities
- `agent-api`: the HTTP API for agents: authentication and identity, permissions and claiming, lean responses with caps and paging, Markdown conversion, and each function.
- `agent-mcp`: the MCP server exposing the API as tools for agents.

### Modified Capabilities
- (none)

## Non-goals

- Agents creating tasks (explorations for gaps they find), working chores, or cancelling work.
- History and lineage through the API.
- Work logs (a separate change, designed on top of this one).
- Per-agent tokens, rate limits, or access from other machines (the app stays local and single-user).
- Real-time notifications to agents (they poll with `list_tasks`).

## External dependencies

- `@modelcontextprotocol/sdk` for the MCP server (npm). No design-system components.

## Impact

- `app/routes/api.agent.*.ts` resource routes and `app/lib/agent/*.server.ts` (auth, ID prefixes, caps, handlers).
- `src/domain/blocks/markdown.ts`: blocks ↔ Markdown (pure, tested), including mentions.
- `mcp/`: the MCP server package (its own `package.json`, built with `tsx`), with tests against an in-process app.
- Environment: `AGENT_TOKEN` in the app; `APP_URL`, `AGENT_TOKEN`, `AGENT_NAME` for the MCP server.
- No database schema change.
