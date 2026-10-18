## MODIFIED Requirements

### Requirement: Mentioning pages with @
Typing `@` in a text block other than the title, at its start or after a space, SHALL open a menu at the caret listing workspace pages, library documents and tasks whose title matches the text typed after `@`, each with its place (its project and parent page; for a task, "Task", its kind and its project) to tell same-named entries apart. It SHALL page five at a time and use the slash menu's keys (↑ ↓ to move, Tab/Shift+Tab or Page Down/Up to turn the page, Enter to choose, Escape to close keeping the text); clicking a page SHALL choose it. Choosing a page or task SHALL replace the `@` and the typed text with a mention of it followed by a space, as one undo step. The menu SHALL close when the caret leaves the typed text or the `@` is deleted, and SHALL say when no page matches.

#### Scenario: Mention a page
- **WHEN** "@arch" is typed in a paragraph and Enter is pressed with "Architecture" highlighted
- **THEN** the paragraph contains a mention of "Architecture" followed by a space, with the caret after the space

#### Scenario: No matching page
- **WHEN** "@zzzz" is typed
- **THEN** the menu says no page matches, and Escape leaves "@zzzz" in the text

#### Scenario: Mention a task
- **WHEN** "@login" is typed and the work task "Add login" is chosen
- **THEN** the paragraph contains a mention showing "Add login" that opens the task's page when clicked

### Requirement: Editing text and marks
Typing, deleting and replacing selected text SHALL change the block's rich text at the caret, keeping the marks of the text around it. Cmd/Ctrl+B, I, U, Shift+S and E SHALL toggle bold, italic, underline, strikethrough and inline code on the selected text; Cmd/Ctrl+K SHALL ask for a URL (focused, saved with Enter) and add a link to the selected text (with the caret on a link and nothing selected, it SHALL edit that whole link, prefilled with its URL), or remove it when the URL is left empty; a URL without a scheme SHALL get `https://`. Typing `@` in that field SHALL list the workspace's pages, library documents and tasks matching the text after it, with their place, and choosing one SHALL link the text to it (`/pages/:pageId` or `/tasks/:taskId`). Editing a link to a page or task SHALL show it as `@` and its title, with it highlighted, never its ID. Clicking a link in the editor SHALL open an app page in the same tab and any other URL in a new tab. Resting the pointer on a link SHALL show a card under it with where the link goes (the URL; the title and place for a page or task of the app; or that it no longer exists) and the actions Open (as clicking the link), Edit (the link dialog for the whole link) and Remove (removes the link and keeps its text, as one undo step). The card SHALL stay open while the pointer is over the link or the card, close shortly after it leaves both, and close on Escape, an outside click, or typing; it SHALL never take focus from the text. Text typed at the end of a marked span SHALL continue with the same marks, except links.

#### Scenario: Bold a word
- **WHEN** a word is selected and Cmd/Ctrl+B is pressed
- **THEN** the word is bold, the rest of the text is unchanged, and the change is saved

#### Scenario: Link to a page
- **WHEN** a word is selected, Cmd/Ctrl+K is pressed, "@Archi" is typed and Enter is pressed
- **THEN** the word links to the "Architecture" document, and clicking it opens that document in the same tab

#### Scenario: Accented input
- **WHEN** "é" is typed with a dead key or input method
- **THEN** the block contains "é" once and the caret is after it

#### Scenario: Link card
- **WHEN** the pointer rests on a link to "https://google.com"
- **THEN** a card under the link shows "https://google.com" with Open, Edit and Remove, and moving the pointer onto the card keeps it open

#### Scenario: Remove a link from its card
- **WHEN** Remove is chosen in a link's card
- **THEN** the text stays without the link, the card closes, and undo brings the link back

#### Scenario: Edit a link from its card
- **WHEN** Edit is chosen in a link's card
- **THEN** the link dialog opens for the whole link, prefilled with its URL (or `@` and the page's title)
