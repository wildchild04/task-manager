## ADDED Requirements

### Requirement: Lifecycle definitions
Each kind SHALL declare its states, its initial state, its terminal states, and its named transitions. A task's state SHALL change only by applying one of its kind's transitions from the task's current state.

| Kind | Initial | Transitions (name: from → to) | Terminal |
|---|---|---|---|
| exploration | `open` | promote: open → promoted · tombstone: open → tombstoned · revive: tombstoned → open | `promoted` |
| update | `open` | promote: open → promoted · tombstone: open → tombstoned · revive: tombstoned → open | `promoted` |
| work | `todo` | start: todo → in_progress · pause: in_progress → todo · return: in_progress → todo · complete: in_progress → done · cancel: todo or in_progress → cancelled · reopen: cancelled → todo | `done` |
| chore | `todo` | complete: todo → done · cancel: todo → cancelled | `done`, `cancelled` |

The chore `cancel` transition SHALL take a `scope` input of `occurrence` or `series`. Its effects for scheduled chores are defined by the chore change; for a chore without a schedule only `occurrence` is valid.

#### Scenario: Valid transition
- **WHEN** `start` is applied to a work task in `todo`
- **THEN** its state is `in_progress`

#### Scenario: Transition not allowed from the current state
- **WHEN** `complete` is applied to a work task in `todo`
- **THEN** it is rejected and the state is unchanged

#### Scenario: Transition from a terminal state
- **WHEN** any transition is applied to a work task in `done`
- **THEN** it is rejected

#### Scenario: Cancelled work can be reopened
- **WHEN** `reopen` is applied to a cancelled work task
- **THEN** its state is `todo`

#### Scenario: Revive keeps everything
- **WHEN** `revive` is applied to a tombstoned exploration
- **THEN** it is the same task in state `open`, with its body page, relations and transition history unchanged

### Requirement: Returning work
`return` SHALL mean "this attempt could not complete the work", as distinct from `pause` (stopping for now) and `cancel` (the work will not be done). It SHALL require a non-empty reason, recorded as the history entry's note. It SHALL accept an optional block batch that updates the task's body page with what was learned, applied in the same transaction as the state change.

#### Scenario: Agent returns work with what it learned
- **WHEN** agent "builder" applies `return` to in-progress work with reason "OAuth provider not decided" and a batch adding an "Unknowns" section to the body page
- **THEN** the work is `todo`, the body page contains the new section, and the history entry records `return` by agent "builder" with that reason

#### Scenario: Return without a reason
- **WHEN** `return` is applied with an empty reason
- **THEN** it is rejected and the state is unchanged

#### Scenario: Body update failure blocks the return
- **WHEN** the body page batch given with `return` is rejected
- **THEN** the work stays `in_progress` and no history entry is added

#### Scenario: Return is not cancel
- **WHEN** work has been returned
- **THEN** it is not included when listing `cancelled` work

### Requirement: Transition history
Every applied transition SHALL be recorded with: the task ID, the transition name, the from and to states, a timestamp, the actor, and an optional note. The actor SHALL be either the human user or an agent identified by name. History entries SHALL never be changed or deleted.

#### Scenario: History records the actor
- **WHEN** agent "builder" applies `start` to a work task with note "picking this up"
- **THEN** the task's history ends with an entry for `start` from `todo` to `in_progress`, actor agent "builder", and that note

#### Scenario: History is ordered
- **WHEN** a task's history is read
- **THEN** entries are returned oldest first

### Requirement: Promotion creates work
Applying `promote` to an exploration or update SHALL, in the same transaction, create exactly one `work` task in the same project and a `born_from` relation from the new work to the promoted task. The new work's title SHALL be given with the promote request. A task can be promoted at most once, since `promoted` is terminal.

#### Scenario: Promote an exploration
- **WHEN** `promote` is applied to open exploration E with work title "Implement search"
- **THEN** E is `promoted`, a new work task "Implement search" exists in `todo`, and it is `born_from` E

#### Scenario: Promotion is atomic
- **WHEN** creating the new work task fails during `promote`
- **THEN** E stays `open` and no work task or relation is created

### Requirement: Atomic transitions
A transition, its history entry, and any tasks, pages or relations it creates SHALL be applied together or not at all.

#### Scenario: Failure leaves no partial history
- **WHEN** a transition fails after validation
- **THEN** neither the state change nor a history entry is stored
