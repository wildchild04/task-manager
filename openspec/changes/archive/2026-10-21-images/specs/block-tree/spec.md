## MODIFIED Requirements

### Requirement: Block types
A block's type SHALL be one of: `page`, `paragraph`, `heading`, `todo`, `bulleted_list_item`, `numbered_list_item`, `toggle`, `quote`, `divider`, `reference`, `comment`, `suggestion`, `table`, `table_row`, `table_cell`, `code`, `callout`, `image`. Each type SHALL define a schema for its props, and props that do not match the schema SHALL be rejected. Type-specific props are:
- `heading`: `level` of 1 to 6
- `todo`: `checked` boolean
- `reference`: `targetId` (see the block-references capability)
- `suggestion`: `action` of `insert`, `replace` or `delete`, and `targetId` (required for `replace` and `delete`, absent for `insert`) (see the agent-suggestions capability)
- `table`: `headerRow` boolean (default true) and `headerColumn` boolean (default false)
- `code`: `language`, a string of at most 32 characters (default empty, meaning plain text)
- `callout`: `emoji`, a single grapheme (default "💡"), and `tone` of `default`, `info`, `success`, `warning` or `error` (default `default`)
- `image`: exactly one source, either `contentId` (a stored item's ID, see the content-storage capability) or `url` (an `http:` or `https:` URL of at most 2,048 characters), and `alt`, a string of at most 1,000 characters (default empty)
- all other types, including `comment`, `table_row` and `table_cell`: no props

A `suggestion` SHALL have no content, and SHALL NOT have `page`, `comment` or `suggestion` blocks among its descendants. An `image` SHALL have no content and no children. A block SHALL NOT be turned into or out of `table`, `table_row` or `table_cell`.

#### Scenario: Valid props are accepted
- **WHEN** a `heading` block is inserted with `{ level: 5 }`
- **THEN** the block is stored with those props

#### Scenario: Invalid props are rejected
- **WHEN** a `heading` block is inserted with `{ level: 7 }`
- **THEN** the operation is rejected with a validation error naming the invalid prop

#### Scenario: Unknown type is rejected
- **WHEN** a block is inserted with type `kanban`
- **THEN** the operation is rejected with a validation error

#### Scenario: Replace suggestion needs a target
- **WHEN** a `suggestion` block is inserted with `{ action: "replace" }` and no `targetId`
- **THEN** the operation is rejected with a validation error naming `targetId`

#### Scenario: Callout defaults
- **WHEN** a `callout` is inserted without props
- **THEN** it is stored with `{ emoji: "💡", tone: "default" }`

#### Scenario: An image needs one source
- **WHEN** an `image` block is inserted with both `contentId` and `url`, or with neither, or with a `url` of `javascript:alert(1)`
- **THEN** the operation is rejected with a validation error
