# task-relations Specification

## Purpose
TBD - created by archiving change task-core. Update Purpose after archive.
## Requirements
### Requirement: Relation types
Relations SHALL be typed and directed. The allowed types are:

| Type | From | To | Rules |
|---|---|---|---|
| `born_from` | work | exploration or update | at most one per work; created only by `promote`; same project; permanent |
| `iterates_on` | update | work in state `done` | exactly one per update, given when the update is created; same project; permanent |
| `references` | any task | any referenceable entity | zero or more; any project; may be added or removed at any time |

A relation that breaks its type's rules SHALL be rejected. A task SHALL NOT reference itself, and the same target SHALL NOT be referenced twice by the same task.

#### Scenario: Update requires done work
- **WHEN** an update is created iterating on a work task that is `in_progress`
- **THEN** creation is rejected

#### Scenario: Update without a target
- **WHEN** an update is created with no `iterates_on` target
- **THEN** creation is rejected

#### Scenario: born_from cannot be added by hand
- **WHEN** a `born_from` relation is added outside of `promote`
- **THEN** it is rejected

#### Scenario: Start an exploration from several sources
- **WHEN** a new exploration is created referencing tombstoned exploration T, open update U in another project, and knowledge library page K
- **THEN** the exploration is `open` with its own body page and three `references` relations, and T stays `tombstoned`

#### Scenario: References can change
- **WHEN** a page is added to and later removed from a work task's references
- **THEN** the work task's references reflect each change

#### Scenario: Self-reference is rejected
- **WHEN** a task adds a reference to itself
- **THEN** it is rejected

### Requirement: Referenceable entities
The target of a `references` relation SHALL be a typed entity reference: an entity kind plus an ID. In this change the referenceable kinds are `task` (any kind, in any state, including cancelled and tombstoned) and `block` (any block, from a whole page down to a single paragraph). Later changes SHALL be able to add referenceable kinds (for example subtasks, comments and log entries) without changing existing relations. Anything that describes a problem or a gap can therefore be the starting point of an exploration or update.

#### Scenario: Reference a cancelled work task
- **WHEN** a new update references a cancelled work task
- **THEN** the reference is created

#### Scenario: Reference a single paragraph
- **WHEN** a new exploration references one paragraph block inside a knowledge library page
- **THEN** the reference points at that paragraph, not at the whole page

#### Scenario: Unknown entity kind
- **WHEN** a reference names an entity kind that is not registered
- **THEN** it is rejected

### Requirement: Lineage relations are permanent
`born_from` and `iterates_on` SHALL never be changed or removed once created, and SHALL stay valid when the states of the tasks they connect change later.

#### Scenario: Lineage relation cannot be removed
- **WHEN** removal of a `born_from` relation is requested
- **THEN** it is rejected

### Requirement: Missing reference targets
If a referenced entity that can be deleted (such as a block) is deleted, the reference SHALL remain and resolve as missing, consistent with block references. Tasks are never deleted, so task targets always resolve.

#### Scenario: Referenced block deleted
- **WHEN** a block referenced by a work task is deleted
- **THEN** listing the work task's references returns that entry marked missing

### Requirement: Lineage
Given any exploration, update or work task, the system SHALL return its lineage: the tree of tasks connected through `born_from` and `iterates_on`, from its root exploration through every work and update that follows, each with its kind and state. Several updates MAY iterate on the same done work, so the lineage SHALL be a tree, with siblings ordered by creation time. `references` relations SHALL NOT be part of the lineage.

#### Scenario: Linear history
- **WHEN** exploration E was promoted to work W1, update U1 iterates on W1, and U1 was promoted to work W2
- **THEN** the lineage of any of E, W1, U1 or W2 is `E → W1 → U1 → W2`

#### Scenario: Branching history
- **WHEN** updates U1 and U2 both iterate on done work W1
- **THEN** the lineage shows W1 with two children, U1 then U2

### Requirement: Incoming relations
The system SHALL list relations pointing at a task or page, by type, for example the updates iterating on a work task, or every task referencing a tombstoned idea.

#### Scenario: Tasks referencing a tombstoned idea
- **WHEN** explorations N1 and N2 both reference tombstoned exploration T
- **THEN** listing incoming `references` for T returns N1 and N2

