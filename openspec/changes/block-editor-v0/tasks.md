## 1. Editor state (pure TypeScript)

- [x] 1.1 Rich-text operations: insert and delete at offsets, toggle marks over a range, add/remove links, split and join, keeping marks and merging equal neighbouring spans
- [x] 1.2 Block type declarations (`defineBlockType`) and the markdown shortcut table
- [x] 1.3 Editor state from a page tree: blocks, ordered children, visual order for navigation, selection, version
- [x] 1.4 Commands: insert/delete text, marks, link, split (Enter with type rules), line break, Backspace/Delete at edges (demote, merge, skip sub-pages, remove references and dividers), Tab/Shift+Tab, markdown shortcuts, todo check, title edits
- [x] 1.5 Inverse batches and undo/redo history with typing coalescing
- [x] 1.6 Save queue: ordering, coalescing content updates, flush rules, in-flight request, retry, rejection
- [x] 1.7 Vitest coverage for every command and spec scenario, including undo of each, and that applying a command's batch through the in-memory block repository gives the same tree as the editor state

## 2. Server

- [ ] 2.1 `checkPageEdit` in the domain: scope inside the page's own content, no sub-page deletion, page block only retitled, no page/comment inserts
- [ ] 2.2 `applyPageEdit` and the `intent=edit` action on `/pages/:pageId`, `/projects/:projectId` and `/tasks/:taskId`, with `shouldRevalidate` skipping edits and the shell revalidating on title changes; loaders send the editable tree and its version
- [ ] 2.3 `pageDeletionInfo` and `deletePage` (deletable pages, nested page count, where to go next) with the `intent=delete-page` action
- [ ] 2.4 Tests for edit scope rejections, retitling, and deletion targets

## 3. Editing loop in the browser (gate)

- [ ] 3.1 `dom-caret.ts`: DOM selection ↔ offsets, caret restore, line-edge detection, point to offset
- [ ] 3.2 `EditableBlock` and `PageEditor` with the `beforeinput` loop and composition handling, for paragraphs only, on `/pages/:pageId`
- [ ] 3.3 Manual check by the user: typing, deleting, selection replace, accented input (é, ñ), caret stays put after re-render; adjust before going on

## 4. Full editing behaviour

- [ ] 4.1 Every block type's editable component (headings, lists with numbering, todo with checkbox, toggle with open/close, quote, divider, sub-page and reference as non-text blocks with navigation)
- [ ] 4.2 Keyboard: Enter, Shift+Enter, Backspace/Delete at edges, Tab/Shift+Tab, arrows across blocks and wrapped lines, title ↔ first block
- [ ] 4.3 Mark shortcuts and the link prompt; markdown shortcuts
- [ ] 4.4 Undo/redo keys and `historyUndo`/`historyRedo` input events

## 5. Saving in the browser

- [ ] 5.1 Wire the save queue to a fetcher per surface; saving indicator; error and reload on rejection
- [ ] 5.2 Leave warnings (`beforeunload`, `useBlocker`) while edits are unsaved
- [ ] 5.3 Reset from the loader when the server version changes and nothing is pending

## 6. Surfaces

- [ ] 6.1 Library documents and workspace pages (`/pages/:pageId`), title included
- [ ] 6.2 Project home page content on `/projects/:projectId`
- [ ] 6.3 Task title and description on `/tasks/:taskId`, staying in sync after transitions that change the body (return)

## 7. Deleting pages

- [ ] 7.1 Delete button at the top right of deletable pages, with the confirmation dialog and redirect
- [ ] 7.2 Delete actions on library documents and "Pages" items in the navigation, navigating only when the open page goes

## 8. Verification

- [ ] 8.1 Typecheck and full test run
- [ ] 8.2 Manual checklist for the user covering every `block-editor` and `page-deletion` scenario in a browser
