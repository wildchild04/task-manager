## MODIFIED Requirements

### Requirement: Block types
A block's type SHALL be one of: `page`, `paragraph`, `heading`, `todo`, `bulleted_list_item`, `numbered_list_item`, `toggle`, `quote`, `divider`, `reference`, `comment`, `suggestion`, `table`, `table_row`, `table_cell`, `code`, `callout`. Each type SHALL define a schema for its props, and props that do not match the schema SHALL be rejected. Type-specific props are:
- `heading`: `level` of 1 to 6
- `todo`: `checked` boolean
- `reference`: `targetId` (see the block-references capability)
- `suggestion`: `action` of `insert`, `replace` or `delete`, and `targetId` (required for `replace` and `delete`, absent for `insert`) (see the agent-suggestions capability)
- `table`: `headerRow` boolean (default true) and `headerColumn` boolean (default false)
- `code`: `language`, a string of at most 32 characters (default empty, meaning plain text)
- `callout`: `emoji`, a single grapheme (default "💡"), and `tone` of `default`, `info`, `success`, `warning` or `error` (default `default`)
- all other types, including `comment`, `table_row` and `table_cell`: no props

A `suggestion` SHALL have no content, and SHALL NOT have `page`, `comment` or `suggestion` blocks among its descendants. A block SHALL NOT be turned into or out of `table`, `table_row` or `table_cell`.

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

### Requirement: Rich-text content
Text-bearing types (`page`, `paragraph`, `heading`, `todo`, `bulleted_list_item`, `numbered_list_item`, `toggle`, `quote`, `table_cell`, `code`, `callout`) SHALL store content as an ordered list of spans. A text span has a `text` string and an optional set of marks (`bold`, `italic`, `underline`, `strikethrough`, `code`, `link` with an `href`). A mention span points at a page by its ID (`mention: { pageId }`), holds exactly one placeholder character (U+FFFC) as its text, and may carry marks other than `link`. A mention's page SHALL exist when the span is written; it MAY be deleted later, after which the mention is missing. Page titles (the content of a `page`) SHALL NOT contain mentions. The content of a `code` block SHALL be plain text: spans without marks or mentions. For a `page`, the content is its title. `divider`, `reference`, `comment`, `table` and `table_row` blocks SHALL have no content.

#### Scenario: Content round-trips unchanged
- **WHEN** a paragraph is stored with spans `[{ text: "Hello " }, { text: "world", marks: ["bold"] }]`
- **THEN** reading the block returns exactly those spans

#### Scenario: Content on a non-text type is rejected
- **WHEN** a `divider` is inserted with non-empty content
- **THEN** the operation is rejected with a validation error

#### Scenario: Mention of an existing page
- **WHEN** a paragraph is stored with `[{ text: "See " }, { text: "￼", mention: { pageId: "doc" } }]` and page `doc` exists
- **THEN** reading the block returns exactly those spans

#### Scenario: Mention of a page that doesn't exist
- **WHEN** a paragraph is written with a mention of a page ID that doesn't exist, or of a block that isn't a page
- **THEN** the operation is rejected with a validation error

#### Scenario: No mentions in titles
- **WHEN** a page's title is written with a mention span
- **THEN** the operation is rejected with a validation error

#### Scenario: Code is plain text
- **WHEN** a `code` block is written with a bold span
- **THEN** the operation is rejected with a validation error

## ADDED Requirements

### Requirement: Table shape
A `table`'s children SHALL be only `table_row` blocks; a `table_row`'s parent SHALL be a `table` and its children only `table_cell` blocks; a `table_cell`'s parent SHALL be a `table_row` and it SHALL have no children. After every batch, each table the batch touched SHALL have at least one row, at least one cell per row, and the same number of cells in every row; a batch that leaves a table otherwise SHALL be rejected whole.

#### Scenario: Adding a column in one batch
- **WHEN** a batch inserts one cell at the end of each of a 2×2 table's two rows
- **THEN** the table has two rows of three cells

#### Scenario: Ragged table is refused
- **WHEN** a batch inserts a cell into only one row of a 2×2 table
- **THEN** the batch is rejected and the table still has two rows of two cells

#### Scenario: Paragraph in a row is refused
- **WHEN** a paragraph is inserted with a `table_row` as its parent
- **THEN** the operation is rejected with a validation error
