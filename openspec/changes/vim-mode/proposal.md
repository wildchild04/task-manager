## Why

Writing in the editor means reaching for arrow keys, Home/End and the mouse to move and change text. For someone who edits code in Vim all day, that is the slow part of taking notes and writing task descriptions. An optional Vim mode lets the same hands-on-the-home-row editing work in pages, without changing the editor for anyone who leaves it off.

## What Changes

- **A Vim mode setting**: a toggle in the app header, next to the theme toggle, remembered per browser in a cookie like the theme. It is offered only on desktop browsers (`(hover: hover) and (pointer: fine)`); elsewhere it is hidden and Vim mode is off even when the cookie says on.
- **Modes**: Normal, Insert and Visual (characterwise), shown in a small mode indicator. With Vim mode on, the editor starts in Normal mode; clicking into text keeps the current mode.
- **Normal mode**: the caret is drawn as a block cursor over the character it is on, and typed text never reaches the page (IME composition started in Normal mode is cancelled).
  - Counts before motions and operators (`3w`, `2dd`).
  - Motions: `h j k l`, `w b e`, `0 ^ $`, `gg G`. `j`/`k` move by visual line and between blocks like ↓/↑ do today: keeping the column, moving by column in tables, and stopping at images, which are selected whole.
  - Entering Insert: `i a I A o O`.
  - Operators: `x`, `dd`, `dw`, `d$`, `cw`, `cc`, `yy`, `p`, `P`. `dd`/`yy` act on whole blocks, as one undo step, and `p`/`P` paste them after/before the cursor's block.
  - `u` and `Ctrl-r` undo and redo.
- **Visual mode** (`v`): the motions extend a text selection, within a block or across blocks; `d`/`x`, `c` and `y` act on it; `Esc` returns to Normal.
- **Leader key, Space**: in Normal mode, Space followed within one second by
  - `/` opens the slash menu at the cursor and enters Insert, as if `/` had been typed;
  - `@` opens the page mention menu the same way;
  - `Esc` selects the cursor's block (what `Esc` does today without Vim mode).
  Space with nothing after it does nothing.
- **`Esc` is Vim's**: it leaves Insert or Visual for Normal, and does nothing in Normal. In Insert, an open slash menu, mention menu, link card or formatting bar closes first, then a second `Esc` leaves Insert.
- **Insert mode is today's editor**: typing, Enter, Backspace, Tab, markdown shortcuts, `/` and `@` menus all behave as without Vim mode.
- **Shortcuts with Ctrl/Cmd** (bold, italic, links, turn into, select all, undo) work in every mode.
- With Vim mode off, nothing about the editor changes.

## Capabilities

### New Capabilities
- `vim-mode`: the setting and where it is offered, the modes and the mode indicator, the block cursor, Normal-mode motions, counts and operators, Visual mode, the leader key, and how Vim keys share the editor with menus and block selection.

### Modified Capabilities
- `block-editor`: "Block selection": with Vim mode on, `Esc` no longer selects the caret's block; `<leader> Esc` does.

## Non-goals

- Mobile and tablet browsers: Vim mode is desktop-only.
- Dot repeat (`.`), text objects (`ciw`, `di"`), named registers, Visual line and block modes, marks, macros, search (`/` in Normal mode is not Vim's search), ex commands (`:w`, `:s`), and remapping keys. Some of these can follow in a second change.
- Vim mode in the title field, comment drafts and other text inputs: only page and task-description editors get it.
- Syncing the setting across browsers.

## External dependencies

None. The toggle uses the design system's `Switch` (or `IconButton`) and the mode indicator its `Chip`; no new components or packages.

## Impact

- `src/editor/vim.ts` (new): the Vim state machine (mode, count, pending operator, leader timeout) and pure motions over the editor state, returning editor commands; covered by Vitest key by key.
- `src/editor/editor.ts`: small additions the operators need (deleting to a motion's end, yanking blocks into an in-memory register).
- `app/editor/page-editor.tsx`: routes keys to Vim mode when it's on, blocks input in Normal mode, draws the block cursor and the mode indicator, and moves today's `Esc` behind the leader.
- `app/editor/dom-caret.ts`: the block cursor's position, reusing the caret geometry helpers.
- `app/routes/shell.tsx`, `app/theme-mode.ts` (or a sibling `vim-setting.ts`), `app/root.tsx`: the toggle and its cookie.
- `app/app.css`: block cursor and mode indicator styles.
- Tests: Vitest for motions, operators, counts, the leader and modes; Playwright for the main flows in Chromium and Firefox.
