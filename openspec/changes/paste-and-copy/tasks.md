## 1. Paste

- [ ] 1.1 `paste` command in `src/editor/`: insert a block tree at the selection (single paragraph inline with marks; replace an empty paragraph; split, join the first paragraph, insert the rest with nesting, tail as a paragraph); one undo step; editor tests against the in-memory store for the scenarios
- [ ] 1.2 `app/editor/clipboard.ts`: `htmlToMarkdown` over a minimal DOM interface (elements of design decision 3, Google Docs' wrapper, `language-*` classes, checkbox todos); tests on hand-built trees for GitHub-, Google Docs- and web-style snippets
- [ ] 1.3 `page-editor.tsx`: handle the `paste` event (app format, then HTML, then plain text as Markdown; plain text in code, cells and the title), using `fromMarkdown` with a writer that resolves full-ID mentions and links

## 2. Copy

- [ ] 2.1 The selected range as a block tree (`src/editor/`): start and end blocks in document order, partial first and last text blocks, tables and code whole, children included; tests
- [ ] 2.2 `page-editor.tsx`: handle `copy` (across blocks: Markdown as `text/plain` and the app format; within one block: the app format only); readers for both forms; tests for the Markdown produced

## 3. Check

- [ ] 3.1 Headless check: paste a GitHub README snippet (HTML), Markdown text with a table and code, and a copy from another page of the app (mention kept); copy a range and paste it into another page; undo each; typecheck and full test run
