## Why

Pages can't hold images: screenshots, photos and diagrams have nowhere to go, and Markdown with `![alt](src)` (pasted READMEs, agents' writes) is kept as literal text with a warning. Images are the last item on the "Block editor v1" exploration, and they need somewhere to keep files first. That storage should be swappable: files on the homelab's disk now, a CDN or object store later, without touching the editor or the block model.

## What Changes

- **A content repository**: a domain port for storing and serving binary content (`put`, `get`, `delete`, and the URL a stored item is served from), with a file-system implementation under the data folder (`data/content/`, so the existing Docker volume and backups cover it) and an in-memory one for tests. It's chosen in the composition module, like the other repositories; a CDN-backed implementation can replace it later without other changes. Items are content-addressed (named by a hash of their bytes), so they never change and can be cached forever, and the same image uploaded twice is stored once.
- **Uploading and serving**: `POST /api/content` takes one image (PNG, JPEG, GIF or WebP, checked by its bytes, at most 10 MB) and answers with its ID and URL; `GET /content/:id` serves it with its type, `nosniff` and a year-long immutable cache. SVG and other types are refused.
- **An `image` block**: shows either an uploaded image (by content ID) or an image from an external `http(s)` URL, with alt text. It's a block without text of its own, like a divider: selectable, movable, duplicable and deletable as any block.
- **Adding images in the editor**: an "Image" command in the slash menu (opens the file picker, or the camera on phones), pasting an image (a screenshot, a copied image), and dropping image files onto the page. While uploading, the page says so; a refused file says why. The block handle menu gains "Alt text…".
- **Read-only pages** show images with the design system's `Image` (lazy loading, its error state for a broken external URL).
- **Markdown**: `![alt](src)` becomes an image block (an uploaded image's URL becomes its content ID; other `http(s)` URLs stay external), and image blocks are written back as `![alt](url)`. So pasted Markdown and HTML (`<img>`) with images keep them, copying keeps them, and agents read and write images by URL. Images are no longer "unsupported" in the Markdown guide.

## Capabilities

### New Capabilities
- `content-storage`: the content repository port and its file-system implementation, uploading, serving, and limits.

### Modified Capabilities
- `block-tree`: the `image` block type and its props.
- `block-editor`: adding images (slash command, paste, drop), uploads in progress and refused, alt text.
- `page-viewer`: rendering image blocks.
- `agent-api`: images in Markdown conversion and in the Markdown guide.

## Non-goals

- Agents uploading images (an agent API function and MCP tool taking a file): a follow-up. Agents use URLs, including those of images already uploaded.
- Copying external images into the repository (server-side fetching of arbitrary URLs).
- Removing stored files no block uses any more (they stay; undo, other pages and copies may still need them). A later cleanup can find them by scanning image blocks.
- Captions, resizing, alignment, galleries, and image editing.
- Other files (PDFs, attachments) and SVG.
- A CDN implementation of the content repository (the port is shaped for it; the implementation comes when there's a provider).

## External dependencies

None: the design system's `Image` renders images, and the file picker is the browser's own.

## Impact

- `src/domain/content/` (new): the `ContentRepository` port, content types and limits, type detection from bytes.
- `src/infra/fs/` (new): the file-system content repository; `src/infra/memory/`: the in-memory one; `src/composition.ts`: choosing it (`CONTENT_PATH`, default `data/content`).
- `app/routes/api.content.ts` and `app/routes/content.ts` (new) for uploading and serving; `app/routes.ts`.
- `src/domain/blocks/types.ts`, `schema.ts`, `markdown.ts`; `src/editor/` (block behaviour, insert command); `app/editor/` (slash command, paste, drop, upload, image block); `app/blocks/` (view model and rendering).
- `docker-compose.yml` needs nothing new (`data/` is already a volume); the homelab backup should include `data/content/`.
