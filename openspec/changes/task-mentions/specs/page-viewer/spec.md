## MODIFIED Requirements

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
