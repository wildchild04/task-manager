## Annotations

MCP clients use `readOnlyHint` to decide what to run without asking. Reads: `list_projects`, `list_tasks`, `get_task`, `read_description`, `read_project_description`, `list_comments`, `list_references`, `list_steps`, `list_diagnostics`, `search_pages`, `read_page`, `get_suggestion`, `get_markdown_guide`.

Writes are `destructiveHint: false` when they add or move something the human can still see and undo (a task, comment, entry, page, suggestion, step, transition, mark). They are `true` when they overwrite or remove the agent's own content: `update_step` (replaces a resolution), `update_diagnostic` (replaces an entry's Markdown), `withdraw_suggestion` (removes a suggestion). `idempotentHint: true` where repeating the call leaves the same result: `update_step`, `update_diagnostic`, `mark_diagnostic_incorrect`, `clear_diagnostic_mark`, `get_or_create_shift`, `withdraw_suggestion`. Nothing reaches outside the app, so `openWorldHint: false` everywhere.

The annotations sit in one table in `mcp/tools.ts`, keyed by tool name, so a new tool without an entry fails the test that every tool is annotated.

## Start exploration

`canStartExploration` becomes `offers(mode, "exploration") && task.kind !== "exploration"`, which hides the button. The `start-exploration` action refuses an exploration too, so a stale form can't create one. Explorations have no comments, so the per-comment action is unaffected.
