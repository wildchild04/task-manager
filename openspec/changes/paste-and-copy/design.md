## Context

The editor handles input in `beforeinput`; a paste arrives as `insertFromPaste` and is typed into the current block as plain text. Each edit is a command returning operations and the new selection, applied as one undo step and saved as one batch. Selections spanning blocks are left to the browser. The Markdown converter (`src/domain/blocks/markdown.ts`) already turns Markdown into blocks and blocks into Markdown, including tables, code, callouts and mentions, and is plain TypeScript usable in the browser.

## Goals / Non-Goals

**Goals:** paste structure in, copy structure out, through the existing Markdown converter, as single undo steps.

**Non-Goals:** see the proposal (cross-block cut and typing, files, styling).

## Decisions

### 1. Everything goes through Markdown

Pasted HTML is converted to Markdown, then `fromMarkdown` builds the blocks; copied blocks become Markdown with `toMarkdown`. One converter for agents, paste and copy means one set of supported constructs, and what an agent can write is what a paste can produce.

*Alternative:* HTML straight to blocks. Rejected: a second parser with its own idea of lists, tables and marks.

### 2. Clipboard formats, in order of preference

On paste, read `clipboardData` in the `paste` event (it carries HTML, which `beforeinput` doesn't reliably expose):
1. `application/x-taskhub-markdown`: written by our own copy. Mentions and links use full IDs (`@[Title](page:<uuid>)`), so pasting within the app keeps them exactly.
2. `text/html`: from other apps, converted by `htmlToMarkdown` (below).
3. `text/plain`: read as Markdown. Plain prose without Markdown syntax comes out as paragraphs, so ordinary text is unaffected.

On copy, write `text/plain` (Markdown, mentions shown as `@Title` and app links as absolute URLs, readable anywhere) and `application/x-taskhub-markdown` (exact, with IDs).

### 3. HTML to Markdown

`htmlToMarkdown(root)` walks a parsed document (`DOMParser` in the browser) and handles: `p`, `div`, `br`, `h1`–`h6`, `ul`/`ol`/`li` (nesting, `input[type=checkbox]` as todos), `blockquote`, `hr`, `pre`/`code` (language from a `language-*` class), `table`/`tr`/`th`/`td` (first row as header), `strong`/`b`, `em`/`i`, `s`/`del`, `u`, `code`, `a[href]`. Everything else contributes its text. Google Docs' wrapping `<b style="font-weight:normal">` is treated as plain. The walker uses only `nodeType`, `nodeName`, `childNodes`, `textContent` and `getAttribute`, so tests run on hand-built trees without a DOM library.

### 4. Where pasted blocks go

With the caret in text block X at offset k (a selection inside X is deleted first):
- **One paragraph pasted** (also prose with line breaks): its rich text is inserted at the caret, marks kept. Same as typing, but with formatting.
- **X is an empty paragraph**: the pasted blocks replace X.
- **Otherwise**: X keeps its text before k; if the first pasted block is a paragraph, its content is appended to X; the remaining pasted blocks follow X as siblings (with their nesting); the text after k, if any, becomes a paragraph after them.
- The caret ends at the end of the last pasted text block.
- Pasted blocks never land inside a table or a code block: in a cell or code, paste is plain text typed at the caret (decision 5).

All of it is one command: one batch, one undo step.

*Alternative:* always insert after the current block. Rejected: pasting into the middle of a sentence would tear it apart in the wrong place.

### 5. Plain text in code, cells and the title

In a code block, a table cell or the page title, paste types the clipboard's plain text at the caret (line breaks kept, except in the title where they become spaces), as today.

### 6. Copying a range of blocks

On `copy`, read the DOM selection's anchor and focus blocks. Within one block: the browser's plain text stays as is, and the app format gets that span's inline Markdown (so a bold word pasted back stays bold). Across blocks: take every block from the start block to the end block in document order; the first and last text blocks contribute only their selected part; tables and code blocks are taken whole; a block's children come along when it's included. Build the tree (blocks whose parent isn't included are top level) and write both formats.

## Risks / Trade-offs

- [Text that looks like Markdown becomes structure: a pasted line starting with `- ` becomes a list item] → That's usually what was meant; undo restores the plain text paste? No: undo removes the paste. Accepted; there's no reliable "paste as plain text" signal.
- [HTML from rich editors is messy] → Unknown elements contribute their text; a test covers Google Docs and GitHub-style snippets.
- [Large pastes] → One batch; the save queue sends it at once. Fine at document sizes.
