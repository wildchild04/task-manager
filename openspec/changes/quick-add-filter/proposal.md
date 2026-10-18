## Why

Before adding work or an exploration, you want to know whether it already exists. Typing into the quick-add row should narrow the list to matching titles, so duplicates show up as you type.

## What Changes

- The quick-add row of the explorations and work lists filters the visible rows by title (case-insensitive, contains) while it holds text; when nothing matches, the table says so and that Enter adds it. Creating the task clears the row and the filter.

## Capabilities

### Modified Capabilities
- `project-screens`: quick-add also filters.

## Non-goals

- Filtering for updates and chores (they're created from dialogs), searching descriptions, or a server-side search.

## Impact

- `app/routes/task-list.tsx` only: the row's value is held by the list and filters `view.rows` on the client.
