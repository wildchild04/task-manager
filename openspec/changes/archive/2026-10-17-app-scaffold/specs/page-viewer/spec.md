## ADDED Requirements

### Requirement: Read-only page rendering
`/pages/:pageId` SHALL render the page's title and its block tree, in order, using design-system components. Each block type SHALL have a renderer:

| Block type | Rendered as |
|---|---|
| `paragraph` | body text |
| `heading` | heading of level 1–3 below the page title |
| `todo` | read-only checkbox with its text, checked state shown |
| `bulleted_list_item`, `numbered_list_item` | list items; consecutive numbered items are numbered from 1 |
| `toggle` | its text with its children shown expanded |
| `quote` | quote |
| `divider` | divider |
| `page` (nested) | link to the sub-page |
| `reference` | the resolved target (see below) |

Children of any block SHALL be rendered nested under it.

#### Scenario: Every block type renders
- **WHEN** a page containing one block of every type is opened
- **THEN** each block is rendered with its renderer, in order, with nothing missing

#### Scenario: Numbered lists restart
- **WHEN** two numbered items are followed by a paragraph and then another numbered item
- **THEN** the items are numbered 1, 2 and then 1

### Requirement: Rich text marks
Text SHALL be rendered with its marks: bold, italic, underline, strikethrough, inline code, and links (which open their `href`).

#### Scenario: Marks are visible
- **WHEN** a paragraph contains a bold span and a link span
- **THEN** the bold span is rendered bold and the link span is rendered as a link to its `href`

### Requirement: References
A `reference` block SHALL be resolved on the server with the page's expansion path. A reference to a page SHALL render as a link to that page; a reference to another block SHALL render that block's content inline; a missing target SHALL render as a "missing reference" notice; a cycle SHALL render as a "circular reference" notice instead of expanding.

#### Scenario: Missing reference
- **WHEN** a page contains a reference whose target was deleted
- **THEN** the page renders, showing a missing-reference notice where the reference is

#### Scenario: Circular reference
- **WHEN** a page contains a reference to itself
- **THEN** the page renders, showing a circular-reference notice where the reference is

### Requirement: Owned pages are not browsable
The viewer SHALL only open workspace pages and pages nested under them. An owned root (such as a future task body page) SHALL NOT be opened through `/pages/:pageId` in this change.

#### Scenario: Owned root
- **WHEN** `/pages/:pageId` is opened with the ID of an owned root page
- **THEN** a not-found page is shown
