## Why

Agents can read pages but not write them: a planning or research agent can't leave its notes, designs or runbooks where a human would look for them, so it stuffs them into task descriptions instead. Pages live in two places — the global workspace and each project's knowledge library — and agents need to create in both.

## What Changes

- `POST /api/agent/pages` creates a page with an optional Markdown body: a workspace page by default, a document at the top of a project's library with `project`, or a page nested in an existing page (workspace or library) with `parent`. It goes after the existing pages there, as the web forms do.
- The MCP server gains `create_page`.

## Capabilities

### Modified Capabilities
- `agent-api`: agents may create pages; a new function.
- `agent-mcp`: the `create_page` tool.

## Non-goals

- Editing, renaming, moving or deleting existing pages: still human-only.
- Creating pages inside task descriptions (a task's description isn't a page agents can find with `search_pages`).
- Recording who created a page.

## External dependencies

None.

## Impact

- `app/lib/agent/functions.server.ts` (create, sharing the Markdown insert with `appendBlocks`), `request.server.ts` (route); `mcp/tools.ts`, `mcp/README.md`; tests.
