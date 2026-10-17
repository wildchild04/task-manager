## Why

Projects, tasks, chores and the dashboard exist in the domain but nothing in the browser shows them: the app still only lists workspace pages read-only. This change makes the project-management half usable: navigating projects, seeing the dashboard, listing and creating tasks of every kind, and browsing and adding knowledge library documents. Acting on a single task (transitions, comments, references, lineage) follows in `task-ui`.

## What Changes

- **Navigation** lists projects (and, inside a project, its sections: Home, Explorations, Updates, Work, Chores, Knowledge library). Workspace pages move to their own "Pages" group.
- **Home (`/`)** lists projects and creates new ones.
- **Project home (`/projects/:projectId`)** shows the home page's content and the **dashboard**: one card per section with its count and items. Chore items show urgency and due time.
- **Task lists (`/projects/:projectId/explorations|updates|work|chores`)**: a table per kind with a state filter, and creation:
  - explorations and work: quick add by title
  - updates: a dialog with the title and the done work it iterates on
  - chores: a dialog with title, urgency and schedule (all five schedule types)
- **Knowledge library (`/projects/:projectId/library`)**: the document tree, and creating a document at the top level or inside another.
- **Task overview (`/tasks/:taskId`)**: a read-only task page (title, kind, state, project, body; for chores urgency, schedule and due time). `task-ui` adds actions to it.
- The **page viewer** also opens a project's home page and library documents.
- **Seed data** adds a sample project with tasks of every kind, chores and library documents.

## Capabilities

### New Capabilities
- `project-screens`: the projects home, project home with dashboard, task lists and task creation, the knowledge library page, and the read-only task overview.

### Modified Capabilities
- `app-shell`: navigation lists projects and project sections; the home route lists projects.
- `page-viewer`: project home pages and library documents can be opened.
- `dev-data`: the seed adds a sample project.

## Non-goals

- Task transitions, comments, references and lineage in the UI (`task-ui`).
- Editing page content: pages stay read-only until the block editor exists (keyboard spike).
- Renaming, moving or deleting documents and projects from the UI.
- Drag and drop, board views, search.

## External dependencies

Design-system feature requests (stopgaps in brackets, to be removed when the components ship):
- **Time picker** for HH:MM fields in chore schedules. [`TextField` with an HH:MM placeholder, validated on the server.]
- **Tree view** for the knowledge library in the navigation. [The library tree is shown on the library page as nested links.]

Everything else uses existing components: `PageShell`, `PageNavigation`, `Card`, `SummaryRow`, `Table` and `TableAddRow`, `Tabs`, `Chip`, `Dialog`, `TextField`, `Select`, `SearchSelect`, `DatePicker`, `Alert`, `Link`, `Typography`.

## Prerequisites

- `app-scaffold`, `project-structure`, `task-core`, `task-chore` (applied and archived).

## Impact

- New routes in `app/routes/`, view and action modules in `app/lib/`, components in `app/components/`.
- `app/routes/shell.tsx` and `app/routes/home.tsx` change; `app/lib/page-view.server.ts` accepts project pages.
- `scripts/seed.ts` gains a sample project.
- No domain or schema changes.
