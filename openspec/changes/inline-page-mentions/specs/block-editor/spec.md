## ADDED Requirements

### Requirement: Mentioning pages with @
Typing `@` in a text block other than the title, at its start or after a space, SHALL open a menu at the caret listing workspace pages and library documents whose title matches the text typed after `@`, each with its place (its project and parent page) to tell same-named pages apart. It SHALL page five at a time and use the slash menu's keys (↑ ↓ to move, Tab/Shift+Tab or Page Down/Up to turn the page, Enter to choose, Escape to close keeping the text); clicking a page SHALL choose it. Choosing a page SHALL replace the `@` and the typed text with a mention of that page followed by a space, as one undo step. The menu SHALL close when the caret leaves the typed text or the `@` is deleted, and SHALL say when no page matches.

#### Scenario: Mention a page
- **WHEN** "@arch" is typed in a paragraph and Enter is pressed with "Architecture" highlighted
- **THEN** the paragraph contains a mention of "Architecture" followed by a space, with the caret after the space

#### Scenario: No matching page
- **WHEN** "@zzzz" is typed
- **THEN** the menu says no page matches, and Escape leaves "@zzzz" in the text

### Requirement: Editing around mentions
A mention SHALL behave as one character: the caret moves over it with one arrow press, Backspace after it or Delete before it removes the whole mention, a selection containing it can be deleted, marked or replaced, and splitting or merging blocks keeps it intact. Clicking a mention SHALL open its page in the app. The caret SHALL never be placed inside a mention.

#### Scenario: Delete a mention
- **WHEN** the caret is right after a mention and Backspace is pressed
- **THEN** the whole mention is removed, and undo brings it back

#### Scenario: Open the mentioned page
- **WHEN** a mention in the editor is clicked
- **THEN** the browser opens the mentioned page in the app
