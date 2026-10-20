## Why

The editor works on one block at a time. A selection can't really cross blocks: Chromium keeps a drag or Shift+Arrow inside the block it started in, and when a selection does span blocks (set from a copy, or in Firefox), typing, Backspace or a cut only change the first block. Whole blocks can't be selected, deleted, duplicated or moved at all; reordering a page means retyping it. These are the next items on the "Block editor v1" exploration: deleting blocks, selecting across blocks, and block selection with a drag handle. `markdown-blocks` and `paste-and-copy` both left their selection parts to this change.

## What Changes

- **Text selection across blocks.** Dragging, Shift+Arrow at a block's edge and Shift+click extend the selection into other blocks. Typing, Enter, Backspace, Delete, paste and cut over it replace the selected text: the first block keeps its text before the selection, the last block's text after it joins on, and the blocks between are removed. One undo step.
- **Cut across blocks.** Cut puts the same clipboard content as copy and removes the selection.
- **Cmd/Ctrl+A** selects the block's text, and pressed again, every block of the page.
- **Block selection.** Escape in a block, or clicking a block's handle, selects the whole block; Shift+↑/↓ and Shift+click extend the selection to neighbouring blocks; ↑/↓ move it; Escape or a click in text leaves it. Selected blocks are highlighted.
- **Acting on selected blocks**, each one undo step: Backspace or Delete removes them; Cmd/Ctrl+C and X copy and cut them (the `paste-and-copy` formats); paste replaces them; Cmd/Ctrl+D duplicates them; Cmd/Ctrl+Shift+↑/↓ moves them; Tab and Shift+Tab nest and un-nest them; Enter goes back to editing at the end of the last one. Sub-pages and suggestions are never deleted or duplicated this way (the server refuses both), and blocks containing them stay.
- **Moving the caret's block.** With the caret in a block, Cmd/Ctrl+Shift+↑/↓ moves that block; in a table cell it moves the row.
- **Drag handle.** Pointing at a block shows a handle beside it. Dragging the handle moves the block, or all selected blocks, to where a drop line shows. Clicking it selects the block and opens a menu: Delete, Duplicate, Move up, Move down, Copy. On touch screens the handle shows beside the block with the caret, and the menu's Move up and Move down stand in for dragging.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `block-editor`: selecting text across blocks and editing over it; cutting; select all; block selection, with deleting, copying, cutting, pasting over, duplicating, moving and nesting selected blocks; moving the caret's block; the drag handle and its menu; undo restoring block selections. Copying a block selection is added to "Copying keeps structure".

## Non-goals

- A "Turn into" command, and a `/page` command for sub-pages (next v1 changes; the handle menu will host "Turn into").
- The inline edit bar and the small add-block bar (prototypes on the v1 list).
- Selecting a rectangle of table cells. A whole table is selected, copied, moved and deleted as a block; inside a table, selection stays within one cell.
- Rubber-band selection (dragging from empty space around blocks to select them), and Cmd/Ctrl+click to add separate blocks to a selection: a block selection is always a run of consecutive blocks.
- Dropping blocks onto another page in the sidebar, or between pages.
- Dragging on touch screens.
- Deleting sub-pages from the editor (they stay protected, as today; deleting pages is the page screens' job).

## External dependencies

Design-system feature request in `~/dev/design-system/feature-requests/`:
- **`drag-indicator-icon.md`**: a `drag_indicator` glyph (the six-dot grip) in the `Icon` catalog, for the block handle in an `IconButton`. Until it ships, the app passes a local six-dot SVG as `IconButton`'s children.

The handle menu uses the existing `Menu`; the selection highlight and the drop line are drawn from design tokens (`secondaryContainer`, `secondary`).

## Impact

- `src/editor/`: the editor's selection gains a cross-block text range and a block selection (`editor-state.ts`, `editor.ts`, `history.ts`); a new `selection.ts` with range deletion, and block delete, duplicate, move and nest commands; `clipboard.ts` (trees for a block selection; paste over a range or selection); tests against the in-memory store.
- `app/editor/`: `page-editor.tsx` (extending selections across blocks, keys in block selection, cut, select all), `dom-caret.ts` (reading and writing a cross-block range), `editor-blocks.tsx` (handle, highlight, drop line), a new `block-drag.ts` for pointer dragging; CSS.
- No server, API or data changes: every action is a batch of existing operations, within the rules edit batches already follow.
