## Why

Agents can read every page and description but can only write to work tasks they hold, so their notes, corrections and plans for pages and explorations end up in chat or comments instead of where they belong. Letting agents edit directly would risk human text and make several agents step on each other. Instead, agents **propose** block-level changes anywhere, shown in place as suggestions a human approves or rejects: the human stays the only one who changes content, and agents working in parallel never conflict because none of them edits the content itself.

## What Changes

- A new `suggestion` block: a container, shown highlighted in yellow with its author, note and **Approve** / **Reject**, holding an agent's proposed change at the place it would apply. Three actions:
  - **insert**: new blocks at a position (after a block, inside a block, or at the end of the page)
  - **replace**: new blocks in place of one existing block (shown as the old block struck through, then the new ones)
  - **delete**: removing one existing block (shown struck through)
- **Approve** applies the change in one step; **Reject** removes the suggestion. Either can be undone right after. Every suggestion keeps a record (author, action, status, who resolved it and when) after it leaves the page.
- A replace or delete whose target changed after it was proposed is **outdated**: shown as such and can't be approved, only rejected.
- **Approve all** / **Reject all** on a page with several pending suggestions.
- Pending suggestions are not content yet: mentions and references inside them don't count as backlinks, and editing never puts the caret inside them or changes them.
- Agent API and MCP: reads can return **block anchors** (short block IDs in the Markdown) so agents can point at a block; a new `suggest` function (and `suggest` tool) proposes a change to any page or task description; a `suggestion` function reports a suggestion's status. Agents see pending suggestions, theirs and others', in the Markdown they read. Agents can't approve or reject.
- The home dashboard lists pages and tasks with suggestions waiting for review.

## Capabilities

### New Capabilities
- `agent-suggestions`: suggestions as a domain concept: actions and their placement, the suggestion record and its statuses, approving, rejecting, undoing, outdated targets, approve/reject all.

### Modified Capabilities
- `block-tree`: the `suggestion` block type and its props.
- `block-editor`: how suggestion blocks behave in the editor (not editable, caret skips them, approve/reject from the block); edit batches can't create, change or delete suggestions or the blocks inside them.
- `page-viewer`: suggestions rendered on read-only pages; "Mentioned in" ignores pending suggestions.
- `task-screen`: a task's "Mentioned in" ignores pending suggestions.
- `agent-api`: permissions (suggest on any page or task description), the `suggest` and `suggestion` functions, block anchors on reads, suggestions in the Markdown conversion.
- `agent-mcp`: the `suggest` and `get_suggestion` tools; `anchors` on `read_page` and `read_description`.
- `project-screens`: the home dashboard lists suggestions waiting for review.

## Non-goals

- Word-level tracked changes inside a block: a replace swaps whole blocks.
- Suggestions from humans (a "suggesting" editing mode), or humans editing a suggestion before approving it. A human edits the result after approving.
- Suggesting new pages, deleting pages, moving blocks, or changing a page's title.
- Suggestions on comments or on a project's home page.
- Notifications beyond the dashboard list (see the Notifications exploration).
- Per-agent permissions (still open in "What agents are allowed to do").

## External dependencies

- **Design system: a review container** (`~/dev/design-system/feature-requests/review-container.md`): a highlighted, bordered region that holds arbitrary content, with a header (author, action label, note, status chip such as "Outdated") and actions (Approve, Reject), in light and dark themes and usable on touch. `Alert` comes closest but is an announcement (`role="alert"`/`status`), not a container for page content. Until it ships, the app can compose the container from `Card`, `Chip` and `Button`, and switch when it lands.

## Impact

- `src/domain/blocks/` (type, props schema), a new `src/domain/suggestions/` (service, repository, in-memory and SQLite implementations), migration `005_suggestions.sql`.
- `src/domain/blocks/page-edit.ts` (edit batches and suggestions), `src/editor/block-types.ts`, `app/editor/`, `app/blocks/` (rendering), `app/lib/page-view.server.ts`, `app/lib/backlinks.server.ts`, `app/lib/home.server.ts`.
- `src/domain/blocks/markdown.ts` (anchors, suggestions in Markdown), `app/lib/agent/` (functions, routes), `mcp/tools.ts`, `mcp/README.md`.
- Builds on `agent-create-pages` and `home-dashboard` (both unarchived); archive them first.
