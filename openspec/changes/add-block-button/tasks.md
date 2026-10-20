## 1. Command

- [x] 1.1 `commands.ts`: `addBlock(state, id, side, newId)` (a `/` paragraph after or before the block at its level, a table as a whole; an empty childless paragraph reused); `Editor.addBlock`; tests for the spec scenarios, including undo

## 2. UI

- [ ] 2.1 `editor-blocks.tsx`: the "+" `IconButton` (`add`) beside the grip, Alt/Option+click for above, hidden on coarse pointers; CSS placement for blocks and list items
- [ ] 2.2 `page-editor.tsx`: a handle action that runs `addBlock` and opens the slash menu on the new `/`; "Add below" in the handle menu after Turn into

## 3. Check

- [ ] 3.1 Headless check in Chromium and Firefox: "+" after a table then Heading 2, Alt+click above then Escape, an empty paragraph reused, Add below at phone width, undo; typecheck and full test run
