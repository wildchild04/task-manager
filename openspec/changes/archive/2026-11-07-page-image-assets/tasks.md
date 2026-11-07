## 1. Content domain

- [x] 1.1 `imageSize(bytes, type)` in `src/domain/content/content.repository.ts`: width and height from PNG IHDR, GIF screen descriptor, JPEG SOF markers and WebP (VP8, VP8L, VP8X), `undefined` when unreadable; tests

## 2. Agent API

- [x] 2.1 `assets` on `readPage` and `readDescription`: uploaded image blocks in the whole tree (suggestion blocks included), document order, unique, `{ id, alt }`, left out when empty; tests
- [x] 2.2 `readPageAsset` and `readTaskAsset`: resolve the page or task, refuse an ID not used by the tree with `not_found` before touching storage, `missing` when the bytes are gone, answer `{ id, type, size, width?, height?, data }`; routes `GET page/:id/asset/:asset` and `GET task/:id/asset/:asset`, and the router awaits async handlers; tests in `tests/app/agent-api.test.ts`

## 3. MCP

- [x] 3.1 `read_page_asset` in `mcp/tools.ts` (`page` or `task`, and `asset`): MCP image content plus the metadata as text, API errors as tool errors; descriptions of `read_page` and `read_description` mention `assets`; `mcp/README.md`; `tests/mcp.test.ts`

## 4. Check

- [x] 4.1 Typecheck, unit tests and the Playwright suite
- [x] 4.2 Try it on the dev instance through `notion-tasks-dev`: upload an image to a page, `read_page`, then `read_page_asset`, and see the image
