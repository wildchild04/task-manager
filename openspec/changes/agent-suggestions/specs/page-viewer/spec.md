## MODIFIED Requirements

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
| `suggestion` | the highlighted review region of the agent-suggestions capability, with its proposed blocks rendered inside it |

Children of any block SHALL be rendered nested under it.

#### Scenario: Every block type renders
- **WHEN** a page containing one block of every type is opened
- **THEN** each block is rendered with its renderer, in order, with nothing missing

#### Scenario: Numbered lists restart
- **WHEN** two numbered items are followed by a paragraph and then another numbered item
- **THEN** the items are numbered 1, 2 and then 1

### Requirement: Where a page is mentioned
A page opened at `/pages/:pageId` SHALL list, under its content, the places that mention it inline or reference it with a reference block: each other page (with its title, linking to it) and each task whose description does so (with its title and kind, linking to the task). A place SHALL be listed once, with the number of mentions and references when there is more than one. Mentions and references inside the page itself, and those inside pending suggestions, SHALL NOT be listed, and the section SHALL NOT be shown when nothing points at the page.

#### Scenario: Mentioned by a document and a task
- **WHEN** document "Persistence" mentions "Architecture" twice, and work task "Add login" references it with a reference block
- **THEN** the "Architecture" page lists "Persistence" (2 mentions) and the work task "Add login", each linking to its page

#### Scenario: Nothing points at the page
- **WHEN** no other page or task mentions or references a page
- **THEN** the page shows no "Mentioned in" section

#### Scenario: Mention inside a pending suggestion
- **WHEN** the only mention of "Architecture" is inside a pending suggestion on "Persistence", and the suggestion is then approved
- **THEN** "Architecture" shows no "Mentioned in" section before the approval, and lists "Persistence" after it
