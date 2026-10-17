## Context

`block-data-model` defines content as a block tree with a repository port. This change adds the structured half of the app: tasks with fixed kinds, lifecycles and typed relations. Tasks and blocks live in the same SQLite database, and some actions touch both (creating a task creates its body page). The app is single user, but AI agents will act as additional writers later, so every state change records its actor from the start.

## Goals / Non-Goals

**Goals:**
- Lifecycles enforced in code, one definition per kind, impossible to bypass.
- A complete, permanent history of how each task moved and who moved it.
- Relations that make a feature's lineage queryable.
- Task and block writes that commit together.

**Non-Goals:**
- Kind substructure, chore scheduling, agent workflows, logs, UI (see the proposal).

## Decisions

### 1. Kinds are code, not data
Each kind is a `KindDefinition` object in `src/domain/tasks/kinds/`: its states, initial and terminal states, transitions, attribute schema (zod), and transition effects. A registry maps `kind` to its definition. Adding behaviour to a kind means editing its definition, and the type system checks state and transition names.

**Alternative considered:** user-configurable kinds and states stored in the database. Rejected: strict, distinct lifecycles are the point of having kinds, and configurable workflows would push rule checking out of the type system.

### 2. Transitions are commands with effects
`TaskService.transition(taskId, name, { actor, note, input })` loads the task, finds the transition for the current state, validates `input` against the transition's schema, runs its effect, writes the new state and appends a history row, all in one unit of work. `promote` is a transition whose effect creates the work task, its body page and the `born_from` relation. Chore recurrence (in the chore change) will be an effect on `complete`.

### 3. A unit of work spans tasks and blocks
A `UnitOfWork` port exposes `run(fn)`, where `fn` receives the block and task repositories bound to one transaction. In SQLite this is an outer better-sqlite3 transaction; repository `apply` calls inside it use better-sqlite3's nested transactions, which become savepoints. The in-memory implementation snapshots both stores and restores them if `fn` throws.

This requires the `block-data-model` repositories to accept being run inside an outer transaction. That doesn't change their spec, only how they're constructed, and is noted in that change's design.

**Alternative considered:** creating the body page first, then the task, and cleaning up on failure. Rejected: a crash in between leaves an orphan page, and every multi-step command would need hand-written compensation.

### 4. Title lives on the body page only
A task has no title column. Reads join through `body_page_id` to the page block's content. One source of truth means renaming in the editor and renaming from a list are the same operation (a block `update`).

### 5. Body-page deletion is guarded in the block validator
Body pages are owned roots with owner `task:<id>`. `task-core` registers the `task` owner kind with the block validator's protection hook: general batches may edit a body page's content but may not delete its root.

### 6. Relations are rows, separate from block references
`task_relations(id, type, from_task_id, to_kind, to_id, created_at)`. `to_kind` names a registered referenceable entity kind: `task` and `block` in this change. Each kind registers a resolver (`ok` with a summary, or `missing`), so later changes add subtasks, comments or log entries by registering a kind, with no schema change. Block `reference` blocks remain for content; task relations are for structure with rules per type. A `references` relation to a deleted block resolves as missing, like a dangling block reference.

There are only two structural types (`born_from`, `iterates_on`), which form the lineage and are permanent. Everything else is one general `references` type: any task to any task or page, across projects, editable. Resurrecting an idea is simply creating an exploration or update that references a tombstoned task, and the graveyard can show how often each tombstone has been referenced through incoming references.

**Alternatives considered:**
- *Modelling relations as `reference` blocks inside the body page:* rejected, because rules like "update must target done work" and "born_from only via promote" belong to the task domain, and lineage queries would have to parse page content.
- *Specific types such as `inspired_by` (tombstoned targets only) and `supported_by` (pages only):* rejected in favour of one general type, since a tombstoned idea is just one of many things a new exploration or update can draw on. If a distinction is needed later, an optional label on `references` can add it without a new type.

### 7. Lineage is computed on read
A recursive CTE walks `born_from` and `iterates_on` backwards to the root exploration, then forwards to collect the tree. Lineages stay small (tens of tasks), so no materialized table is needed.

### 8. Tables
```
tasks(id, project_id, kind, state, body_page_id UNIQUE, attributes JSON, created_at, updated_at)
task_transitions(id, task_id, name, from_state, to_state, actor_kind, actor_name, note, at)
task_relations(id, type, from_task_id, to_kind, to_id, created_at)
  indexes: tasks(project_id, kind, state), task_relations(from_task_id, type),
           task_relations(to_id, type)
```

## Decisions captured for the kind-specific changes

These were agreed during exploration and belong to later changes. They are recorded here so nothing is lost:

- **exploration:** promotion is 1:1 with work. Promoting means "explored enough to know the work".
- **update:** iterates on a done work task and is the "next iteration" of that feature. An exploration is effectively the first update. Same lifecycle as exploration.
- **work:** has subtasks (structure to be defined). `done` is final, and further changes to that feature are updates. Cancelled work does not go to the graveyard and can be reopened to `todo`. Work can be paused (in_progress → todo). Support material is the exploration it was born from plus referenced knowledge library pages.
- **chore:** one kind with configuration attributes rather than subtypes: `urgency: normal | urgent`, plus an optional `schedule`. A scheduled chore becomes urgent when overdue, and completing a scheduled chore creates the next occurrence. Urgent chores sort first. Cancelling a scheduled chore asks for a scope: `occurrence` cancels this one and creates the next (a skip), `series` cancels this one and ends the schedule. A chore without a schedule can only cancel the occurrence.
- **returned work (work and agent changes):** when an agent can't complete work it applies `return`, posts a comment explaining why, and updates the body page with what it learned, all in one action. The comment part waits for the comments change, so `task-core` only requires the reason. Retry guard: after N returns (to be decided, 2–3) since the body page last changed, the work is no longer offered to agents until the human edits it. Returned work waiting in `todo` is the "needs your input" signal.
- **comments:** specified in `task-comments`. Flat list, only on work and chores, block bodies, editable and deletable, no comment types.
- **references everywhere:** anything that describes a problem or a gap can start an exploration or update: a cancelled work task, a subtask, a comment on a task, a paragraph in a page. Subtasks and comments (a comments feature is not specified yet) must register as referenceable entity kinds when they are introduced.
- **every kind:** defines its agent workflow (what an agent may do in each state, what it must log, which transitions need the human).

## Risks / Trade-offs

- [Lifecycle details may change once agent workflows are designed] → Kinds are code with typed transitions, so changing them is a compile-checked edit plus a migration only if a state is renamed.
- [Joining through the body page for every title read] → It's an indexed primary-key join on a single-user database; negligible.
- [Nested savepoints hide a missing outer transaction] → The unit of work is the only public way to call task commands that write, and tests assert that a failure mid-command leaves both stores unchanged.

## Migration Plan

New tables only, in a migration numbered after the `block-data-model` and `project-structure` migrations.

## Open Questions

- None for this change. Kind-specific questions (subtask structure, schedule configuration) belong to the kind changes.
