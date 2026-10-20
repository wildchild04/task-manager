## 1. Turn into

- [x] 1.1 `commands.ts`: `changeType` taken out of `slashCommand` (Code without marks, children moved out); `turnInto(state, ids, change)` over several blocks on a working state, skipping non-text blocks, cells and the title; `Editor.turnInto(change)` for the caret's block, a text range's text blocks, or the selected roots, keeping the selection; tests for the spec scenarios
- [x] 1.2 Handle menu: `HandleMenuItem.items` reopening the menu with the types, the shared type checked; "Turn into" first, disabled when no selected block has text; focus back to the editor after
- [x] 1.3 `page-editor.tsx`: Cmd/Ctrl+Shift+0–8 by `event.code`, with the caret, over a range and in block mode

## 2. Sub-pages

- [ ] 2.1 `page-edit.ts`: options `subPages` and `isEmptyPage`; inserting a title-only page block and deleting an empty sub-page when allowed; `page-edit.server.ts` passes them (page and project surfaces; children from the block service); tests for the spec scenarios, including the task-body refusal and a sub-page with content
- [ ] 2.2 The Page slash command (`page` action) where the `Editor`'s `subPages` option holds: replacing an empty block or following one with text, caret before it; `Editor.slash` returns the new sub-page's ID; tests
- [ ] 2.3 `page-editor.tsx`: open the new sub-page after the slash command (the leave guard waits for the save); re-read route data after a batch inserting or deleting a page block; the caret in the title of a page opened with an empty title and no blocks

## 3. Check

- [ ] 3.1 Headless check in Chromium and Firefox: Turn into from the handle on two blocks, the shortcuts with a caret and over a range, undo; `/page` from an empty block and after text, landing in the new title, the sidebar listing it; undo of `/page` before leaving; no Page command in a task body; typecheck and full test run
