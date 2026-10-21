## 1. Content storage

- [ ] 1.1 `src/domain/content/`: the `ContentRepository` port, `ContentType`, `MAX_CONTENT_BYTES`, `detectImageType(bytes)`, `contentIdOf(bytes, type)` and the ID check; tests (signatures, SVG refused, IDs)
- [ ] 1.2 `src/infra/fs/fs-content.repository.ts` (atomic writes, two-character folders, no-op re-put, `url` with the base path) and the in-memory repository; a shared contract test run against both
- [ ] 1.3 `src/composition.ts`: `content` in the services (`CONTENT_PATH`, default beside the database in `data/content`; in memory for tests)
- [ ] 1.4 Routes: `POST /api/content` (raw body read up to the limit, 201/413/415) and `GET /content/:id` (type, `nosniff`, immutable cache, 404); tests through the route modules

## 2. Image blocks

- [ ] 2.1 `image` in the block types and props schema (one source, `http(s)` URL, alt length), a leaf without content; validation tests
- [ ] 2.2 Markdown: whole-line `![alt](src)` to image blocks (content URL to `contentId`, `http(s)` to `url`, else text with a warning; inline images warned), export with absolute content URLs through the reader; `htmlToMarkdown` for `<img>`; the Markdown guide; tests
- [ ] 2.3 Read-only rendering: the view model's `src` from the content repository or URL; `Image` from the design system in `block-view.tsx`; tests

## 3. Editor

- [ ] 3.1 Block behaviour: image as a non-text leaf the caret steps over (Backspace keeps it); `insertImages(at, images)` command (replacing an empty paragraph, caret after, one step) and `setImageAlt`; editor tests
- [ ] 3.2 `app/editor/`: the image block (design-system `Image` in a `BlockFrame`), upload helper with progress count and per-file errors, slash command "Image" with a hidden file input, paste of image files, drop on the page, "Alt text…" in the handle menu with a dialog

## 4. Check

- [ ] 4.1 Headless check in Chromium and Firefox: slash command with a PNG, paste a PNG, drop two files, a too-big file, undo, Backspace after an image, alt text, an external image from pasted Markdown and its broken state, reading the page back as an agent; files on disk under the content folder; typecheck, unit tests and the Playwright suite
- [ ] 4.2 Note for the homelab backup: copy `data/content/` with the database (update the "Back up the homelab database" chore's description)
