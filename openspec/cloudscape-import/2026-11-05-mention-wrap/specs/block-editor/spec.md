## MODIFIED Requirements

### Requirement: Editing around mentions
A mention SHALL behave as one character: the caret moves over it with one arrow press, Backspace after it or Delete before it removes the whole mention, a selection containing it can be deleted, marked or replaced, and splitting or merging blocks keeps it intact. Clicking a mention SHALL open its page in the app. A mention whose title is longer than the room it has SHALL wrap like the text around it, so it never widens a table column or the page on its own. The caret SHALL never be placed inside a mention.

#### Scenario: Delete a mention
- **WHEN** the caret is right after a mention and Backspace is pressed
- **THEN** the whole mention is removed, and undo brings it back

#### Scenario: Open the mentioned page
- **WHEN** a mention in the editor is clicked
- **THEN** the browser opens the mentioned page in the app

#### Scenario: Long mention in a table cell
- **WHEN** a page's table has a cell mentioning a task whose title is over 100 characters
- **THEN** in the editor the title wraps onto several lines inside the cell, and the table fits the page without scrolling sideways
