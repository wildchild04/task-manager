## Context

`block-data-model` provides block trees, workspace root pages and owned roots. `task-core` needs a project for every task. This change defines the project as a thin entity whose content lives in two owned page roots (home page and library root), plus a dashboard computed from tasks.

## Goals / Non-Goals

**Goals:**
- A project hub with a written home page and a generated dashboard.
- A knowledge library that behaves exactly like nested Notion pages.
- No duplicated data: titles come from pages, dashboard data comes from tasks.

**Non-Goals:**
- Archiving, sub-projects, workspace-level docs, graveyard, logs, UI (see the proposal).

## Decisions

### 1. A project is a thin row with two owned roots
`projects(id, home_page_id UNIQUE, library_root_id UNIQUE, created_at, updated_at)`. Both pages are owned roots with owner `project:<id>`. The project registers the `project` owner kind with the block protection hook: its roots can be edited but not deleted. The library root's own title is not shown anywhere (the UI labels it "Knowledge library"); its children are the documents.

**Alternative considered:** one root per project (the home page) with the library as a child page of it. Rejected: the library would show up as content on the home page, and a block batch on the home page could move or delete it.

### 2. Task pages are not in the library
Task body pages are owned by their task (`task-core`), so the library contains only documents, and tasks are reached through views and the dashboard. A task's project comes from the task row; a library document's project comes from walking up to its root and reading the owner.

### 3. The dashboard is a list of registered sections
`src/domain/projects/dashboard.ts` defines a `DashboardSection` interface (`id`, `title`, `query(projectId, limit) → { count, items }`) and an ordered registry. This change registers six sections. Later changes register theirs, or replace a section's ordering: the chore change will make `chores` sort urgent chores first.

"Returned work" needs the latest transition per task. The SQLite query uses `task_transitions` with an index on `(task_id, at)`, and selects work in `todo` whose newest transition is `return`.

**Alternative considered:** storing the dashboard as blocks on the home page (Notion-style linked views). Rejected for now: you asked for a dashboard, not a configurable page, and stored views would need a view-definition model first. Placeable view blocks can come later as a new reference kind.

### 4. Implementation order across changes
Migrations run in the order `blocks`, `projects`, `tasks`, `comments`. The project entity and library are implemented before `task-core`; the dashboard sections that read tasks are implemented after `task-core` is applied. `tasks.md` is split accordingly.

## Risks / Trade-offs

- [Walking up to a page's root to find its project costs a read per level] → Library trees are shallow; the walk can be done in one recursive query when needed for many pages.
- [Moving a document between projects silently changes which project "owns" it] → That's the intended meaning of a move; references keep working because they use block IDs.
- [Dashboard queries run on every request] → Single user, indexed queries on small tables; cache only if it ever shows up as slow.

## Migration Plan

New `projects` table, numbered after the blocks migration and before the tasks migration.

## Open Questions

- Project order in the sidebar: creation order (assumed) or user-reorderable?
- Archiving or completing projects, and what happens to their scheduled chores.
- Sub-projects, and workspace-level documents shared across projects (for example coding conventions or agent instructions).
- Graveyard scope (per project, global, or both): for the graveyard change.
