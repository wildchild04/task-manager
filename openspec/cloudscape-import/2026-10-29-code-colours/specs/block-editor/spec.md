## MODIFIED Requirements

### Requirement: Editing code blocks
In a code block, Enter SHALL insert a new line, Tab SHALL insert two spaces, and Shift+Tab SHALL remove up to two spaces at the start of the caret's line. Cmd/Ctrl+Enter SHALL add a paragraph after the code block and move the caret there; in a table cell it SHALL do the same after the table. Mark shortcuts, links, the `/` menu and the `@` menu SHALL NOT apply in code; pasted text SHALL be kept as plain text, line breaks included. A code block SHALL offer choosing its language from common languages and "Plain text", showing any other language it has as written. Code in ts, tsx (as TypeScript), js, json, sh, python, go, rust, html, css, yaml or md SHALL be shown in syntax colours while it is edited, with the colours of Cloudscape's code view for the current light or dark mode: a coloured copy is drawn under the text, which stays plain (its caret, selection, typing, undo, copy and paste unchanged) and stays the same element as colours come and go. Plain text, sql and other languages SHALL stay uncoloured.

#### Scenario: Indent a line
- **WHEN** the caret is in a code block and Tab is pressed
- **THEN** two spaces are inserted at the caret and the block stays a code block

#### Scenario: Leave a code block
- **WHEN** Cmd/Ctrl+Enter is pressed in a code block
- **THEN** an empty paragraph follows the code block and holds the caret

#### Scenario: Colours while typing
- **WHEN** a code block's language is "ts" and `const greeting = "hi";` is typed into it
- **THEN** `"hi"` is shown in the code view's string colour, aligned with the typed text, and the block's text is `const greeting = "hi";`

#### Scenario: Plain text stays plain
- **WHEN** that block's language is changed to "Plain text"
- **THEN** it shows no colours and its text is unchanged

#### Scenario: Dark mode
- **WHEN** the page is opened in dark mode
- **THEN** the code is coloured with the code view's dark theme
