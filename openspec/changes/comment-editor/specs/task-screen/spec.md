## MODIFIED Requirements

### Requirement: Comments on the task page
Work and chore pages SHALL show the task's comments oldest first, each with its author ("You" or the agent's name), its time, an "Edited" marker once edited, and its content rendered like page content (including marks, links and mentions). Each comment SHALL be addressable at `#comment-<id>`. The page SHALL offer writing a new comment with the block editor (every block type except pages, marks, links, `@` mentions, the slash menu and markdown shortcuts), posted with a "Comment" button or Cmd/Ctrl+Enter; nothing is saved until it is posted, and an empty comment SHALL be rejected. Each comment SHALL offer editing it in place with the same editor, saving as it is edited and marking it edited, until "Done"; and deleting after a confirmation. Exploration and update pages SHALL not show comments.

#### Scenario: Add a comment
- **WHEN** a comment with a paragraph "First line" and a bulleted item "Second point" is written and posted on a work task
- **THEN** the work task's comments end with a comment by "You" with that paragraph and that bulleted item, and the new-comment editor is empty again

#### Scenario: Empty comment
- **WHEN** an empty comment is posted
- **THEN** no comment is added and the editor shows that the comment is empty

#### Scenario: Edit a comment
- **WHEN** a comment's text is changed in place to "Updated text" and "Done" is pressed
- **THEN** its content is "Updated text", it shows as edited, and it is read-only again

#### Scenario: Mention in a comment
- **WHEN** a comment mentioning the document "Architecture" is posted
- **THEN** the comment shows "Architecture" linking to that document

#### Scenario: Delete a comment
- **WHEN** a comment is deleted and the deletion confirmed
- **THEN** it is no longer listed

#### Scenario: Explorations have no comments
- **WHEN** an exploration's page is opened
- **THEN** it shows no comments section
