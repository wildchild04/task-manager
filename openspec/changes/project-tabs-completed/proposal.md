## Why

Project task tabs only show active tasks, so viewing completed work requires visiting the full list and changing its filter.

## What Changes

- Each project task tab offers a **Show completed (N)** toggle, off by default and shared between tabs through `?completed=1`.
- Completed tasks appear in a separate list with their state, most recently updated first. Active tab counts stay unchanged.

## Capabilities

### Modified Capabilities
- `project-screens`: showing completed work, explorations, updates and chores on project tabs.

## Scope

The imported proposal also describes searching by sub-project. This app has no sub-project model or sub-project task lists, so that behavior is not applicable here and is deferred until such a model exists.

## Impact

- `app/lib/projects.server.ts` and `app/routes/project-home.tsx`, with unit and Playwright coverage.
