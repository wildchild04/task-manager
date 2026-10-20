## Context

Content is a tree of typed blocks. The editor gives each text block its own editable area and models the caret and selection as `{ blockId, anchor, focus }` inside one block's rich text. Edits are batches of `insert`/`update`/`move`/`delete` operations; typing is a content-only `update` that the save queue debounces and collapses. Mentions and references are indexed from block content and reference props, and drive the "Mentioned in" lists. Agents read and write the same blocks as Markdown through a small line-based converter (`src/domain/blocks/markdown.ts`).

Four kinds of content are missing: tables, code blocks, headings 4–6 and callouts. The design system has a data-grid `Table` and a read-only `CodeBlock`, and an `Alert` that announces messages; none of them is a document block, and none can be edited inline.

## Goals / Non-Goals

**Goals:**
- Tables, code blocks, headings 4–6 and callouts as first-class blocks: stored, rendered, edited, and read and written by agents as Markdown.
- Reuse the editor's text-block machinery (caret, typing, marks, mentions, undo, saving) everywhere text is typed, including table cells and code.
- Convert the tables already stored as literal `|` paragraphs.

**Non-Goals:** see the proposal (images, alignment, merged cells, highlighting while editing, multi-cell selection, table views).

## Decisions

### 1. Table cells are blocks: `table` → `table_row` → `table_cell`

A table is a `table` block (props `{ headerRow: boolean = true, headerColumn: boolean = false }`, no content) whose children are `table_row` blocks (no props, no content), whose children are `table_cell` blocks (no props; rich-text content; no children).

Why blocks, not props:
- **The caret is `{ blockId, offset }`.** A cell that is a text block holds the caret, selection, marks, mentions, the `@` menu, IME composition and undo with no second selection model. Cells in props would need a cell address inside the selection and a parallel set of commands.
- **Typing saves cheaply.** A keystroke in a cell is a content `update` of one cell block, debounced and collapsed by the save queue. With cells in props, every keystroke rewrites the table's (or row's) props, which the queue doesn't collapse, so each keystroke is a request carrying the whole table.
- **Mentions and backlinks work unchanged.** Mentions are indexed from content, so a mention in a cell shows the table's page under "Mentioned in". Rich text in props isn't indexed.
- **Agents can point at rows and cells** with block anchors, and the Markdown converter gets one block per cell.

*Alternatives:* (a) all cells as `RichText[][]` in the table's props: one block per table and trivially rectangular, but every point above fails; (b) Notion's model, row blocks with cells in row props: halves the block count but keeps the caret, typing and indexing problems for cells.

*Costs:* the tree must stay rectangular (decision 2), adding a column is one insert per row, and a 10×10 table is 111 blocks. Single-user scale makes the count irrelevant.

### 2. Table shape is checked by the domain

- Per operation (in `validate.ts`, like the other placement rules): a `table`'s children are only `table_row`s; a `table_row`'s parent is a `table` and its children are only `table_cell`s; a `table_cell`'s parent is a `table_row`; cells and rows can't have other children; none of the three can be turned into or out of another type.
- Per batch, after its operations apply (a new batch-end check in `applyBatch`, the only rule that needs one): every row of a touched table has the same number of cells, and a table has at least one row and one column. Adding a column (an insert per row) or deleting a row are therefore single batches. A batch that leaves a table ragged or empty is refused whole.
- The page-edit rule needs no change: tables are ordinary content of the page. Deleting a whole table is allowed; it isn't a page.

*Alternative:* let rows be ragged and pad when rendering. Rejected: every consumer (renderer, editor navigation, Markdown export) would need to agree on padding, and agents could create tables that look different from what they wrote.

### 3. Editing tables

Cells are text blocks with their own behavior row in `block-types.ts`; tables and rows are non-text:

| Key in a cell | Does |
|---|---|
| Tab / Shift+Tab | Next / previous cell in reading order; Tab in the last cell adds a row and moves into it |
| Enter | Moves to the cell below; in the last row, adds a row |
| Shift+Enter | Line break inside the cell |
| ↑ / ↓ on the first / last line | Cell above / below in the same column; from the first or last row, the block before or after the table |
| ← / → at an edge | Previous / next cell in reading order (the generic rule: cells are text blocks in document order) |
| Backspace at the start | Nothing (cells never merge) |

- Tab never nests anything inside a table, and blocks can't be moved into one.
- Rows and columns: a "+" under the table adds a row, one at its right adds a column. Each row and column has a small menu (shown on hover or focus) to insert before/after, move, and delete it. Each command is one batch and one undo step.
- The table itself: a menu on its top-left corner toggles the header row and header column and deletes the table. Backspace after a table steps over it, as for sub-pages: a table is too much content to lose to one key.
- Wide tables scroll horizontally inside the page; the page never scrolls sideways.

### 4. Code blocks are text blocks with plain content

`code` (props `{ language: string }`, empty for plain text, at most 32 characters) holds rich text restricted to plain spans: validation refuses marks and mentions in its content. Keeping it a text block reuses typing, undo and saving.

- Enter inserts a newline; Tab inserts two spaces, Shift+Tab removes up to two leading spaces on the caret's line; mark shortcuts and `@`/`/` menus are off inside code.
- Leaving: ↓ on the last line or ↑ on the first moves to the next or previous block (generic); Cmd/Ctrl+Enter adds a paragraph after the code block and moves there; Backspace at the start of an empty code block turns it into a paragraph.
- No children.
- A language picker above the block (common languages plus "Plain text"); any language agents write is kept and shown as written.
- Read-only pages render `CodeBlock` with `copyable`; the editor renders a monospace surface styled to match until the design system has an editable one.

### 5. Headings 4–6

`heading.level` becomes 1–6. The page title is the `h1`, so levels map to `h2`…`h6` with 5 and 6 both rendered as `h6`-sized text (6 lighter); the element's `aria-level` keeps the real level (+1). Shortcuts `#### `, `##### `, `###### ` and slash commands "Heading 4"–"Heading 6".

### 6. Callouts

`callout` (props `{ emoji: string = "💡", tone: "default" | "info" | "success" | "warning" | "error" = "default" }`) is a text block that can have children, like a toggle without folding: Enter adds a paragraph after it, Enter when empty and Backspace at its start turn it into a paragraph, Tab nests the next block into it. `emoji` is one grapheme. Clicking the emoji opens a menu of common emojis and the five tones. Not a live region: it's content.

### 7. Markdown

The converter gains a pre-pass before its line parser: fenced code and table runs are recognised as whole blocks at their indentation; everything else goes through the existing line rules.

| Block | Written | Read |
|---|---|---|
| Table | GFM pipe table. The header row (or, with `headerRow: false`, an empty header row) and a `---` delimiter row; cells as inline Markdown, `\|` for a literal pipe, `<br>` for a line break | A run of `\|` lines whose second line is a delimiter row. Rows are padded or cut to the header's width (as GFM does). An all-empty header row means `headerRow: false`. Alignment colons are accepted and ignored |
| Code | ```` ```lang ````, the text verbatim, closing fence; the fence is longer than any backtick run inside | From a fence to the matching fence; nothing inside is parsed |
| Heading 4–6 | `####`–`######` | Same |
| Callout | GitHub alert syntax: `> [!NOTE] 💡 text`, its text's further lines as `> ` lines, children indented | `> [!NOTE]`, `[!TIP]`, `[!IMPORTANT]`, `[!WARNING]`, `[!CAUTION]` map to tones default, success, info, warning, error. An emoji right after the marker is the callout's emoji; otherwise the tone's default emoji. The marker may be alone on its line, the text following on `> ` lines |

`headerColumn` has no Markdown form; agents read tables without it and new tables they write don't have one. Models know GitHub's alert syntax, so callouts written by agents come out right without instructions; writing the emoji explicitly keeps the round trip exact.

### 8. Suggestions and tables

A suggestion can insert, replace or delete a whole table, but rows and cells can't be targets or positions: a proposed paragraph can't take a cell's place. `suggest` refuses them (code `validation`), naming the table to target instead.

### 9. Converting the literal tables

`scripts/convert-literal-tables.ts` finds paragraphs whose Markdown (as agents read it) is a GFM table and replaces each with the table the converter builds, in the same place, one batch per page. It runs as a dry run by default (listing pages and table counts) and applies with `--apply`. On the homelab it runs inside the app container, after a backup.

## Risks / Trade-offs

- [Batch-end shape check is new machinery in `applyBatch`] → It runs only for tables touched by the batch and is covered by the shared repository contract tests on both backends.
- [Large tables are many blocks] → Fine at this scale; `loadTree` already loads a page's blocks in one query.
- [Enter moves down instead of adding a line, unlike Notion] → Shift+Enter adds a line; this keeps keyboard entry of tabular data fast. Decided with the user; to be adjusted after use.
- [Agents lose `headerColumn` on a round trip through Markdown] → Rare; agents edit through suggestions of whole tables, and a human can toggle it back.
- [Code blocks hold rich-text spans] → Validation keeps them plain, so the stored form is a string in all but name.

## Migration Plan

No schema migration: types and props live in existing columns. After deploying, an agent reads each page with literal tables and suggests replacing each one with the real table; the human reviews and approves them page by page. (Alternatively, with server access: back up, run the conversion script as a dry run, review, then `--apply`.) Rollback: older code would hit unknown block types, so roll back only after deleting or converting new tables, code blocks and callouts, or restore the backup.

## Decisions made with the user

1. **Enter in a table cell** moves to the cell below and adds a row from the last row; Shift+Enter is a line break in the cell. To be tried and adjusted after use.
2. **The existing literal tables** are converted by an agent through suggestions: one replace per literal-table paragraph, proposing the real table, approved by the human (Approve all per page). No server access needed, and every conversion is reviewed. The script stays for bulk use.
3. **Callouts** use GitHub alert syntax with the tone mapping above.
4. **Headings 4–6** are all added; 5 and 6 share a visual size, with `aria-level` keeping the real level.

## Telling agents what's supported

Unsupported Markdown used to become literal text silently: that's how 28 tables ended up as `|` paragraphs. Two additions:

- **`GET markdown`** (`get_markdown_guide`): a static description of the supported Markdown: each block type with its syntax and a one-line example, the marks, mentions and links, and an `unsupported` list (images, raw HTML other than `<u>`, footnotes, column alignment, nested tables) with what happens to each. Generated from the same tables the importer uses where possible, so it can't drift from it; a test asserts every block type is listed.
- **`warnings` on writes**: the importer reports recognizable but unsupported constructs it kept as text, by line: `![alt](src)` images, HTML tags other than `<u>`, `[^1]` footnotes, a `|` row block without a separator row, an unclosed ```` ``` ```` fence. `POST pages`, `POST tasks` (description), `POST suggest`, `POST task/:id/comment` and `POST task/:id/description` return `warnings: string[]` only when there are any (e.g. `"Line 12: images aren't supported yet; kept as text"`), so lean responses stay lean. Writes aren't refused: the text is kept, and the agent can fix it with a follow-up suggestion.

*Alternative:* refuse writes with unsupported Markdown. Rejected: an agent writing a long page would lose all of it over one image, and it can't always rewrite what it was asked to copy.

