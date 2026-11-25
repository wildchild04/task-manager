## Why

Bug: approving a `replace` keeps the target's nested blocks and moves them under the first proposed block, or after the proposed blocks when the first cannot hold them. But the `suggest` tool says only that `replace` "swaps the block `target` for `markdown`", which agents read as swapping the block with what's nested in it (as `delete` does). On 2026-11-02 an agent repeated a list item's sub-bullets in its proposed Markdown, so after approval every sub-bullet showed twice and the page needed 8 more delete suggestions. Nothing warned the agent, and the suggestion region didn't tell the reviewer the nested blocks would stay.

## What Changes

- The `suggest` tool description says a `replace` swaps the target alone: its nested blocks are kept and move under the first proposed block (or after the proposed blocks when it cannot hold children), so they shouldn't be repeated (a table is replaced whole).
- `POST suggest` returns a `warnings` entry when a `replace`'s target (not a table) has nested blocks and the proposed blocks have nested blocks of their own. The suggestion is still created.
- The suggestion region of a replace whose target has nested blocks says, under "Proposed", how many stay and where they go.

## Capabilities

### Modified Capabilities
- `agent-api`: the replace warning.
- `agent-mcp`: `suggest`'s description explains what a replace keeps.
- `agent-suggestions`: the region shows that the target's nested blocks stay.

## Non-goals

- Changing how a replace is applied.
- Detecting which proposed nested blocks repeat the target's (any nesting warns).
- A replace mode that also replaces the nested blocks.

## Cloudscape gaps

The note uses the existing design system Typography component inside the review region.

## Impact

- `mcp/tools.ts`, `app/lib/agent/functions.server.ts`, `app/lib/page-view.server.ts`, `app/blocks/view-model.ts` (`kept`), `app/blocks/block-view.tsx`.
- Tests: a contract test (replacing a list item with children keeps them once), an agent API test (the warning, and no duplicates), a view test (the count and the region's note).
- MCP clients need the updated server for the new description.
