## Why

The project-management half of the app depends on tasks with strict kinds and lifecycles: explorations that end up as work or in the graveyard, work that is done or cancelled, updates that iterate on finished work, and chores that recur. These rules can't be expressed as generic Notion-style database properties, so tasks need their own domain model. Every kind-specific change (exploration, update, work, chore), the work logs, the graveyard and the agent API build on it.

## What Changes

- Introduce the **Task** entity: a fixed `kind` (`exploration`, `update`, `work`, `chore`), a `state`, the owning project, and a **body page** (a block-tree page). The task's title is its body page's title.
- Introduce a **lifecycle framework**: each kind declares its states and named transitions. State changes only through transitions, and every transition is recorded in a history with its actor (you or a named agent).
- Define the **lifecycle of each kind**:
  - exploration and update: `open → promoted | tombstoned`, `tombstoned → open` (revive)
  - work: `todo → in_progress → done`, pause or **return** back to `todo` (return means the attempt couldn't complete it and requires a reason), cancel to `cancelled`, reopen back to `todo`
  - chore: `todo → done`, cancel to `cancelled`
- Introduce **typed relations** between tasks and pages:
  - `born_from`: work → the exploration or update it was promoted from
  - `iterates_on`: update → the done work it continues
  - `references`: any task → any task or page, in any project. A tombstoned idea is one possible target, which is how an idea is resurrected; knowledge library pages supporting a piece of work are another.
- Provide **lineage**: from any task, the chain `exploration → work → update → work → …` that forms a feature's history.
- Define a **`TaskRepository` port** with SQLite and in-memory implementations, and a **unit of work** so a task and its body page are written in one transaction.

## Capabilities

### New Capabilities
- `task-entity`: the task record, kinds, body page, kind-specific attributes, listing tasks.
- `task-lifecycle`: states and transitions per kind, transition history, transitions that create other tasks.
- `task-relations`: relation types and their rules, lineage, incoming relations.

### Modified Capabilities
<!-- None: the block requirements this change relies on (owned roots, protection hooks) are already in the archived block-tree spec. -->

## Non-goals

- Kind-specific substructure (work subtasks, chore schedules and urgency), and each kind's agent workflow. These come in one change per kind.
- The project itself, its home page and knowledge library (the `project-structure` change).
- Work logs, the graveyard view, the agent API, and any UI.
- Deleting tasks. Tasks leave active lists by being tombstoned, cancelled or done, so their history is kept.

## External dependencies

None. This change has no UI.

## Prerequisites

- `block-data-model`: body pages are block-tree pages.
- `project-structure`: tasks belong to a project.

## Impact

- New code: `src/domain/tasks/` (types, kind definitions, lifecycle, relations, repository port, service), `src/domain/unit-of-work.ts`, and SQLite and in-memory implementations under `src/infra/`.
- New migration: tasks, task transitions and task relations tables.
- `block-data-model`: its repositories must be able to run inside a shared unit of work (see design).
