## Why

A task page stacks everything: description, comments, lineage, references, mentions and history, so the description competes with everything below it and a busy task scrolls for a long time. Chores also show their schedule in a separate card, with urgency as a toggle button and no way to change the schedule after creation.

## What Changes

- **Tabs**: the task page keeps its header (title, chips, actions) and shows its sections as tabs: Description first, then Comments, Lineage, References (with "Mentioned in"), History, depending on the kind. The open tab is in the URL; comment links open the Comments tab.
- **Chore header**: urgency becomes a dropdown (Normal / Urgent) and the schedule becomes a chip ("Every Monday at 09:00 · due 20 Oct 2026, 09:00", or "No schedule"); the Schedule card and the "Mark urgent / Mark normal" button go away.
- **Editing a chore's schedule**: the chip opens a dialog with every schedule option, prefilled; saving changes the configured schedule and recomputes the due time.

## Capabilities

### Modified Capabilities
- `task-screen`: tabbed sections; urgency dropdown; schedule editing.
- `project-screens`: the chore overview's schedule and urgency move to the header.

## Non-goals

- A choice between stacked and tabbed layouts (tabs replace the stacked page).
- Remembering the last tab per task.
- Editing a chore's base urgency (the dropdown changes this occurrence, as before).

## External dependencies

None (`Tabs`, `Select`, `Chip`, `Dialog` and the chore form's fields exist).

## Impact

- `app/routes/task.tsx`: header and tabs; `app/components/chore-fields.tsx`: schedule fields split out and reused by a schedule dialog; `app/lib/task-actions.server.ts`: a `schedule` intent; `app/lib/task-overview.server.ts`: chore form values and tab counts; `app/editor/page-editor.tsx`: the body can be hidden while another tab is open.
- No domain change (`ChoreService.setSchedule` exists).
