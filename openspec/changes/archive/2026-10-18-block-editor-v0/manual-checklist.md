# Manual checklist: block-editor-v0

Run against `npm run dev` with seeded data (`npm run db:seed`). Items already checked by hand during the change (typing, Enter/Backspace rules, markdown shortcuts, slash menu, toggles, todos, marks, links) are not repeated.

## Project home page
- [ ] `/projects/seed-project`: click the home page's content (or "Empty page. Click to start writing.") and type; "Saved" shows next to the project title; reload keeps it.
- [ ] The project title itself is not editable there.

## Task title and description
- [ ] Open an in-progress work task: change the title; the breadcrumb, the work list and the dashboard show the new title after it saves.
- [ ] Write a few blocks in the description; reload keeps them.
- [ ] With the description open, use "Return…" with a description note: the note appears at the end of the description without reloading.
- [ ] Pressing Enter on a focused action button (Start, Pause…) doesn't add a block to the description.

## Saving
- [ ] Type, then click a sidebar link right away: you land on the new page and the text was saved (no prompt).
- [ ] Stop the dev server, type something, then click a sidebar link: a "Leave without saving?" dialog appears; "Stay" keeps you on the page. Restart the server: "Saved" shows again once the retry gets through.
- [ ] Close the tab while "Saving…" shows: the browser asks before closing.

## Deleting pages
- [ ] On a library document with pages inside, the delete button (top right) opens a dialog naming it and how many pages go with it; Cancel changes nothing.
- [ ] Delete it: you land on the project's knowledge library, and the tree no longer shows it.
- [ ] From the sidebar, delete another document while a page is open: the open page stays.
- [ ] From the sidebar, delete the document containing the open page: you land on the knowledge library.
- [ ] Delete a workspace page from the "Pages" group: it disappears; if it was open you land on the home route.
- [ ] A project's home page and task pages show no delete button.
- [ ] A task that referenced a block of a deleted page shows that reference as missing.
