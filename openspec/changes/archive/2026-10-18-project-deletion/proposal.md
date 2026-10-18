## Why

Projects can be created from anywhere now, but never removed: a test project or an abandoned one stays in the navigation and the home page for good. Pages already have a delete button with a confirmation; projects should work the same way.

## What Changes

- **Deleting a project** removes everything in it, in one transaction: its tasks (with their descriptions, comments, history and relations), its home page and its knowledge library.
- Things outside the project that pointed into it keep working: references from other projects' tasks and mentions in other pages show the deleted targets as missing, as they do for deleted pages.
- **A delete button** at the top right of the project home, with a confirmation dialog that names the project and says how many tasks and documents go with it. After deleting, the browser goes to the home route.

## Capabilities

### Modified Capabilities
- `project`: projects can be deleted, with everything they contain.
- `project-screens`: the project home offers deleting the project.

## Non-goals

- A trash or undo.
- Moving tasks or documents to another project before deleting.
- Deleting projects through the agent API.

## Impact

- `TaskRepository.delete` and `ProjectRepository.delete` (SQLite and memory, contract-tested); `ProjectService.delete`.
- `app/routes/project-home.tsx`: delete button, dialog and action; `app/lib/projects.server.ts`: what deleting involves.
- No schema change.
