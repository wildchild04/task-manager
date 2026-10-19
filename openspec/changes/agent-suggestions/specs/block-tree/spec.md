## MODIFIED Requirements

### Requirement: Block types
A block's type SHALL be one of: `page`, `paragraph`, `heading`, `todo`, `bulleted_list_item`, `numbered_list_item`, `toggle`, `quote`, `divider`, `reference`, `comment`, `suggestion`. Each type SHALL define a schema for its props, and props that do not match the schema SHALL be rejected. Type-specific props are:
- `heading`: `level` of 1, 2 or 3
- `todo`: `checked` boolean
- `reference`: `targetId` (see the block-references capability)
- `suggestion`: `action` of `insert`, `replace` or `delete`, and `targetId` (required for `replace` and `delete`, absent for `insert`) (see the agent-suggestions capability)
- all other types, including `comment`: no props

A `suggestion` SHALL have no content, and SHALL NOT have `page`, `comment` or `suggestion` blocks among its descendants.

#### Scenario: Valid props are accepted
- **WHEN** a `heading` block is inserted with `{ level: 2 }`
- **THEN** the block is stored with those props

#### Scenario: Invalid props are rejected
- **WHEN** a `heading` block is inserted with `{ level: 4 }`
- **THEN** the operation is rejected with a validation error naming the invalid prop

#### Scenario: Unknown type is rejected
- **WHEN** a block is inserted with type `kanban`
- **THEN** the operation is rejected with a validation error

#### Scenario: Replace suggestion needs a target
- **WHEN** a `suggestion` block is inserted with `{ action: "replace" }` and no `targetId`
- **THEN** the operation is rejected with a validation error naming `targetId`
