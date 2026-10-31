## 1. Setting

- [x] 1.1 `app/vim-setting.ts`: the setting in local storage (`vim-mode`, off by default, `storage` events from other tabs, unavailable storage meaning off), and `useVimSetting()` over it (a store read with `useSyncExternalStore`, so no provider is needed); the effective setting is the stored one and `(hover: hover) and (pointer: fine)`, both read after hydration
- [x] 1.2 The "Vim mode" toggle in the shell header next to the theme toggle, shown only on desktop browsers; tests for reading and writing the setting

## 2. Vim machine and motions

- [x] 2.1 `src/editor/vim.ts`: `Vim` with modes, counts, pending operator and `g`, the leader (Space, 1 s, injected clock) and `key(key, ctrl)` running the edits on the Editor; the `Layout` interface for line-based motions
- [x] 2.2 `src/editor/vim-motions.ts`: `h l w b e 0 ^ $ gg G`, crossing blocks for `w b e`, `gg`/`G` staying in the block, Normal mode never resting after the last character; tests with a one-line-per-block fake layout
- [x] 2.3 Insert entry `i a I A o O` (`o`/`O` through `splitBlock`, the type Enter would give) and Esc back to Normal one character back; tests
- [x] 2.4 Operators `x dw d$ cw cc dd yy p P` with counts, each one undo step; the register (blocks or text); `deleteBlocks` option to prefer the block after; `u`/`Ctrl-r`; tests against the in-memory store like `editor.test.ts`
- [x] 2.5 Visual mode: `v`, motions extending a selection within and across blocks, `d x c y`, Esc and `v` back; tests
- [x] 2.6 Leader actions: `<leader> /`, `<leader> @`, `<leader> Esc`, timeout and unknown follow-ups doing nothing; tests

## 3. Editor wiring

- [x] 3.1 `page-editor.tsx`: route keys to the machine first when Vim mode is on (Normal/Visual: every unmodified key; Insert: Esc when nothing is open), run its actions; skip today's `Esc → select block` with Vim mode on; block selection keys unchanged, Esc ending it back to Normal
- [x] 3.2 The DOM `Layout`: `j`/`k` through `arrowStop`/`arriveAt`/`goalX` (tables by column, images selected), wrapped-line starts and ends and a block's first and last line (`gg`/`G`) from `rectAt`/`pointAt`
- [x] 3.3 Normal/Visual input guard: `beforeinput` prevented, `compositionstart` cancelled by refocusing
- [x] 3.4 Block cursor overlay and `caret-color: transparent` in Normal mode, following `selectionchange`, scroll and resize; the mode indicator `Chip` with `aria-live`; styles in `app.css`
- [x] 3.5 Vim mode only in page and task description editors (not titles, not comment drafts)
- [x] 3.6 Key help: `?` in Normal mode and a click on the mode indicator open a "Vim mode keys" dialog, listed from `src/editor/vim-keys.ts`

## 4. Check

- [x] 4.1 Playwright in Chromium and Firefox: toggle and reload; Normal mode swallowing typing; `3w`, `j` across blocks and onto an image, `gg`/`G` within a code block; `A` and `o` in a list; `dd`, `yy p`, `cw`, `3x` with undo; Visual across blocks with `d`; leader `/`, `@` and Esc; Esc closing the slash menu before leaving Insert; Ctrl+B over a Visual selection; Vim mode off changing nothing
- [x] 4.2 Typecheck, unit tests and the whole Playwright suite; document Vim mode's keys in the README (the block-editor spec is synced when the change is archived)
