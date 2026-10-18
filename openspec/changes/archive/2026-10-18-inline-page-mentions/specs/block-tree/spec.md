## MODIFIED Requirements

### Requirement: Rich-text content
Text-bearing types (`page`, `paragraph`, `heading`, `todo`, `bulleted_list_item`, `numbered_list_item`, `toggle`, `quote`) SHALL store content as an ordered list of spans. A text span has a `text` string and an optional set of marks (`bold`, `italic`, `underline`, `strikethrough`, `code`, `link` with an `href`). A mention span points at a page by its ID (`mention: { pageId }`), holds exactly one placeholder character (U+FFFC) as its text, and may carry marks other than `link`. A mention's page SHALL exist when the span is written; it MAY be deleted later, after which the mention is missing. Page titles (the content of a `page`) SHALL NOT contain mentions. For a `page`, the content is its title. `divider`, `reference` and `comment` blocks SHALL have no content.

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
