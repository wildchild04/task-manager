## 1. Design system

- [x] 1.1 Feature requests in `~/dev/design-system/feature-requests/`: `document-table.md`, `code-editor-surface.md`, `document-callout.md` (written with the proposal; check they're still accurate before starting)

## 2. Block model

- [x] 2.1 Types and props schemas: `table`, `table_row`, `table_cell`, `code`, `callout`, heading levels 1–6; text types; plain-text content for `code`; no type changes into or out of table types; validation tests
- [x] 2.2 Table placement rules per operation, and the batch-end shape check (rectangular, at least one row and column) in `applyBatch`; shared repository contract tests on both backends

## 3. Markdown

- [x] 3.1 Pre-pass for fenced code and GFM tables before the line parser; headings `####`–`######`; GitHub alert callouts (tones, emoji, children); export of all four; round-trip tests including escaped pipes, `<br>`, empty header rows, ragged rows, fences containing backticks
- [x] 3.2 Agent API: Markdown reads and writes of the new types; suggestions refuse rows and cells as targets or positions; tests for the agent-api and agent-suggestions scenarios
- [x] 3.3 Markdown guide and warnings: `GET markdown` built from the importer's own syntax tables (test: every block type listed); the importer reports unsupported constructs by line; `warnings` on every Markdown write, absent when empty; `get_markdown_guide` tool, tool descriptions pointing to it; `mcp/README.md`; tests

## 4. Read-only rendering

- [x] 4.1 Renderers in `block-view.tsx` and view data in `page-view.server.ts`: table (header row and column, horizontal scroll), code (`CodeBlock`, copyable, language), headings 4–6 (levels and `aria-level`), callout (tone, emoji, children); mentions inside cells counted for "Mentioned in"; tests

## 5. Editor

- [x] 5.1 Block behaviors for the new types in `block-types.ts`; Backspace after a table steps over it; heading 4–6 and ```` ``` ```` shortcuts; slash commands Heading 4–6, Callout, Code, Table; editor tests
- [x] 5.2 Table commands: Tab/Shift+Tab, Enter/Shift+Enter, ↑/↓ by column, add row and column, row and column menus (insert, move, delete), header toggles, delete table; each one batch and one undo step; editor tests against the in-memory store
- [x] 5.3 Code editing: Enter, Tab and Shift+Tab indentation, Cmd/Ctrl+Enter to leave, no marks or menus, plain paste; language picker; editor tests
- [x] 5.4 Editor renderers for table (app-local semantic table until `document-table` ships), code (monospace surface until `code-editor-surface` ships) and callout (emoji and tone menu)

## 6. Existing content

- [x] 6.1 `scripts/convert-literal-tables.ts`: dry run listing pages and table counts, `--apply` converting each literal-table paragraph in one batch per page; tests on a fixture with the audit's table shapes
- [x] 6.2 After deploying: as an agent, suggest replacing each literal-table paragraph on the homelab pages with the real table, for the human to approve

## 7. Check

- [x] 7.1 Headless check: a page with every new block in light and dark and at phone width; typing and Tab through a table; a code block; a callout's tone; an agent writing and reading back each type; typecheck and full test run
