## 1. Prerequisites

- [x] 1.1 Confirm `block-data-model` and `project-structure` are applied (projects exist)
- [x] 1.2 Extend the `UnitOfWork` (added by `project-structure`) with the task repository, and register the in-memory task repository for snapshot and restore
- [x] 1.3 Register the `task` owner kind with the block protection hook (body pages editable, not deletable) and the `task` project resolver in `LibraryService`

## 2. Domain model

- [x] 2.1 Define `Task`, `TaskKind`, `Actor` (human | agent with name), `Transition`, `TransitionRecord` and `Relation` types in `src/domain/tasks/types.ts`
- [x] 2.2 Define the `KindDefinition` shape (states, initial, terminal, transitions with input schema and effect, attribute schema) and the kind registry
- [x] 2.3 Write the four kind definitions from the lifecycle table (attribute schemas empty for now)
- [x] 2.4 Define relation type rules: `born_from` and `iterates_on` (kinds, target state, cardinality, same project, permanent) and `references` (registered entity kinds `task` and `block` with resolvers, any project, no self or duplicate, editable)
- [x] 2.5 Unit-test that every kind definition is consistent: the initial state exists, every transition's states exist, and terminal states have no outgoing transitions

## 3. Repository port and contract tests

- [x] 3.1 Define the `TaskRepository` interface: create, get, list by project/kind/state, update state, append transition, read history, add/remove relation, list outgoing and incoming relations, lineage
- [x] 3.2 Write the shared contract suite covering every scenario in task-entity, task-lifecycle and task-relations
- [x] 3.3 Implement `MemoryTaskRepository` and pass the suite
- [x] 3.4 Write the migration for `tasks`, `task_transitions` and `task_relations` with their indexes
- [x] 3.5 Implement `SqliteTaskRepository` and pass the suite (lineage is computed in the service, see design 7)

## 4. Service

- [x] 4.1 Implement `TaskService.create` (task plus body page in one unit of work, attribute validation, required relations such as `iterates_on`)
- [x] 4.2 Implement `TaskService.transition` (current-state check, input validation, effect, state write, history append)
- [x] 4.3 Implement the `promote` effect (create work, its body page and `born_from`)
- [x] 4.4 Implement title reads through the body page, and `references` add/remove with missing-page resolution
- [x] 4.5 Implement `return` for work: required non-empty reason, optional body-page batch applied in the same unit of work
- [x] 4.6 Add the `scope` input (`occurrence` | `series`) to chore `cancel`, rejecting `series` for chores without a schedule
- [x] 4.7 Test atomicity: a failure inside create, promote or any transition leaves tasks, blocks, relations and history unchanged
- [x] 4.8 Confirm `typecheck` and the full test suite pass
