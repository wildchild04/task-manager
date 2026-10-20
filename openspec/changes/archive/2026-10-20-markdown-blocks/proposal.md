## Why

Agents and people write pages in Markdown, but the block model stops at paragraphs, headings 1–3, lists, todos, toggles, quotes and dividers. Anything else is kept as literal text: 16 of the 20 workspace pages hold tables that show as raw `| a | b |` lines, code samples lose their fences, `####` headings become paragraphs, and the emoji legends written as callouts are plain text. These are the Markdown primitives the "Block editor v1" exploration lists first.

## What Changes

- **Tables**: a `table` block whose rows (`table_row`) and cells (`table_cell`) are blocks. Cells hold rich text (marks, links, mentions) and are edited like any text block. An optional header row and header column. Tab and Shift+Tab move between cells; Tab in the last cell adds a row; rows and columns are added and removed from the table's edges.
- **Code blocks**: a `code` block with a `language`, holding plain text: Enter adds a line, Tab indents, marks and mentions don't apply. Shown monospace, read-only pages with a copy button.
- **Headings 4–6**: `heading` `level` goes up to 6, with `####`–`######` shortcuts and slash commands.
- **Callouts**: a `callout` block with an `emoji` and a `tone` (default, info, success, warning, error), holding rich text and nested blocks.
- The slash menu and Markdown shortcuts offer the new types (` ``` ` for code, `/table`, `/callout`, `#### `–`###### `).
- Agents' Markdown reads and writes them: GFM pipe tables, ` ``` ` fences with a language, `####`–`######`, and GitHub alert syntax (`> [!TIP] 💡 text`) for callouts.
- A pending replace or delete marks its target in the editor in the same red as the suggestion's "Removed" part, and read-only text shows its line breaks, so the original and the struck copy are easy to match.
- Agents can ask what Markdown is supported: a new `GET markdown` function (`get_markdown_guide` tool) lists every block and mark with an example, and what isn't supported. Writes that meet recognizable but unsupported Markdown (images, raw HTML, footnotes, a table without its separator row, an unclosed fence) still succeed and return `warnings` naming the line and what was kept as text, so an agent learns at once instead of leaving literal text behind.
- The tables already stored as literal `|` paragraphs are converted by agents through suggestions (a replace per table, approved by the human); a one-off script does the same in bulk for anyone with server access (dry run first).

## Capabilities

### Modified Capabilities
- `block-tree`: the `table`, `table_row`, `table_cell`, `code` and `callout` types, heading levels 4–6, which types hold rich text, and the shape rules for tables.
- `block-editor`: editing behavior of the new types (cells, code lines, callouts), table navigation and row/column commands, shortcuts and slash commands.
- `page-viewer`: rendering of tables, code blocks, headings 4–6 and callouts.
- `agent-api`: Markdown conversion of the new types; the Markdown guide function; `warnings` on writes.
- `agent-mcp`: the `get_markdown_guide` tool.
- `agent-suggestions`: rows and cells of a table can't be suggestion targets or positions; whole tables can. A suggestion's target is marked in red in place.

## Non-goals

- Images and file storage (a separate change).
- Column alignment (`:---:`), cell merging, column widths, sorting or any database/table *view* behavior: tables are document content, not data.
- Syntax highlighting while editing code (read-only pages may highlight if the design system's `CodeBlock` does; the editor shows plain monospace text).
- Selecting several cells, or copying and pasting a table as a whole (belongs to the `paste-and-copy` and `block-selection` changes).
- Turning a table into other blocks and back.

## External dependencies

Design-system feature requests in `~/dev/design-system/feature-requests/`:
- **`document-table.md`**: a content table for documents. `Table` is a data grid (`rows`/`columns`/`getRowId`, sorting, selection) and can't hold editable cells, header columns or edge add-row/add-column controls. Until it ships, the app renders a semantic `<table>` styled with design tokens.
- **`code-editor-surface.md`**: an editable code surface matching `CodeBlock`'s look. `CodeBlock` is read-only by design ("use a dedicated CodeEditor when editing"). Read-only pages use `CodeBlock` now; the editor renders its own monospace surface until the request ships.
- **`document-callout.md`**: a callout container for page content with an emoji/icon slot and tones. `Alert` is an announcement (`role="alert"`/`"status"`), not document content. Until it ships, the app composes the box from tokens.

## Impact

- `src/domain/blocks/` (types, props schemas, validation of table shape, Markdown), `src/editor/` (block behaviors, table and code commands, navigation), `app/editor/editor-blocks.tsx`, `app/blocks/block-view.tsx`, `app/lib/page-view.server.ts`, `app/app.css`.
- `app/lib/agent/` (Markdown conversion, the guide function, warnings on writes), `mcp/tools.ts`, `mcp/README.md`.
- `scripts/convert-literal-tables.ts` (new, one-off).
- No migration: block types and props live in existing columns.
