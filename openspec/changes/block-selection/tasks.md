## 1. Design system

- [x] 1.1 Feature request `~/dev/design-system/feature-requests/drag-indicator-icon.md` (written with the proposal; check it's still accurate before starting)

## 2. Selection model

- [x] 2.1 `editor-state.ts`: `Point` (moved from `clipboard.ts`), `TextRange`, `BlockRange`; `selectableOrder` and `selectedRoots` (tables as one stop, suggestions whole, closed toggles' children skipped, covered parents implying children); tests
- [x] 2.2 `Editor` and `History`: `range` and `blocks` alongside `selection` (at most one set; a caret clears both); `SelectionSnapshot` recorded before and after each step and restored by undo and redo; tests

## 3. Commands

- [x] 3.1 `src/editor/selection.ts`: `replaceRange` (partial first and last blocks, marks kept at the join, tables removed whole, kept sub-pages and suggestions, survivors moving under the first block or after it, code joins as Backspace's merge); tests for the spec scenarios against the in-memory store
- [x] 3.2 `Editor` over a range: `type`, `enter`, `lineBreak`, `paste`, `deleteBackward`/`deleteForward` composed with `replaceRange` as one batch and one undo step; Markdown shortcut check after typing; tests
- [x] 3.3 Block commands: `deleteBlocks` (caret placement, empty page gets a paragraph), `duplicateBlocks` (new IDs, sub-pages and suggestions left out), `moveBlocks` (siblings, out to the parent's level at the edges, caret block, table row), `dropBlocks` (invalid targets refused), `nestBlocks`/`unnestBlocks`; each one undo step that reselects the blocks; tests
- [x] 3.4 Clipboard: `blockTrees` for a block selection, paste replacing a block selection, cut for a range and for blocks; tests for the Markdown produced and the batches

## 4. Text selection across blocks (DOM)

- [ ] 4.1 `dom-caret.ts`: `readRange`, `writeRange`, `pointAt(x, y)`; `selectionchange` reading a range before an in-block selection
- [ ] 4.2 `page-editor.tsx`: pointer-driven drag across blocks (with auto-scroll), Shift+click, Shift+Arrow at block edges; `keydown`/`beforeinput` routing a range to the range commands; arrows collapsing it; composition starting over a range; `cut` handler; Cmd/Ctrl+A twice

## 5. Block selection (DOM)

- [ ] 5.1 Block mode: focus on the editor root (`tabIndex=-1`, group label), `data-selected` highlight from tokens, live region count; Escape from text, a cell or a range; keys of design decision 6; leaving block mode on click or Escape
- [ ] 5.2 Handle and menu in `editor-blocks.tsx`: hover and coarse-pointer visibility, none on rows, cells, suggestion contents, the title or in comment editors; local six-dot SVG until `drag_indicator` ships; menu items with disabled states; Shift+click on a handle extends
- [ ] 5.3 `app/editor/block-drag.ts`: pointer dragging after 4px, dimmed rows, drop line at the target's level or inside past the text start, refused targets show no line, auto-scroll, Escape and outside release cancel; drop runs `dropBlocks`

## 6. Check

- [ ] 6.1 Headless check in Chromium, Firefox and WebKit: drag-select across three blocks and type over it; Shift+↓ across blocks and cut, then paste elsewhere; Escape, Shift+↓, Cmd/Ctrl+D, Cmd/Ctrl+Shift+↑, Backspace and undo of each; drag a block into a toggle; handle menu at phone width; light and dark; typecheck and full test run
