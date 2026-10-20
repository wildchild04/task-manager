## Context

Each block has a handle (`BlockHandle` in `app/editor/editor-blocks.tsx`) shown on hover in the left margin on desktop, and in a right-hand column on touch screens beside the caret's block and selected blocks; it opens a `Menu` and starts drags. The slash menu opens when `/` is typed at the start of a text block or after a space (`openMenuAt` in `page-editor.tsx`), filters on the text after it, and applies a `SlashCommand` that removes the `/query` text.

## Goals / Non-Goals

**Goals:** add a block of any type next to any block (including tables, dividers and sub-pages) in two clicks, reusing the slash menu.

**Non-Goals:** see the proposal.

## Decisions

### 1. The new block holds a `/`, and the slash menu opens on it

`addBlock(state, id, side, newId)` in `commands.ts`: an empty paragraph holding `/`, inserted after (or before) block `id` at its level, with the caret after the `/`. For an empty paragraph without children, it puts `/` into that block instead. The page editor then opens the slash menu at offset 0 of that block, exactly as if `/` had been typed. Every slash behaviour — filtering, paging, Escape keeping the text, commands replacing an empty block — comes for free and stays consistent.

*Alternative:* a separate type picker that inserts the chosen block directly. Rejected: a second menu listing the same commands with different rules.

The block that "+" sits beside is the block's handle's: for a table, the table (the new block goes after the whole table); for a block inside a toggle, the new block is a sibling inside the toggle.

### 2. Where the "+" goes

On desktop, `.block-add` sits left of the grip (`left: -58px`, `-78px` for list items), shown and hidden with it. The page's 28px margin only had room for the grip (the sidebar covered the "+"), so on fine pointers `.page-editor` gets a 32px left gutter, title included so it stays aligned with the blocks. On coarse pointers the right-hand handle column holds one button, so the "+" isn't shown; "Add below" in the handle menu covers touch screens and keyboard users. The button is an `IconButton` (`add`, size small, label "Add a block below (Alt+click: above)"), `contentEditable={false}` and keeping focus where it is on mousedown, like the grip.

### 3. One undo step, then the command's own

Adding the block runs as one command. Choosing a command is a second step, so one Cmd/Ctrl+Z turns the block back into the `/` paragraph and a second removes it — the same as typing `/` in a fresh block.

## Risks / Trade-offs

- [A stray `/` paragraph left when the menu is dismissed] → Same as typing `/` and pressing Escape today; one Backspace or Cmd/Ctrl+Z removes it.
- [The left margin is tighter with two buttons] → 56px at the top level fits the page's padding on desktop; nested blocks have their indentation to spare.
