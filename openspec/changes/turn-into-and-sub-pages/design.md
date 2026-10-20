## Context

The slash menu already changes a block's type (`slashCommand` in `src/editor/commands.ts`): it updates `type` and `props` and keeps the text, except that Code drops marks and moves the block's children out after it, since code can't hold children. The block handle (from `block-selection`) opens a `Menu` with Delete, Duplicate, Move up, Move down and Copy over the selected blocks.

Sub-pages are page blocks inside a page's content. Edit batches may not insert or delete them (`checkPageEdit` in `src/domain/blocks/page-edit.ts`): pages are made by the sidebar's new-page dialog (top-level only) and by agents (`create_page` with `parent`). A sub-page is browsable at `/pages/:id` when its root page belongs to the workspace or a project (`browsableScope`); under a task body or a comment it isn't. Block deletes are hard deletes, so a deleted block can be inserted again with the same ID (undo and redo rely on this).

## Goals / Non-Goals

**Goals:**
- Change the type of one or many blocks from the handle and the keyboard, as one undo step, with the slash menu's rules.
- Create a sub-page from the editor and land in it, ready to type its title, with undo working before leaving.

**Non-Goals:** see the proposal (turning a block into a page, tables and dividers, `/page` in task bodies and comments, "Move to").

## Decisions

### 1. One type-change rule for the slash menu and "Turn into"

The type-change part of `slashCommand` becomes `changeType(state, id, change, content)` in `commands.ts`, returning the operations for one block (with Code's plain text and children moved out). `slashCommand` calls it after removing the `/query` text; a new `turnInto(state, ids, change)` calls it for each block in order, applying each block's operations to a working state before the next, so a code conversion's moved children are where the next block expects them. Only text blocks other than table cells and the title change; others are skipped. The batch is one undo step; the selection stays as it was (caret, range or block selection).

Which blocks: the selected roots in a block selection (not their children, as Notion does); with text selected across blocks, every text block from the range's start to its end; otherwise the caret's block.

### 2. A submenu by reopening the menu

`Menu` has flat options. A `HandleMenuItem` gains an optional `items`: choosing "Turn into" closes the menu and reopens it at the same handle with the type list (the slash menu's type commands, in its order, with "✓ " before the current type when every changed block has it). Escape closes it; focus returns to the editor as for other handle commands.

*Alternative:* listing the types inline in the handle menu. Rejected: fourteen more items in a menu of five.

### 3. Shortcuts: Cmd/Ctrl+Shift+digit

`Cmd/Ctrl+Shift+0`–`8`, matched by `event.code` (`Digit0`…), since Shift changes `event.key` to symbols that differ per layout: 0 Text, 1–3 Heading 1–3, 4 To-do, 5 Bulleted list, 6 Numbered list, 7 Toggle, 8 Code. They work with the caret in a block, over a text range and over selected blocks.

*Alternative:* Notion's Cmd/Ctrl+Alt+digit. Rejected: on Windows, Ctrl+Alt is AltGr, which types characters on many layouts (on Spanish and German keyboards AltGr+2 is `@`, AltGr+3 is `#`, AltGr+7 is `{`), so typing a mention would turn a block into a heading.

### 4. `/page` creates the sub-page through an edit

A `page` slash action: like Table, it replaces an empty block (or follows a block with text, after removing the `/query` text) with `{ type: "page", content: [] }` and a fresh ID. The caret goes to the end of the text block before it (or the block it followed); the editor then flushes the save queue, waits for it to be idle, and navigates to `/pages/:id` if nothing failed, so the page exists when it opens. (Navigating at once and leaving it to the leave guard raced with the route data re-read of decision 5 in Firefox, which dropped the navigation.)

The server accepts this because `checkPageEdit` gains an option `subPages` (true for the page and project surfaces, false for tasks and comments): with it, inserting a `page` block is allowed where any block may go, holding only its title; and deleting a sub-page is allowed when `isEmptyPage(id)` says it has no blocks of its own, which `applyEdit` answers from the block service. That delete is what undoing a `/page` sends. A sub-page with content still can't be deleted through an edit, nor can a block containing one; the editor's own commands never delete sub-pages (they're kept by Backspace and block deletion), so only undo sends such a delete.

*Alternative:* a separate "create sub-page" endpoint called by the editor. Rejected: the creation wouldn't be in the editor's undo history, and the page's content would change behind the editor's state.

The slash menu offers Page only where `subPages` holds; the `Editor` gets it as an option and passes it to the command filter.

### 5. The sidebar follows

The save queue's `send` already re-reads the route data after a batch that changes the title. It does the same after a batch that inserts or deletes a page block, so the sidebar and the parent's links show the new page (or stop showing an undone one).

### 6. The caret in a new page's title

When a page editor opens on a page whose title is empty and which has no blocks, the caret goes to the title. A page made by `/page` is exactly that; so is a page whose title and content were cleared, which is fine.

## Risks / Trade-offs

- [Undo after content was added in the sub-page elsewhere] → The delete is refused, the editor shows the usual "couldn't be saved, the page was reloaded" message, and the sub-page stays. Only reachable by keeping the parent open in another tab; accepted.
- [Cmd/Ctrl+Shift+digit collides with something] → Browsers don't bind these in pages; Windows' Ctrl+Shift+0 (input language switch) is off by default.
- [An untitled sub-page left behind when someone types nothing] → It shows as "Untitled" like any other; deleting it is the page screen's delete. Accepted.
