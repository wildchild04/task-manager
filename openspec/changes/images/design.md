## Context

Repositories are ports in `src/domain/` with SQLite and in-memory implementations in `src/infra/`, chosen only in `src/composition.ts`. The app serves only its build folder; everything else goes through React Router routes, behind Caddy at `/task-manager` on the homelab, with `./data` (the SQLite database) mounted as a Docker volume. Blocks are typed with per-type props schemas (`src/domain/blocks/schema.ts`); non-text blocks like dividers and sub-pages are leaves the caret steps over. Markdown conversion (`src/domain/blocks/markdown.ts`) serves agents, paste and copy; images are currently kept as text with a warning. The design system has an `Image` component (`src`, `alt`, aspect ratio, fit, lazy loading, an error state).

## Goals / Non-Goals

**Goals:**
- A storage port the rest of the app uses without knowing where bytes live, with a file-system implementation now and room for a CDN later.
- Images in pages from uploads (slash command, paste, drop) and from external URLs (Markdown, HTML paste, agents).
- Safe defaults: only raster images checked by their bytes, size-limited, served with types the browser can't reinterpret.

**Non-Goals:** see the proposal (agent uploads, fetching external images, orphan cleanup, captions and resizing, other file types, the CDN implementation).

## Decisions

### 1. The port

```ts
// src/domain/content/content.repository.ts
export type ContentType = "image/png" | "image/jpeg" | "image/gif" | "image/webp";
export type StoredContent = { id: string; type: ContentType; size: number };
export interface ContentRepository {
  /** Stores bytes of a known type; storing the same bytes again returns the same item. */
  put(bytes: Uint8Array, type: ContentType): Promise<StoredContent>;
  get(id: string): Promise<(StoredContent & { bytes: Uint8Array }) | undefined>;
  delete(id: string): Promise<void>;
  /** Where browsers load the item from: an app path for the file system, a CDN URL for a CDN. */
  url(id: string): string;
}
```

It's asynchronous (unlike the SQLite repositories) because a network-backed store will be. Only the content routes and the view models call it; block operations stay synchronous and only store IDs.

*Alternative:* store bytes in SQLite. Rejected: the database grows with every screenshot, backups get heavy, and it doesn't move to a CDN.

### 2. Content-addressed IDs

An ID is the SHA-256 of the bytes in hex plus the type's extension (`3f9a…c1.png`). The type is in the ID, so no metadata store is needed (a CDN key or a file name carries it); an item never changes, so it's served with `Cache-Control: public, max-age=31536000, immutable`; the same image pasted twice is stored once. IDs are validated against `/^[0-9a-f]{64}\.(png|jpg|gif|webp)$/` everywhere they're read (routes, block props), which also rules out path traversal.

### 3. What may be stored

`detectImageType(bytes)` in `src/domain/content/` reads the signature (PNG `89 50 4E 47`, JPEG `FF D8 FF`, GIF `GIF87a`/`GIF89a`, WebP `RIFF….WEBP`); the declared `Content-Type` is ignored. Limit 10 MB (`MAX_CONTENT_BYTES`), enforced while reading the request body. SVG and everything else are refused (`415`), too large is `413`.

### 4. File-system implementation

`src/infra/fs/fs-content.repository.ts`: root `CONTENT_PATH` (default `data/content`, i.e. `/app/data/content` in Docker, inside the existing volume). Items live at `<root>/<first two hex chars>/<id>` (keeps directories small); writes go to a temporary file renamed into place, so a crash never leaves half a file; `put` of an existing ID is a no-op. `url(id)` is the app path `${base}/content/<id>`, with the base path passed in by the composition module (domain code doesn't import `app/`). The in-memory implementation (`src/infra/memory/`) keeps a `Map` and the same URLs, for tests.

A CDN implementation later implements the same four methods (upload to the bucket, `url` returning the CDN address); the serving route then simply isn't used.

### 5. Routes

- `POST /api/content` (`app/routes/api.content.ts`): the body is the file's raw bytes (`fetch(url, { method: "POST", body: file })`), read up to the limit; answers `201 { id, url, type, size }`, or `413`/`415` with a message the editor shows.
- `GET /content/:id` (`app/routes/content.ts`): a resource route answering the bytes with `Content-Type` from the ID, `X-Content-Type-Options: nosniff`, `Content-Disposition: inline`, and the immutable cache header; `404` for unknown or malformed IDs.

Both run behind the same access as the rest of the app (the homelab's network); there's no separate auth to add.

### 6. The `image` block

`image` props: `{ contentId: string; alt: string }` or `{ url: string; alt: string }` (exactly one source; `url` must be `http:` or `https:`, at most 2 KB; `alt` at most 1,000 characters, default empty). No content; a leaf. In the editor it behaves like a sub-page block: not text, the caret steps over it (Backspace after it moves the caret to the text block before, and never deletes it), and it's selected, moved, duplicated (sharing the stored item) and deleted with the block-selection commands.

View models resolve the source to a `src`: `contentRepository.url(contentId)` or the external `url`. Read-only pages and the editor render the design system's `Image` (`aspectRatio="auto"`, `fit="contain"`, `loading="lazy"`), its error state covering a broken external URL, centred and at most the page's width.

### 7. Adding images in the editor

All three entry points end in `uploadImages(files, at)`: upload each file (in order, one request each), then insert the image blocks after the block `at` (replacing it when it's an empty paragraph) as one batch and one undo step, with the caret in the text block after them (a new empty paragraph if there's none).

- **Slash command "Image"**: removes the `/image` text (its own step, as other slash commands), then opens a hidden `<input type="file" accept="image/png,image/jpeg,image/gif,image/webp" multiple>`; on phones the system sheet offers the camera too. Cancelling the picker leaves the paragraph as it is.
- **Paste**: a clipboard with image files (a screenshot, a copied image) uploads them at the caret's block and ignores the clipboard's text and HTML (which usually just names or links the same image).
- **Drop**: image files dropped on the page go after the block under the pointer (before the first block when above it); dropping anything else does nothing.

While uploads run, the save indicator reads "Uploading image…" (and "Uploading 2 images…"); refused or failed files show an alert naming the file and why (too big, not a supported image, upload failed) and the others still go in. The block handle menu of an image gains "Alt text…", a dialog that updates `alt` (one step).

### 8. Markdown

- **Import**: a line that is only `![alt](src)` becomes an image block. A `src` naming an uploaded item (`…/content/<id>`, relative or absolute) becomes `contentId`; another `http(s)` URL becomes `url`; anything else (relative paths, `data:`) keeps the line as text with the warning `images need an http(s) URL or an uploaded image; kept as text`. An image inside a line of text is kept as text with a warning too (`images must be on a line of their own`).
- **Export**: `![alt](url)`, where an uploaded item's URL is made absolute for agents and other apps the way app links are (`plainReader.appLink`), and kept as the app path in the app-only clipboard format.
- **HTML paste**: `htmlToMarkdown` turns `<img src alt>` into `![alt](src)` on its own line, so web pages' and GitHub's images come along by URL.

## Risks / Trade-offs

- [Files no block uses accumulate] → Accepted for now (content-addressing limits duplicates); a later cleanup can list items no image block references. Deleting on block delete would break undo and shared copies.
- [External images break or track the reader] → They're the author's choice; the error state shows a broken one. Copying them in is a later option.
- [Large pastes on slow connections] → One request per file with a visible "Uploading…"; the edit only happens once the upload succeeds, so nothing half-inserted is saved.
- [Backups] → `data/content/` must be in the homelab backup alongside the database (the existing "Back up the homelab database" chore should copy the folder).
