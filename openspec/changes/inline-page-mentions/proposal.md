## Why

Links can point at web pages, but there is no good way to point at another page of the workspace from inside a sentence. Typing `/pages/<id>` as a link works but is a plain URL: its text doesn't follow renames, it opens in a new tab, and a deleted page silently leads to "not found". Reference blocks do resolve properly, but they take a whole line. Notion's answer is the inline mention: type `@`, pick a page, and the sentence shows that page's current title, linked, and marked when the page is gone.

## What Changes

- **Mentions in rich text:** a new kind of span that points at a page by ID instead of holding text. It counts as one character, so splitting, merging, deleting and undo treat it as a single unit. It is allowed in block text, not in page titles.
- **Rendering:** a mention shows the page's current title as a link that opens the page in the app (same tab). A mention of a deleted page shows as a missing page. Read-only views and the editor render it the same way.
- **`@` menu in the editor:** typing `@` at the start of a block or after a space opens the design system's `InlineCommandMenu` with the workspace's pages (workspace pages and library documents, with their project), filtered as you type, five per page with the same keys as the slash menu. Enter inserts the mention followed by a space; Escape closes and keeps the text.
- **Page search** for the menu: a small endpoint returning pages whose title matches, with the page's place (project and parent) to tell same-named pages apart.

## Capabilities

### New Capabilities
- (none)

### Modified Capabilities
- `block-tree`: rich text may contain page mention spans; their target must exist when written; not allowed in page titles.
- `page-viewer`: mentions render as links to the page's current title, or as missing.
- `block-editor`: the `@` menu inserts mentions; mentions behave as one character when editing.

## Non-goals

- Mentioning tasks, blocks, comments, people or dates (pages only for now; tasks are the likely next kind).
- Listing mentions as incoming references ("what mentions this page") and counting them as task references.
- Turning existing `/pages/<id>` links into mentions.
- Mentions in comments (comments are edited with plain text until `comment-editor`).

## External dependencies

None: `InlineCommandMenu` is in `@wildchild/design-system` v0.5.0.

## Prerequisites

- `block-editor-v0` (applied and archived): the editor, its slash menu and the `block-editor` capability this change extends.

## Impact

- `src/domain/blocks`: rich-text schema and validation (mention spans, target check, not in titles); `plainText` renders a mention as `@` followed by nothing (titles can't hold mentions).
- `src/editor`: rich-text helpers keep mention spans whole; a `mention` command.
- `app/blocks` and `app/editor`: mention rendering (read-only and editable), the `@` menu, caret handling around the non-editable mention element.
- A `/api/pages` resource route for page search.
- No database migration: mentions live inside the existing content JSON.
