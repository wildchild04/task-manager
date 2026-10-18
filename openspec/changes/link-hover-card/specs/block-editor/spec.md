## MODIFIED Requirements

### Requirement: Editing text and marks
Typing, deleting and replacing selected text SHALL change the block's rich text at the caret, keeping the marks of the text around it. Cmd/Ctrl+B, I, U, Shift+S and E SHALL toggle bold, italic, underline, strikethrough and inline code on the selected text; Cmd/Ctrl+K SHALL ask for a URL (focused, saved with Enter) and add a link to the selected text (with the caret on a link and nothing selected, it SHALL edit that whole link, prefilled with its URL), or remove it when the URL is left empty; a URL without a scheme SHALL get `https://`. Typing `@` in that field SHALL list the workspace's pages and library documents matching the text after it, with their place, and choosing one SHALL link the text to that page (`/pages/:pageId`). Editing a link to a page SHALL show it as `@` and the page's title, with that page highlighted, never its ID. Clicking a link in the editor SHALL open an app page in the same tab and any other URL in a new tab. Resting the pointer on a link SHALL show a card under it with where the link goes (the URL; the page's title and place for an app page; or that the page no longer exists) and the actions Open (as clicking the link), Edit (the link dialog for the whole link) and Remove (removes the link and keeps its text, as one undo step). The card SHALL stay open while the pointer is over the link or the card, close shortly after it leaves both, and close on Escape, an outside click, or typing; it SHALL never take focus from the text. Text typed at the end of a marked span SHALL continue with the same marks, except links.

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
