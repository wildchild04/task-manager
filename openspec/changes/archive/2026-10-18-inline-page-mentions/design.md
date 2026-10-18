## Context

Rich text is a flat list of spans with marks, and the editor addresses positions as plain-text offsets (`src/editor/rich-text.ts`, `app/editor/dom-caret.ts`). Reference blocks already point at pages by ID and resolve to `ok`, `missing` or `cycle` on the server. This change adds an inline pointer inside text, without a schema migration.

## Decisions

### 1. A mention is a one-character span
`{ text: "￼", mention: { pageId }, marks? }`. U+FFFC (object replacement character) is what text systems use for an embedded object. Because it is one UTF-16 unit and one grapheme, every offset-based operation (insert, delete, split, merge, undo, grapheme stepping) treats the mention as one character with no special cases. `normalize` never merges a mention span with a neighbour, and slicing never cuts one (it has length 1).

**Alternative considered:** a `mention` mark on text spans holding the title. Rejected: the title would be copied into the content and go stale on renames, and a mark spans arbitrary text.

### 2. Validated like reference targets
`parseContent` accepts the new span shape; `validateOperation` checks each mention's `pageId` names an existing `page` block (as `checkReferenceTarget` does for reference blocks) and rejects mentions in a `page`'s content. Content is JSON, so no migration. `plainText` (used for titles, summaries, search) renders a mention as nothing; titles can't hold one, and other text summaries lose only the mention.

### 3. Resolved on the server, sent with the view
Page views and editable pages carry `mentions: Record<pageId, { title } | null>` for every mention in the tree (`null` = missing). Renderers look titles up there; the editor adds entries when it inserts a mention (the menu already knows the title). After a reload or revalidation the server's titles win, so renames show up.

### 4. In the DOM: a non-editable element around the placeholder
A mention renders as `<a class="mention" contenteditable="false" data-mention-page-id href="/pages/…">` whose only text node is the U+FFFC character, visually hidden (`font-size: 0`), and whose title is drawn by CSS `::after { content: attr(data-title) }`. The text walk in `dom-caret.ts` then still counts exactly one character for it. `positionOf` never returns a position inside a mention: an offset before it maps to just before the element, after it to just after. Clicking a mention navigates with React Router (same tab), unlike external links.

### 5. The `@` menu reuses the slash menu's machinery
The slash menu's state (anchor, start offset, query, page, active row) and key handling are generalized into one "inline menu" with two sources: slash commands (local) and pages (fetched). Pages come from `GET /api/pages?q=` (the resource route `block-editor-v0` added for page links) returning up to 50 browsable pages whose title contains the query, ordered by how early the match is then by title, each with `{ id, title, place }` where `place` is "Project › Parent" or "Pages". The menu debounces fetches (~150 ms) and shows "Searching…" until the first result.

### 6. Editing
`insertMention(state, selection, page)` replaces the `@query` range with the mention span plus a space. Backspace, Delete, selection deletion and marks need no change thanks to decision 1. Arrow keys step over the element because the browser treats a `contenteditable=false` inline as one unit; if a browser places the caret inside it, `readSelection` snaps the offset to the nearer side.

## Risks / Trade-offs

- [Browsers differ in caret behaviour around non-editable inlines] → snapping in `readSelection`/`positionOf`, and a headless check of arrows and Backspace around a mention.
- [A copied mention pasted as plain text becomes U+FFFC] → paste strips U+FFFC from plain text until rich paste exists.
