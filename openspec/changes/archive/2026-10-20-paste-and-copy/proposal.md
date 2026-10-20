## Why

Pasting into the editor types the clipboard's plain text into one block, so three paragraphs, a list, a table or a code sample from a README, GitHub or a chat land as one paragraph full of line breaks. And copying several blocks hands other apps (and the editor itself) the browser's flattened text, losing lists, tables and formatting. Now that tables, code blocks and callouts exist, pasting and copying should keep structure. Both are on the "Block editor v1" list.

## What Changes

- **Paste keeps structure.** Pasted Markdown and HTML (from web pages, GitHub, Google Docs, chats) become blocks: paragraphs, headings, lists, todos, quotes, dividers, tables, code blocks and callouts, with bold, italic, strikethrough, code and links. A paste that is one paragraph is inserted into the current block at the caret, keeping its marks. A paste into an empty paragraph replaces it; otherwise the current block is split at the caret and the pasted blocks go between. One paste is one undo step.
- **Paste in code blocks and table cells stays plain text**, line breaks kept.
- **Copy keeps structure.** Copying a selection that spans several blocks puts Markdown on the clipboard as plain text (lists, tables, code fences, marks), so it pastes well into other apps and back into the editor. Copying inside the app also carries an app-only format, so pasting back keeps mentions and links to pages exactly.

## Capabilities

### Modified Capabilities
- `block-editor`: pasting Markdown and HTML as blocks; copying across blocks as Markdown.

## Non-goals

- Cutting across blocks, and typing or deleting over a selection that spans blocks (the `block-selection` change).
- Pasting images or files; colours, fonts and other styling from HTML; merged table cells (they are flattened).
- A "paste as plain text" command: browsers don't tell Cmd/Ctrl+Shift+V apart from a normal paste.
- Pasting into the page title (stays plain text).

## External dependencies

None.

## Impact

- `src/editor/` (a paste command: splitting, inserting blocks, merging the first paragraph; the selected range as a block tree for copying), `app/editor/page-editor.tsx` (paste and copy events), a new `app/editor/clipboard.ts` (HTML to Markdown, clipboard formats); tests.
- Reuses `fromMarkdown` and `toMarkdown` from `src/domain/blocks/markdown.ts`.
