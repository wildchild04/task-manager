## Context

The block editor is custom: the model (`src/editor/`) holds the page as blocks with plain-text offsets, and every edit is a command returning one batch and one undo step (`Editor.run`). `app/editor/page-editor.tsx` owns the DOM. One `keydown` listener on the editor root decides what each key does (`onKeyDown`, `onBlocksKey`, `onRangeKey`). `beforeinput` turns browser input into model edits. Selections are written back into the DOM (`writeSelection`, `writeRange`). Moving between blocks already works for ↑/↓ through `arrowStop` and `arriveAt`, keeping the column with `goalX`/`offsetAtX` and detecting edge lines with `offsetOnEdgeLine`. Block deletion, block copy and paste (`blockTrees`, `pasteBlocks`), text removal across blocks (`replaceRange`) and undo all exist.

Vim mode is desktop-only (no on-screen keyboards), opt-in per browser, and must not change anything with the setting off.

## Goals / Non-Goals

**Goals:**
- A Vim layer that decides what keys mean and reuses the editor's existing commands, so every operator is one undo step and saves like any other edit.
- Vim logic that can be tested without a DOM, key by key, like the existing editor tests.
- Zero behavior change with Vim mode off: the existing key paths run unchanged.

**Non-Goals:**
- See the proposal: dot repeat, text objects, registers beyond one unnamed register, Visual line/block, search, ex commands, mobile.

## Decisions

### 1. A pure state machine in `src/editor/vim.ts`, driven from the existing `keydown`

`VimMachine` holds `mode`, a pending count, a pending operator (`d`, `c`, `y`), a pending `g` and the leader state. `feed(key, context)` returns a list of **actions** (`move(point)`, `select(range)`, `deleteTo(point)`, `deleteBlocks(n)`, `yankBlocks(n)`, `paste(side)`, `enterInsert(point | newBlock)`, `openMenu("/" | "@")`, `selectBlock`, `undo`, `redo`, `setMode`). It never touches the DOM or the Editor directly. `page-editor.tsx` runs those actions with the Editor and the DOM helpers it already has.

Motions are pure functions over `EditorState` and a point (`motions.ts` next to it). The exceptions are `j`/`k`, `0`/`$`/`^` on wrapped lines and `gg`/`G` scrolling, which need layout. The machine takes those through a small `Layout` interface (`lineStart(point)`, `lineEnd(point)`, `lineBelow(point, goalX)`, `lineAbove(...)`). The DOM implements it with `offsetOnEdgeLine`, `rectAt`, `pointAt`, `arrowStop` and `arriveAt`. Tests use a fake where every block is one line.

*Alternatives:* a Vim emulation library (CodeMirror's `@replit/codemirror-vim`, VSCodeVim's core). These are tied to their own editors' document and selection models, so adapting them would be bigger than writing the subset we need. *Why actions, not direct calls:* the machine stays testable, and the app keeps sole ownership of the DOM and focus.

### 2. Vim intercepts `keydown` first, only when on

When Vim mode is on and the editor holds the caret, `onKeyDown` first asks the machine. In Normal and Visual mode the machine handles every key without Ctrl/Cmd/Alt and calls `preventDefault` (keys without a meaning are swallowed). It also handles Esc. Ctrl/Cmd shortcuts fall through to the existing handling, `Ctrl-r` excepted (it's redo there too). In Insert mode only Esc is intercepted, and only when no menu, link card or formatting bar is open; otherwise Esc reaches the existing code, which closes them. The existing `Esc → selectBlock` branch is skipped when Vim mode is on; `<leader> Esc` calls `editor.selectBlock`.

`beforeinput` in Normal and Visual mode calls `preventDefault` for every input type, a belt and braces measure in case a key slips past. `compositionstart` in those modes blurs and refocuses the root, which cancels the IME composition without inserting anything.

### 3. The block cursor is an overlay, the DOM caret stays collapsed

In Normal mode the DOM selection stays a collapsed caret (so `selectionchange`, `sync()` and every existing helper keep working). An absolutely positioned overlay is drawn over the character after it: `rectAt(element, offset)` to `rectAt(element, offset + 1)`, or a fixed-width box at the end of an empty line. The native caret is hidden with `caret-color: transparent` on the editor while in Normal mode. The overlay moves on `selectionchange`, `scroll` and resize, the same events the link card and formatting bar already follow.

*Alternative:* a one-character DOM selection as the cursor (what some web Vim modes do). That fights `sync()`, which would read it as a text selection, and the formatting bar, which opens on selections.

### 4. The register lives in the Editor, as blocks or text

`Editor` gains `register: { kind: "blocks"; trees: TreeNode[] } | { kind: "text"; content: RichText } | null`. `yy` fills it with `blockTrees`, and `x`/`d`/`c` fill it with the removed text. `p`/`P` reuse `pasteBlocks`, which already inserts trees after a block and gives them fresh IDs, or `insertText` for plain text. Visual `y` also writes the system clipboard through the existing copy path, so text yanked in Vim can be pasted elsewhere.

### 5. `dd` and `o`/`O` reuse block commands

`dd` with a count takes the next *n* blocks in `selectableOrder` from the cursor's block and calls `deleteBlocks`, which already skips sub-pages and suggestions and picks where the caret goes. The spec wants the block *after* (Vim's behavior), so a small option on `deleteBlocks` prefers the following text block. `o` runs `splitBlock` at the block's end, and `O` the same at its start; that gives the same new-block type as Enter (list item, unchecked to-do).

### 6. Setting: a cookie like the theme, gated by a media query on the client

`vim-setting.ts` mirrors `theme-mode.ts`: the root loader reads the `vim` cookie, and a context provides `{ enabled, setEnabled }`. The shell renders the toggle only after hydration when `matchMedia("(hover: hover) and (pointer: fine)")` matches. The editor's effective setting is `cookie && media`, so a phone with the cookie set never enters Vim mode.

### 7. Mode indicator

A small `Chip` at the editor's bottom-right corner, `position: sticky`, with `aria-live="polite"`. It's only rendered while Vim mode is on.

## Risks / Trade-offs

- [Swallowing keys in Normal mode hides browser shortcuts like `/` for Firefox quick find] → Only while the editor has focus and Vim mode is on, which is the point of Normal mode; Ctrl/Cmd shortcuts pass through.
- [`j`/`k` on wrapped lines depend on layout and could drift from ↓/↑] → They share `arrowStop`, `arriveAt` and `goalX` with the arrows, and Playwright covers a wrapped paragraph.
- [The block cursor overlay can lag behind the text while typing in Insert] → It's hidden in Insert mode; it only shows in Normal mode, where the text doesn't change under it except through operators, which re-place it.
- [Esc meaning something else is a surprise for anyone who toggles Vim mode on by accident] → The mode indicator is always visible while it's on, and the toggle sits next to the theme toggle.
- [Space as leader delays nothing, but a Space typed while expecting Insert does nothing] → The indicator shows Normal; that's Vim's usual trade-off.

## Migration Plan

None: a new opt-in setting with no stored data besides a cookie. Turning it off restores today's behavior immediately.

## Open Questions

- Should `gg`/`G` include the title as the first stop (Vim's "top of file")? The spec currently goes to the first and last text blocks, leaving the title out, like Select all.
