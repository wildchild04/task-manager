## Why

Adding a block between two others means putting the caret at the end of the first and pressing Enter, which makes a block of the same kind (another list item, another to-do) that then has to be turned into what's wanted; under a table, a divider or a sub-page there is no text to press Enter in at all. The "Block editor v1" exploration lists a small add-block bar: Notion's "+" beside each block, which adds a block below and offers every block type at once.

## What Changes

- A **"+" button** beside the block handle, shown with it. Clicking it adds an empty paragraph after the block, at its level, and opens the slash menu there; Alt/Option+click adds it before the block instead. When the block itself is an empty paragraph, it is used in place of a new one.
- Choosing a command turns the new block into that type (or makes a table, divider or sub-page), as typing `/` does. Escape closes the menu and leaves the `/`, as it does today.
- The handle menu gains **"Add below"**, doing the same, for keyboards and touch screens (where the "+" isn't shown, as the handle column has room for one button).
- Adding the block is one undo step; the slash command is its own.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `block-editor`: the "+" button and "Add below" in the block handle menu.

## Non-goals

- The inline edit bar (the other v1 prototype).
- A "+" between blocks on hover (Notion's line-between-blocks inserter), or at the end of the page (clicking below the last block already writes on there).
- Choosing a type before the block exists (a picker that inserts directly): the slash menu is that picker.

## External dependencies

None: `IconButton` with the existing `add` icon, and the existing slash menu.

## Impact

- `src/editor/commands.ts` (a command adding a paragraph holding `/` beside a block, or reusing an empty one), `src/editor/editor.ts`; tests.
- `app/editor/editor-blocks.tsx` (the "+" beside the grip), `app/editor/page-editor.tsx` (opening the slash menu on the new block; "Add below" in the handle menu), `app/app.css`.
