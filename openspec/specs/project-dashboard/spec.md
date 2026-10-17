# project-dashboard Specification

## Purpose
TBD - created by archiving change project-structure. Update Purpose after archive.
## Requirements
### Requirement: Dashboard is computed
A project's dashboard SHALL be computed from the project's current data each time it is requested. It SHALL NOT be stored as blocks, and it SHALL be returned separately from the home page's content.

#### Scenario: Dashboard reflects changes immediately
- **WHEN** a work task in the project is started
- **THEN** the next dashboard request includes it under work in progress

### Requirement: Dashboard sections
The dashboard SHALL be a list of sections in a fixed order. Each section SHALL have an ID, a title, a total count, and up to N items (N configurable, default 5), most recently updated first unless the section states another order. Each item SHALL include the task's ID, title, kind and state. The sections defined by this change are:

| Section | Contains |
|---|---|
| `work-in-progress` | work in state `in_progress` |
| `returned-work` | work in state `todo` whose most recent transition is `return` |
| `open-explorations` | explorations in state `open` |
| `open-updates` | updates in state `open` |
| `chores` | chores in state `todo`: urgent chores (including overdue ones) first, then by due time with the soonest first and chores without a due time last, then most recently updated. Each chore item also includes whether it is urgent and its due time. |
| `library` | the library's top-level documents (items are pages: ID and title) |

A section with no items SHALL still be returned, with a count of 0.

#### Scenario: Returned work
- **WHEN** work W was started and then returned
- **THEN** W is in `returned-work` and not in `work-in-progress`

#### Scenario: Paused work is not returned work
- **WHEN** work W was started and then paused
- **THEN** W is not in `returned-work`

#### Scenario: Count and items
- **WHEN** a project has 8 open explorations and N is 5
- **THEN** `open-explorations` has count 8 and the 5 most recently updated explorations

#### Scenario: Empty section
- **WHEN** a project has no updates
- **THEN** `open-updates` is returned with count 0 and no items

#### Scenario: Urgent chores first
- **WHEN** a project has a normal chore due tomorrow, an overdue chore, a chore marked urgent with no due time, and a normal chore with no due time
- **THEN** `chores` lists the overdue chore and the urgent chore first (soonest due first), then the chore due tomorrow, then the normal chore without a due time

### Requirement: Later changes add sections
The set of dashboard sections SHALL be extensible: a later change (for example chores, work logs or the graveyard) SHALL be able to add a section or change how a section orders its items, without changing the dashboard's other sections.

#### Scenario: A registered section appears
- **WHEN** a later change registers a section `recent-logs` after `chores`
- **THEN** the dashboard includes `recent-logs` in that position

