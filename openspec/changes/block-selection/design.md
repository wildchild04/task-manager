## Context

The editor has one `contenteditable` per text block (block-editor-v0, decision 1). Its selection is `{ blockId, anchor, focus }` inside one block; v0 left selections across blocks "to the browser", and `paste-and-copy` copies one by reading the DOM selection's two ends (`selectedTrees`). Every edit is a command returning a batch of `insert`/`update`/`move`/`delete` plus the next selection; `Editor.run` applies it, records its inverse as one undo step and queues it for saving. The server accepts any batch that stays inside the page's own content, except deleting a sub-page, inserting a page, or inserting into, changing or deleting a suggestion (moving a suggestion whole is allowed).

Checked in Chromium (Playwright, 2026-10-20) with two sibling `contenteditable` spans:
- A mouse drag starting in one block, and Shift+↓ from its last line, stay inside that block: Chromium confines a user selection to its editing host.
- `selection.setBaseAndExtent(a, 3, b, 6)` from script crosses blocks; both parts are painted, and the `Range` spans `a` to `b`. Only `Selection.toString()` is clipped to the first block.
- With such a selection, keys and `beforeinput` arrive at the first block only, and the browser's default would edit only the first block's part.

So a cross-block selection has to be driven and edited by the editor; the browser can only paint it.

## Goals / Non-Goals

**Goals:**
- Select text across blocks with the mouse and keyboard, and replace, delete, cut and copy it as one undo step.
- Select whole blocks, and delete, copy, cut, paste over, duplicate, move and nest them, by keyboard, handle menu and drag.
- Keep the logic in `src/editor/`, tested without a browser; the DOM layer only reads gestures and draws.

**Non-Goals:** see the proposal (turn into, `/page`, cell rectangles, rubber-band, touch dragging, cross-page drops).

## Decisions

### 1. Three selection states, one at a time

`Editor` keeps `selection: Selection` as today (caret or text inside one block; every existing command still takes it) and gains two optional states:

```ts
type Point = { blockId: string; offset: number };              // already in clipboard.ts; moves to editor-state.ts
type TextRange = { anchor: Point; focus: Point };              // anchor and focus in different blocks
type BlockRange = { anchor: string; focus: string };           // block IDs; the run between them is selected
```

`editor.range` and `editor.blocks` are `null` unless that mode is active; at most one is set. While one is set, `selection` holds the caret the mode returns to (the range's focus, collapsed; the last selected block's end). Setting a caret clears both.

*Alternative:* one union type `Selection | TextRange | BlockRange` everywhere. Rejected: thirty commands and the DOM glue take an in-block selection and have no meaning for the other two; a union would make each of them check and refuse.

History entries record a `SelectionSnapshot = { selection, range?, blocks? }` for `before` and `after`, so undoing a block delete selects the restored blocks again, and undoing a range replacement restores the range.

### 2. Which blocks a block range covers

`selectableOrder(state, closed)`: the page's blocks in reading order, each block a stop, including non-text blocks (dividers, sub-pages, references, suggestions as a whole); skipping table rows and cells (the table is the stop), the blocks inside a suggestion, and the children of closed toggles. A `BlockRange` covers the stops from `anchor` to `focus` in that order. `selectedRoots(state, range, closed)` is the covered blocks whose parent is not covered, in order: the blocks that commands act on. A covered parent implies its children, so selecting a toggle and pressing Backspace removes its children too.

Escape in a cell selects its table. Shift+↓ from the last stop, or ↑ from the first, does nothing.

### 3. Replacing a text range

`replaceRange(state, range, closed)` in a new `src/editor/selection.ts` returns a `CommandResult` that removes the range and leaves the caret where it was:
1. Order the ends by `documentOrder`. An end inside a table is moved to the table's edge (the table is removed whole), as `selectedTrees` takes it whole.
2. The first block keeps its text before the start; the last text block's text after the end is appended to it (the marks around the join kept), unless the first block is a table or the title. Code keeps plain text: joining into or from code follows the Backspace merge rule (only text, no marks into code).
3. Blocks fully inside the range are deleted, except *kept* blocks: sub-pages, suggestions and blocks that contain either. Kept blocks stay where they are with everything inside them.
4. Blocks after the range whose parent was deleted (the last block's children; the rest of a toggle the range ended in) move under the first block, after its own children, as Backspace's merge moves children today. If the first block can't have children (code, a cell), they move after it as its siblings, or after its table.
5. The caret goes to the join.

The title never takes part: a range starting in the title is not extended into blocks (the title stays a plain field).

Editing over a range composes `replaceRange` with the existing in-block command on the resulting state, concatenated into one batch, so it is one `run` and one undo step: `type` (then the Markdown shortcut check, as today), `enter`, `lineBreak`, `paste`, and `deleteBackward`/`deleteForward` (which are just `replaceRange`). Typing over a range never merges with earlier typing in undo.

*Alternative:* turn every cross-block drag into a block selection, as some editors do. Rejected: the v1 list asks for selecting across blocks, and partial first and last blocks are already what copying produces.

### 4. Block commands

In `selection.ts`, each taking `(state, roots, …)` and returning a `CommandResult` whose `selection` snapshot keeps the affected blocks selected:
- `deleteBlocks`: deletes every root that isn't kept (decision 3's rule), children first so inverses stay simple. The caret goes to the end of the text block before the first deleted root, or the start of the one after, or a new empty paragraph when the page is left empty. Kept roots stay selected.
- `duplicateBlocks`: inserts copies of the roots, with their subtrees and new IDs, after the last root; sub-pages and suggestions are left out of the copy; the copies become the selection.
- `moveBlocks(roots, step)`: Cmd/Ctrl+Shift+↑/↓. The roots must be siblings (a run of one parent's children); the run moves before its previous sibling or after its next sibling. At the parent's edge it moves out to the grandparent (before or after the parent), as Notion does; at the page's edge nothing happens. Non-sibling roots: refused.
- `dropBlocks(roots, target)`: target is `{ parentId, afterId }`; roots move there in order. Refused into a root's own subtree, into a table, row or cell, into a suggestion, or into a block that can't have children.
- `nestBlocks` / `unnestBlocks`: Tab and Shift+Tab over sibling roots, applying the existing indent and outdent rules to the run as a whole (all go under the previous sibling of the first; all move out after their parent).
- Moving the caret's block: `moveBlocks([caretBlock], step)`; in a cell, `tables.moveRow`.

Copy and cut of a block selection use `selectedTrees` with the roots taken whole (a new `blockTrees(state, roots)`), the same two clipboard formats as `paste-and-copy`. Cut is copy then `deleteBlocks`. Paste over a block selection deletes the roots and inserts the pasted blocks at the first root's place, as one batch; kept roots stay, the pasted blocks go before them.

### 5. Driving a cross-block selection in the DOM

`dom-caret.ts` gains `readRange()` (anchor and focus in different editable blocks → `TextRange`, else `null`), `writeRange(root, range)` (`setBaseAndExtent` between the two DOM positions; focus stays in the anchor's block), and `pointAt(x, y)` (`caretPositionFromPoint`, falling back to `caretRangeFromPoint`, mapped to a `Point` when it lands in an editable block).

`page-editor.tsx`:
- **Drag:** on `pointerdown` in an editable block, remember the anchor point. On `pointermove` with the primary button held: when `pointAt` is in another block, `writeRange` from the anchor to it and prevent the default; back in the anchor block, let the browser select natively again. Auto-scroll when the pointer nears the viewport's top or bottom edge.
- **Shift+click:** on `pointerdown` with Shift in another block than the selection's anchor, prevent the default and `writeRange` from the current anchor to the clicked point.
- **Shift+Arrow:** Shift+↑ on a block's first line (Shift+← at offset 0) or Shift+↓ on its last line (Shift+→ at its end) moves the range's focus into the neighbouring text block (at the goal x for ↑/↓, as plain arrows do), via `writeRange`. Within a block, the browser extends natively.
- `selectionchange` reads `readRange()` first, then `readSelection()`, and updates the editor.
- `keydown` and `beforeinput` check `editor.range` before anything else: printable input, Enter, Backspace, Delete, `deleteByCut` and paste go to the range commands; arrows without Shift collapse the range to its start (←, ↑) or end (→, ↓); Escape turns it into a block selection of the blocks it touches.
- **Composition** over a range: `compositionstart` first applies `replaceRange` (its own undo step) and puts the caret at the join, then composition runs in that block as today.
- **Cut:** a `cut` event handler writes what `copy` writes, then runs the range or block deletion. In one block, cut keeps the browser's text plus the app format, as copy does, and deletes through `deleteByCut` as today.

### 6. Block selection in the DOM

Block mode moves focus to the editor's root element (`tabIndex={-1}`, `role="group"`, `aria-label` "Page content"), so no text block shows a caret and keys arrive in one place. The DOM selection is cleared. Selected blocks get `data-selected` and a `secondaryContainer` background with rounded corners; a polite live region says "N blocks selected".

Keys in block mode: Escape clears; ↑/↓ select the previous/next stop; Shift+↑/↓ extend; Backspace/Delete delete; Cmd/Ctrl+C/X/V/D/A; Cmd/Ctrl+Shift+↑/↓ move; Tab/Shift+Tab nest; Enter puts the caret at the end of the last selected text block (or the first text block after); Cmd/Ctrl+Z undoes as anywhere. Printable keys are ignored. A click in text or outside the editor leaves block mode.

Escape in a text block selects it, unless a menu, the link dialog or the link card is open (they keep Escape). Cmd/Ctrl+A in a block selects its whole text first; when it already is, every stop of the page.

### 7. The handle and dragging

Every top-level and nested block in `EditorBlocks` gets a gutter handle (`IconButton`, `drag_indicator`, size small, `aria-label` "Drag to move, or open block actions"), shown on pointer hover of the block's row and while its block is selected or holds the caret on coarse pointers (`@media (pointer: coarse)`). Rows and cells of tables, the blocks inside suggestions and the title have none. Comment editors don't render handles (their blocks are short and the space is tight); keyboard block selection works there too.

A click (pointerup without moving more than 4px) selects the block — or keeps a block selection it's part of — and opens the `Menu`: Delete, Duplicate, Move up, Move down, Copy. Items that would do nothing (Move up on the first block) are disabled.

Dragging (pointer events in a new `app/editor/block-drag.ts`, not HTML5 drag and drop, which can't style the drop line and behaves differently per browser): after 4px of movement the dragged roots are the selection if the handle's block is in it, else that block alone (which becomes the selection). The rows dim to 50%; a 2px `secondary` line shows the drop target: before or after the block under the pointer, at that block's nesting level, computed from block rectangles each frame. Pointing at the right part of a block that can take children, past its text start plus 48px, targets "inside, as its first child" and indents the line. Invalid targets (decision 4) show no line. Drop runs `dropBlocks` (one undo step); Escape or a drop outside the editor cancels. The page scrolls when the pointer is near the viewport edge.

### 8. Menu and handle components

`Menu` and `IconButton` exist. The `Icon` catalog has no grip glyph, so `drag-indicator-icon.md` is requested; until it ships, `IconButton` gets a local six-dot SVG as children (as the notification bell did).

## Risks / Trade-offs

- [Chromium changes how it confines selections] → The editor never depends on the browser crossing blocks by itself; it only relies on `setBaseAndExtent` crossing, which the platform has allowed for years. The headless check covers the drag in Chromium, Firefox and WebKit.
- [IME over a range] → Committed as two undo steps (removal, then the composed text). Accepted; composition can't be cancelled.
- [Kept blocks inside a deletion surprise people: a sub-page stays after Backspace over a range] → It's the existing rule (Backspace never deletes a sub-page), and the alternative is a refused batch. The kept blocks stay selected, so it's visible.
- [Large selections] → One batch per action; the save queue already sends large batches at once. Duplicating a big toggle is a few hundred inserts at most on these pages.
- [Pointer dragging and text selection interfere] → The handle sits outside the editable text (`contentEditable={false}`, `user-select: none`), and the drag calls `preventDefault` on `pointerdown`.

## Open Questions

- Should paste over a block selection insert after it instead of replacing it? Replacing matches text editors and Notion; the decision can be revisited after use.
