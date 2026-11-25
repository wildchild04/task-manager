## Why

From the exploration "See all page enhancements": a project home's task tabs list only active tasks, so seeing what was finished means leaving for the full list and changing its filter. A container's task list names each task's sub-project, but its search box ignores that name.

## What Changes

- Each task tab on a project home has a **Show completed (N)** toggle, off by default and kept in the URL (`?completed=1`). When on, the tab also lists its kind's completed tasks under "Completed", each with its state.
- The search box of a task list also matches the sub-project (or root cause) name.

## Capabilities

### Modified Capabilities
- `project-screens`: the project home's "Show completed", and searching task lists by sub-project.

## Non-goals

- A workspace-wide list of tasks across projects.
- Changing the full lists' state filters, or the tabs' counts (which still count active tasks).
- Search boxes on lists that have none (updates, chores, tickets, experiments).

## Cloudscape gaps

None: Toggle, List and Box.

## Impact

- `app/lib/projects.server.ts` (`completed` per tab), `app/routes/project-home.tsx`, `app/routes/task-list.tsx`. A unit test of the completed items and an e2e test of the toggle (with reload) and the sub-project search.
