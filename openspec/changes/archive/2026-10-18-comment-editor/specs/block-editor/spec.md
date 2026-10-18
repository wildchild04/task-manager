## MODIFIED Requirements

### Requirement: Editable surfaces
The editor SHALL edit the title and blocks of: pages opened at `/pages/:pageId` (library documents and workspace pages, nested or not), a project's home page on `/projects/:projectId`, and a task's body page on `/tasks/:taskId` (its title is the task's title). It SHALL also edit comments on a task's page: a new comment as a draft that is only saved when posted, and an existing comment's content (it has no title) while it is being edited, saved through the comment service so it is marked edited. The server SHALL render these pages read-only, and they SHALL become editable once loaded in the browser, with the same content in the same place. Sub-pages inside an edited page SHALL not have their own content edited there; they open their own page.

#### Scenario: Edit a library document
- **WHEN** a library document is opened and a word is typed into its first paragraph
- **THEN** the paragraph shows the word at once, and after reloading the page it is still there

#### Scenario: Rename a task
- **WHEN** a task's title is changed on its page to "Add passkey login"
- **THEN** the task lists, the dashboard and the breadcrumb show "Add passkey login"

#### Scenario: Draft comment isn't saved
- **WHEN** text is written in the new-comment editor and the page is reloaded without posting
- **THEN** no comment was added

### Requirement: Block type functions
A todo's checkbox SHALL check and uncheck it, and the change SHALL be saved. A toggle's arrow SHALL open and close it, hiding its children while closed; toggles SHALL start folded when a page or comment is opened, toggles created while editing SHALL start open (so Enter goes inside them), and the open state SHALL not be saved. Sub-page and page-reference blocks SHALL open their page when clicked. Dividers, sub-pages and references SHALL never hold the caret.

#### Scenario: Check a todo
- **WHEN** an unchecked todo's checkbox is clicked
- **THEN** it is checked, and it is still checked after reloading

#### Scenario: Close a toggle
- **WHEN** an open toggle's arrow is clicked
- **THEN** its children are hidden, and the arrow shows it is closed

#### Scenario: Toggles start folded
- **WHEN** a page with a toggle that has children is opened
- **THEN** the toggle is folded and its children are hidden until its arrow is clicked
