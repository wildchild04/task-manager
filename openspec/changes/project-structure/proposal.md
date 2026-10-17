## Why

A project is the hub of the app: it holds every task of every kind, its documents, and a home page where everything comes together. Tasks can't be created without a project to belong to, so this change is a prerequisite for `task-core`, and it gives the knowledge library (the Notion-like part) its structure.

## What Changes

- Introduce the **Project** entity. A project's title is the title of its **home page**.
- The **home page** is a normal page you write (overview, goals, references), shown together with a **dashboard** generated from the project's data.
- The **dashboard** is computed, not stored: sections such as work in progress, returned work, open explorations, open updates and chores, each with a count and its most recent items. Later changes (chores, work logs, graveyard) add their own sections.
- The **knowledge library** is a tree of pages per project, nested to any depth. Documents can be created, nested, reordered, moved (including to another project's library) and deleted.
- Project home pages, library roots and task body pages are **owned roots** (see `block-data-model`): they're reached through their project or task, not by browsing the workspace's pages.

## Capabilities

### New Capabilities
- `project`: project record, creation, home page, listing projects.
- `knowledge-library`: per-project page tree, document operations, the library tree used for navigation.
- `project-dashboard`: the dashboard query, its sections, and how later changes add sections.

### Modified Capabilities
<!-- None: no specs have been archived yet. -->

## Non-goals

- Archiving, completing or deleting projects.
- Sub-projects.
- Workspace-level documents outside any project.
- The graveyard (its own change), work logs, and any UI or layout of the dashboard.
- Customizable dashboards or placeable view blocks.

## External dependencies

None. This change has no UI. (The dashboard UI will need design-system components; those go in the UI change.)

## Prerequisites

- `block-data-model`, including owned roots.

`task-core` depends on this change for projects. The dashboard sections that read tasks depend on `task-core`, so the dashboard is implemented after it (see tasks).

## Impact

- New code: `src/domain/projects/` (types, repository port, service, dashboard) and `src/domain/library/`, with SQLite and in-memory implementations.
- New migration: `projects` table, numbered after `block-data-model`'s and before `task-core`'s.
