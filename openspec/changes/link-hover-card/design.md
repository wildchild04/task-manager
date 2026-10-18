## Context

Editor links are `<a>` elements drawn by `renderRichText` outside React, inside `contenteditable` text. `HoverCard` (design system v0.5.2) takes a viewport rectangle, lets the caller own hover state through `onPointerEnter`/`onPointerLeave`, and never manages focus.

## Decisions

### 1. Hover state lives in the page editor
A `mouseover`/`mouseout` listener on the editor root tracks the hovered `a[href]` inside `.editable`. Opening waits 400 ms of rest on the link; leaving the link or the card starts a 200 ms close timer that entering either cancels. The card's state is `{ blockId, start, end, href, rect }`: the link's range comes from `linkRangeAt` at the offset of the hovered element, so actions act on the whole link even when it spans differently marked spans.

### 2. Destination text
- other origins: the full URL (truncated with an ellipsis in the card)
- `/pages/:id` on this origin: `title · place` from `/api/pages?id=` (cached per editor), or "A page that no longer exists"
- other app paths: the path

### 3. Actions reuse existing editor paths
- **Open**: the same navigation as clicking (React Router for app paths, new tab otherwise).
- **Edit**: sets the editor selection to the link's range and opens the existing link dialog with the link's href (which shows page links as `@Title`).
- **Remove**: `editor.setSelection(range)` then `editor.setLink(null)` (one undo step), then restores the caret to the end of the former link.

Buttons prevent default on `mousedown` so the text keeps focus and selection.

### 4. Closing
Escape and outside clicks come from `HoverCard`'s `onDismiss`; any `beforeinput` in the editor closes the card; scrolling closes it (the rect would be stale).

## Risks / Trade-offs

- [Touch devices have no hover] → links still open on tap and edit via selection + Ctrl+K; unchanged from today.
