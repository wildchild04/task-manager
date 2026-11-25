## MODIFIED Requirements

### Requirement: Rich text marks
Text SHALL be rendered with its marks: bold, italic, underline, strikethrough, inline code, and links (which open their `href`). Inline code SHALL be rendered in Cloudscape's monospace font, slightly smaller than the text around it, on Cloudscape's code background with a thin border and rounded corners from Cloudscape tokens, following light and dark mode, the same in pages, task descriptions, comments and table cells. A mention SHALL be rendered inline as the mentioned page's current title, linking to `/pages/:pageId` in the app, with its marks; a mention of a task (which points at the task's description page) SHALL show the task's current title and link to `/tasks/:taskId`; a mention of a page that no longer exists SHALL be rendered as a "missing page" marker that links nowhere. A mention that carries its own label SHALL show the label in place of the title, with the target's current full title shown on hover; a mention without a label SHALL show the current title and need no such hover.

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

#### Scenario: Labelled mention shows its label

- **WHEN** a paragraph has a mention of the work task "Add login" carrying the label "login"
- **THEN** the paragraph shows "login", linking to the task's page, with "Add login" shown on hover

#### Scenario: Inline code is visible

- **WHEN** an agent writes "Say `this should render different` ok" in a task's description or a comment
- **THEN** "this should render different" is shown as inline code (monospace, on the code background), in the description, the comment and a table cell alike
