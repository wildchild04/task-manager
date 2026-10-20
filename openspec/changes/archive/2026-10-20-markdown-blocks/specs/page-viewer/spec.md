## MODIFIED Requirements

### Requirement: Read-only page rendering
`/pages/:pageId` SHALL render the page's title and its block tree, in order, using design-system components. Each block type SHALL have a renderer:

| Block type | Rendered as |
|---|---|
| `paragraph` | body text |
| `heading` | heading of level 1–6 below the page title (levels 5 and 6 share the smallest heading size) |
| `todo` | read-only checkbox with its text, checked state shown |
| `bulleted_list_item`, `numbered_list_item` | list items; consecutive numbered items are numbered from 1 |
| `toggle` | its text with its children shown expanded |
| `quote` | quote |
| `divider` | divider |
| `page` (nested) | link to the sub-page |
| `reference` | the resolved target (see below) |
| `suggestion` | the highlighted review region of the agent-suggestions capability, with its proposed blocks rendered inside it |
| `table` | a table: its rows and cells' rich text in a grid, the first row as column headers when `headerRow`, the first cell of each row as a row header when `headerColumn`; wide tables scroll horizontally inside the page |
| `code` | monospace code with its language, preserving lines and spaces, with a copy button |
| `callout` | a tinted box of its tone with its emoji, its text, and its children nested inside |

Children of any block SHALL be rendered nested under it.

#### Scenario: Every block type renders
- **WHEN** a page containing one block of every type is opened
- **THEN** each block is rendered with its renderer, in order, with nothing missing

#### Scenario: Numbered lists restart
- **WHEN** two numbered items are followed by a paragraph and then another numbered item
- **THEN** the items are numbered 1, 2 and then 1

#### Scenario: Table with a header row
- **WHEN** a page with a 3-row table whose `headerRow` is true is opened
- **THEN** the first row is shown as column headers and the other two as rows, at phone width too without the page scrolling sideways
