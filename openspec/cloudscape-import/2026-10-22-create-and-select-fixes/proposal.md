## Why

Two gaps reported in use. A project home offers no way to create a task, and explorations and work can only be created by typing in the list's quick-add row and pressing Enter, which isn't discoverable. And blocks without text (images, dividers) can't be acted on: since the handle shows only beside the active block, and these blocks never hold the caret, their handle never shows, so an image can't be deleted, moved or given alt text, and Backspace does nothing to it.

## What Changes

- Every task list has a "New <kind>" button opening a create dialog (explorations and work: a title), alongside the quick-add row.
- A project home has a "New task" menu with the kinds its mode offers; each opens that kind's create dialog, and the created task opens.
- A project home's header reads: New task, the save button, then delete. The save button (on every page with the editor) is green with "Saved" once every edit is saved, red with "Couldn't save: retry" when saving failed (clicking it sends again), and neutral with a spinner while saving.
- Clicking a block without text selects it (Shift+click extends the selection), so its handle shows and the block keys (Backspace, Delete, moving, duplicating) act on it.

## Capabilities

### Modified Capabilities
- `project-screens`: creating tasks from every list and from the project home.
- `block-editor`: the handle shows beside the active block, which a click on a block without text makes it.

## Non-goals

- Removing the quick-add row.

## Cloudscape gaps

- Coloured buttons: Cloudscape's buttons have no success or error colours, so the save button is the app's own, styled with Cloudscape's status tokens and icons.

## Impact

- `app/components/new-task-dialog.tsx` (the create dialogs, moved out of the task list route), `app/routes/task-list.tsx`, `app/routes/project-home.tsx`, `app/lib/projects.server.ts`, `app/editor/editor-blocks.tsx`; e2e tests.
