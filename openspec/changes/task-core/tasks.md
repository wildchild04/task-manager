## 1. Prerequisites

- [ ] 1.1 Confirm `block-data-model` and `project-structure` are applied (projects exist)
- [ ] 1.2 Add the `UnitOfWork` port (`run(fn)` with block and task repositories bound to one transaction), with SQLite (outer transaction, nested savepoints) and in-memory (snapshot and restore) implementations
- [ ] 1.3 Make the block repositories constructible inside a unit of work, and register the `task` owner kind with the block protection hook (body pages editable, not deletable)

## 2. Domain model

- [ ] 2.1 Define `Task`, `TaskKind`, `Actor` (human | agent with name), `Transition`, `TransitionRecord` and `Relation` types in `src/domain/tasks/types.ts`
- [ ] 2.2 Define the `KindDefinition` shape (states, initial, terminal, transitions with input schema and effect, attribute schema) and the kind registry
- [ ] 2.3 Write the four kind definitions from the lifecycle table (attribute schemas empty for now)
- [ ] 2.4 Define relation type rules: `born_from` and `iterates_on` (kinds, target state, cardinality, same project, permanent) and `references` (registered entity kinds `task` and `block` with resolvers, any project, no self or duplicate, editable)
- [ ] 2.5 Unit-test that every kind definition is consistent: the initial state exists, every transition's states exist, and terminal states have no outgoing transitions

## 3. Repository port and contract tests

- [ ] 3.1 Define the `TaskRepository` interface: create, get, list by project/kind/state, update state, append transition, read history, add/remove relation, list outgoing and incoming relations, lineage
- [ ] 3.2 Write the shared contract suite covering every scenario in task-entity, task-lifecycle and task-relations
- [ ] 3.3 Implement `MemoryTaskRepository` and pass the suite
- [ ] 3.4 Write the migration for `tasks`, `task_transitions` and `task_relations` with their indexes
- [ ] 3.5 Implement `SqliteTaskRepository`, including the recursive-CTE lineage query, and pass the suite

## 4. Service

- [ ] 4.1 Implement `TaskService.create` (task plus body page in one unit of work, attribute validation, required relations such as `iterates_on`)
- [ ] 4.2 Implement `TaskService.transition` (current-state check, input validation, effect, state write, history append)
- [ ] 4.3 Implement the `promote` effect (create work, its body page and `born_from`)
- [ ] 4.4 Implement title reads through the body page, and `references` add/remove with missing-page resolution
- [ ] 4.5 Implement `return` for work: required non-empty reason, optional body-page batch applied in the same unit of work
- [ ] 4.6 Add the `scope` input (`occurrence` | `series`) to chore `cancel`, rejecting `series` for chores without a schedule
- [ ] 4.7 Test atomicity: a failure inside create, promote or any transition leaves tasks, blocks, relations and history unchanged
- [ ] 4.8 Confirm `typecheck` and the full test suite pass
