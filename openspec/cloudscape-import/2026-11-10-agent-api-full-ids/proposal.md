## Why

Agents (console workers and managers) are asked to give the user a link to a task's page. The web app's pages need the full ID (`/tasks/<full-id>`, `/projects/<full-id>`) and the page route doesn't resolve short prefixes, but the agent API returns only 8-character prefixes everywhere (`short = (id) => id.slice(0, 8)`). So agents can't build a working link.

## What Changes

- `get_task` and `list_tasks` return the task's full ID as `fullId` next to the short `id`; `get_task` also returns its project's full ID as `projectFullId` next to the short `project`.
- `list_projects` returns each project's full ID as `fullId`.
- Short IDs stay the default everywhere else, and every tool keeps accepting a full ID or a unique prefix (unchanged `resolveId`).
- MCP tool descriptions and `mcp/README.md` document the new fields.

## Capabilities

### Modified Capabilities
- `agent-api`: the `Lean responses` rule gains the full-ID exception, and the `GET projects`, `GET tasks` and `GET task/:id` response shapes gain `fullId` / `projectFullId`.

## Non-goals

- A ready-made web link (`url`) in the API: that needs the app's public origin (the tunnel host), which differs from the origin agents call the API on. Agents build the link from `fullId`.
- Changing any other function's response, or how requests resolve IDs.

## Cloudscape gaps

None: no UI change.

## Impact

- `app/lib/agent/functions.server.ts` (`listProjects`, `listTasks`, `getTask`), `mcp/outputs.ts`, `mcp/tools.ts`, `mcp/README.md`. Tests in `tests/app/agent-api.test.ts` and `tests/mcp.test.ts`.
