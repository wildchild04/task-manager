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

`Vim` holds `mode`, a pending count, a pending operator (`d`, `c`, `y`), a pending `g`, the leader state and the register. `key(key, ctrl)` returns whether it took the key, and makes the edits itself with the Editor: its existing commands (`setSelection`, `type`, `undo`) and a few new pure ones in `vim-commands.ts` (`deleteText`, `insertContent`, `openLine`, `pasteTrees`), each applied through `Editor.runCommand` as one undo step. It never touches the DOM. What only the page can do comes back through callbacks: `openMenu(blockId, start)` and `copy()` (Visual `y`), and `onMode` for the indicator. Tests drive a real Editor over the in-memory store, key by key.

Motions are pure functions over `EditorState` and a point (`motions.ts` next to it). The exceptions are `j`/`k`, and `0`/`$`/`^`/`gg`/`G` on wrapped lines, which need layout (`gg`/`G` stay in the cursor's block). The machine takes those through a small `Layout` interface (`lineStart(point)`, `lineEnd(point)`, `lineBelow(point, goalX)`, `lineAbove(...)`, `firstLine(block)`, `lastLine(block)`). The DOM implements it with `offsetOnEdgeLine`, `rectAt`, `pointAt`, `arrowStop` and `arriveAt`. Tests use a fake where every block is one line.

*Alternatives:* a Vim emulation library (CodeMirror's `@replit/codemirror-vim`, VSCodeVim's core). These are tied to their own editors' document and selection models, so adapting them would be bigger than writing the subset we need. *Why not a list of actions for the page to run:* the edits only need the Editor, which has no DOM either, so the machine stays testable while running them itself; only menus, the clipboard and the mode indicator need the page.

### 2. Vim intercepts `keydown` first, only when on

When Vim mode is on and the editor holds the caret, `onKeyDown` first asks the machine. In Normal and Visual mode the machine handles every key without Ctrl/Cmd/Alt and calls `preventDefault` (keys without a meaning are swallowed). It also handles Esc. Ctrl/Cmd shortcuts fall through to the existing handling, `Ctrl-r` excepted (it's redo there too). In Insert mode only Esc is intercepted, and only when no menu, link card or formatting bar is open; otherwise Esc reaches the existing code, which closes them. The existing `Esc → selectBlock` branch is skipped when Vim mode is on; `<leader> Esc` calls `editor.selectBlock`.

`beforeinput` in Normal and Visual mode calls `preventDefault` for every input type, a belt and braces measure in case a key slips past. `compositionstart` in those modes blurs and refocuses the root, which cancels the IME composition without inserting anything.

### 3. The block cursor is an overlay, the DOM caret stays collapsed

In Normal mode the DOM selection stays a collapsed caret (so `selectionchange`, `sync()` and every existing helper keep working). An absolutely positioned overlay is drawn over the character after it: `rectAt(element, offset)` to `rectAt(element, offset + 1)`, or a fixed-width box at the end of an empty line. The native caret is hidden with `caret-color: transparent` on the editor while in Normal mode. The overlay moves on `selectionchange`, `scroll` and resize, the same events the link card and formatting bar already follow.

*Alternative:* a one-character DOM selection as the cursor (what some web Vim modes do). That fights `sync()`, which would read it as a text selection, and the formatting bar, which opens on selections.

### 4. The register lives in `Vim`, as blocks or text

`Vim` has `register: { kind: "blocks"; trees: TreeNode[] } | { kind: "text"; content: RichText } | null`. `yy` fills it with `blockTrees`, and `x`/`d`/`c` fill it with the removed text. `p`/`P` insert copies of the trees with fresh IDs beside the cursor's block (`pasteTrees`, leaving out sub-pages and suggestions as duplicating does), or the text at the cursor with its marks (`insertContent`). Visual `y` also writes the system clipboard through the existing copy path, so text yanked in Vim can be pasted elsewhere.

### 5. `dd` and `o`/`O` reuse block commands

`dd` with a count takes the next *n* blocks in `selectableOrder` from the cursor's block and calls `deleteBlocks`, which already skips sub-pages and suggestions and picks where the caret goes. The spec wants the block *after* (Vim's behavior), so a small option on `deleteBlocks` prefers the following text block. `o` and `O` insert an empty block after or before the cursor's block with `newBlockAfter`, the rule Enter uses for the new block's type (list item, unchecked to-do); unlike Enter, an empty list item doesn't turn into a paragraph. In code they add a line instead.

### 6. Setting: local storage, gated by a media query on the client

`vim-setting.ts` keeps the setting under the local storage key `vim-mode` (`"on"`, anything else or nothing meaning off, so it's off by default) and `useVimSetting()` reads it as `{ offered, enabled, setEnabled }` from a small store (`useSyncExternalStore`), so no provider is needed. It's read after hydration, as is `matchMedia("(hover: hover) and (pointer: fine)")`: the server and the first browser render are without Vim mode, and the editor switches to Normal mode once both say on. The shell renders the toggle only after hydration when the media query matches. The editor's effective setting is `stored && media`, so a phone with the setting stored never enters Vim mode. A `storage` event (the toggle changed in another tab) updates the setting. Reading and writing are wrapped in `try`/`catch`: where storage is unavailable, Vim mode is off and the toggle works for the session.

*Alternative:* a cookie read by the root loader, like the theme, so the server renders the chosen setting. Not needed: the media query can only be checked in the browser anyway, so the editor can't be in Vim mode before hydration either way, and nothing on the server needs the setting.

### 7. Mode indicator

A small `Chip` at the editor's bottom-right corner, `position: sticky`, with `aria-live="polite"`. It's only rendered while Vim mode is on.

## Risks / Trade-offs

- [Swallowing keys in Normal mode hides browser shortcuts like `/` for Firefox quick find] → Only while the editor has focus and Vim mode is on, which is the point of Normal mode; Ctrl/Cmd shortcuts pass through.
- [`j`/`k` on wrapped lines depend on layout and could drift from ↓/↑] → They share `arrowStop`, `arriveAt` and `goalX` with the arrows, and Playwright covers a wrapped paragraph.
- [The block cursor overlay can lag behind the text while typing in Insert] → It's hidden in Insert mode; it only shows in Normal mode, where the text doesn't change under it except through operators, which re-place it.
- [Esc meaning something else is a surprise for anyone who toggles Vim mode on by accident] → The mode indicator is always visible while it's on, and the toggle sits next to the theme toggle.
- [Space as leader delays nothing, but a Space typed while expecting Insert does nothing] → The indicator shows Normal; that's Vim's usual trade-off.

## Migration Plan

None: a new opt-in setting, stored only in the browser's local storage. Turning it off restores today's behavior immediately.

## Open Questions

None.
