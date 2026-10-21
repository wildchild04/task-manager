# page-viewer Specification

## Purpose
TBD - created by archiving change app-scaffold. Update Purpose after archive.
## Requirements
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

### Requirement: Rich text marks
Text SHALL be rendered with its marks: bold, italic, underline, strikethrough, inline code, and links (which open their `href`). A mention SHALL be rendered inline as the mentioned page's current title, linking to `/pages/:pageId` in the app, with its marks; a mention of a task (which points at the task's description page) SHALL show the task's current title and link to `/tasks/:taskId`; a mention of a page that no longer exists SHALL be rendered as a "missing page" marker that links nowhere.

#### Scenario: Marks are visible
- **WHEN** a paragraph contains a bold span and a link span
- **THEN** the bold span is rendered bold and the link span is rendered as a link to its `href`

#### Scenario: Mention follows a rename
- **WHEN** a paragraph mentions page "Architecture", which is then renamed "System design"
- **THEN** the paragraph shows "System design", linking to that page

#### Scenario: Mention of a deleted page
- **WHEN** a paragraph mentions a page that is then deleted
- **THEN** the paragraph shows a missing-page marker in its place

#### Scenario: Mention of a task
- **WHEN** a paragraph mentions the work task "Add login", which is then renamed "Add passkey login"
- **THEN** the paragraph shows "Add passkey login", linking to the task's page

### Requirement: References
A `reference` block SHALL be resolved on the server with the page's expansion path. A reference to a page SHALL render as a link to that page; a reference to another block SHALL render that block's content inline; a missing target SHALL render as a "missing reference" notice; a cycle SHALL render as a "circular reference" notice instead of expanding.

#### Scenario: Missing reference
- **WHEN** a page contains a reference whose target was deleted
- **THEN** the page renders, showing a missing-reference notice where the reference is

#### Scenario: Circular reference
- **WHEN** a page contains a reference to itself
- **THEN** the page renders, showing a circular-reference notice where the reference is

### Requirement: Owned pages are not browsable
The viewer SHALL open workspace pages, a project's home page, the project's knowledge library documents, and pages nested under any of them. Other owned roots (task body pages and comment bodies) and their content SHALL NOT be opened through `/pages/:pageId`; a task's body is shown on its task overview. A page SHALL show a breadcrumb of where it is, each ancestor linked: for a library document, the project, "Knowledge library", then the documents containing it; for a page under the project's home page, the project then the pages containing it; for a nested workspace page, the pages containing it. A top-level workspace page SHALL show no breadcrumb.

#### Scenario: Owned root
- **WHEN** `/pages/:pageId` is opened with the ID of a task's body page
- **THEN** a not-found page is shown

#### Scenario: Library document
- **WHEN** `/pages/:pageId` is opened with the ID of a document "Persistence" inside "Architecture" in project P's library
- **THEN** the document is shown with the breadcrumb P › Knowledge library › Architecture › Persistence, where P links to the project home, "Knowledge library" to the library page and "Architecture" to its page

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

### Requirement: Images
An image block SHALL render as its image with its alt text, loaded lazily, scaled to fit the page's width without distortion: an uploaded image from its stored item's URL, an external one from its URL. An image that can't be loaded SHALL show the image component's error state with the alt text instead of a broken picture.

#### Scenario: An uploaded image
- **WHEN** a page with an image block holding an uploaded PNG is opened
- **THEN** the image is shown from its `/content/` URL with its alt text

#### Scenario: A broken external image
- **WHEN** an image block's external URL answers 404
- **THEN** the error state shows in its place, with the alt text
