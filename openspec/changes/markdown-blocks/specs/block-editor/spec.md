## MODIFIED Requirements

### Requirement: Block types declare their editing behavior
Each block type SHALL declare, in one place, whether it holds text and what Enter, Enter on an empty block, and Backspace at the start do. The editor SHALL follow these declarations without type-specific code elsewhere:

| Type | Text | Enter | Enter when empty | Backspace at start |
|---|---|---|---|---|
| paragraph | yes | new paragraph | new paragraph | merge into previous |
| heading 1–6 | yes | new paragraph | new paragraph | becomes paragraph |
| bulleted / numbered list item | yes | same type | becomes paragraph | becomes paragraph |
| todo | yes | new unchecked todo | becomes paragraph | becomes paragraph |
| toggle | yes | first child if open, else new paragraph | becomes paragraph | becomes paragraph |
| quote | yes | new paragraph | becomes paragraph | becomes paragraph |
| callout | yes | new paragraph after it | becomes paragraph | becomes paragraph |
| code | yes (plain text) | new line inside | new line inside | becomes paragraph when empty, else nothing |
| table cell | yes | cell below (see "Editing tables") | cell below | nothing |
| divider | no | — | — | — |
| sub-page | no (shows its title) | — | — | — |
| reference | no (shows its target) | — | — | — |
| suggestion | no (shows the proposed change, see agent-suggestions) | — | — | — |
| table, table row | no (hold rows and cells) | — | — | — |

A suggestion and the blocks inside it SHALL never hold the caret; the caret moves past a suggestion as it does past a divider, Tab SHALL NOT nest a block into a suggestion, and Backspace at the start of the block after a suggestion SHALL move the caret to the end of the previous text block without removing the suggestion. Backspace at the start of the block after a table SHALL likewise move the caret to the table's last cell without removing the table.

#### Scenario: Leaving a list
- **WHEN** Enter is pressed in an empty bulleted list item
- **THEN** the item becomes a paragraph at the same position

#### Scenario: Heading continues as a paragraph
- **WHEN** Enter is pressed at the end of a heading
- **THEN** a new paragraph follows the heading and holds the caret

#### Scenario: Backspace after a suggestion
- **WHEN** Backspace is pressed at the start of a paragraph that follows a suggestion
- **THEN** the suggestion is still there, and the caret is at the end of the text block before it

#### Scenario: Backspace after a table
- **WHEN** Backspace is pressed at the start of a paragraph that follows a table
- **THEN** the table is still there, and the caret is at the end of its last cell

### Requirement: Markdown shortcuts change the type
Typing one of these at the start of a paragraph, followed by a space, SHALL remove the typed characters and change the block's type, keeping the rest of its text: `#` heading 1, `##` heading 2, `###` heading 3, `####` heading 4, `#####` heading 5, `######` heading 6, `-` or `*` bulleted list item, `1.` numbered list item, `[]` unchecked todo, `>` quote. Typing `---` in an empty paragraph SHALL turn it into a divider followed by a new empty paragraph holding the caret. Typing ```` ``` ```` (optionally followed by a language) in an empty paragraph and pressing Enter SHALL turn it into an empty code block of that language holding the caret. Undo right after a shortcut SHALL restore the typed characters and the paragraph.

#### Scenario: Make a heading
- **WHEN** "# " is typed at the start of an empty paragraph
- **THEN** it becomes an empty heading 1 holding the caret

#### Scenario: Make a level 4 heading
- **WHEN** "#### " is typed at the start of a paragraph "Glossary"
- **THEN** it becomes a heading 4 containing "Glossary"

#### Scenario: Make a code block
- **WHEN** "```ts" is typed in an empty paragraph and Enter is pressed
- **THEN** it becomes an empty code block with language "ts" holding the caret

#### Scenario: Undo a shortcut
- **WHEN** "- " turns a paragraph into a list item and Cmd/Ctrl+Z is pressed
- **THEN** the paragraph is back, containing "- "

### Requirement: Slash menu
Typing `/` in a text block other than the title, a table cell or a code block, at its start or after a space, SHALL open a menu at the caret listing: Text, Heading 1, Heading 2, Heading 3, Heading 4, Heading 5, Heading 6, Bulleted list, Numbered list, To-do, Toggle, Quote, Callout, Code, Table and Divider. The menu SHALL show the matching commands five at a time, with a page row ("Page 1 of 2") above them when there are more: Tab or Page Down SHALL turn to the next page and Shift+Tab or Page Up to the previous one, wrapping around, with the page's first command highlighted; choosing the page row (by click, or ↓ and Enter) SHALL turn to the next page. Changing the filter text SHALL go back to the first page. The text typed after `/` SHALL filter the list by name; ↑ and ↓ SHALL move the highlight, Enter SHALL apply the highlighted command, and Escape SHALL close the menu leaving the text. While the menu is open, Tab SHALL not nest the block. Focus SHALL stay in the block while the menu is open, and clicking a command SHALL apply it. Applying a command SHALL remove the `/` and the filter text, then turn the block into that type, keeping its other text; Divider SHALL replace an empty block with a divider followed by an empty paragraph, or insert a divider after a non-empty one; Table SHALL replace an empty block with a 3×3 table with a header row, or insert it after a non-empty one, with the caret in its first cell; Code SHALL turn the block into a code block holding its text as plain text. The menu SHALL close when the caret leaves the `/` text, when the `/` is deleted, or when nothing matches and a space is typed. Applying a command SHALL be one undo step.

#### Scenario: Turn a paragraph into a heading
- **WHEN** "/hea" is typed at the start of a paragraph "Intro" and Enter is pressed with "Heading 1" highlighted
- **THEN** the block is a heading 1 containing "Intro"

#### Scenario: Paging through commands
- **WHEN** "/" is typed and Tab is pressed
- **THEN** the menu shows the next five commands with the first of them highlighted, and Shift+Tab shows the first five again

#### Scenario: Escape keeps the text
- **WHEN** "/qu" is typed and Escape is pressed
- **THEN** the menu closes and the block contains "/qu"

#### Scenario: Divider from an empty block
- **WHEN** "/div" is typed in an empty paragraph and Enter is pressed
- **THEN** the block is replaced by a divider followed by an empty paragraph holding the caret

#### Scenario: Table from an empty block
- **WHEN** "/table" is typed in an empty paragraph and Enter is pressed
- **THEN** the block is replaced by a 3×3 table whose first row is a header row, with the caret in its first cell

## ADDED Requirements

### Requirement: Editing tables
In a table cell, Tab SHALL move the caret to the start of the next cell in reading order, and in the last cell add a row and move into it; Shift+Tab SHALL move to the previous cell. Enter SHALL move to the cell below in the same column, and in the last row add a row and move into it; Shift+Enter SHALL insert a line break in the cell. ↑ on a cell's first line and ↓ on its last line SHALL move to the cell above or below in the same column, or, from the first or last row, to the text block before or after the table. ← at a cell's start and → at its end SHALL move to the previous or next cell in reading order. Backspace at a cell's start SHALL do nothing. Tab SHALL never nest blocks in a table, and blocks SHALL NOT be moved into a table or a row. A table SHALL offer adding a row at its bottom and a column at its right; each row and column SHALL offer inserting one before or after it, moving it, and deleting it; the table SHALL offer toggling its header row and header column and deleting itself. Each of these SHALL be one batch and one undo step, and SHALL be refused when it would leave the table without rows or columns.

#### Scenario: Tab through a row
- **WHEN** the caret is in the last cell of a table's last row and Tab is pressed
- **THEN** a new row of empty cells is added at the bottom, and the caret is in its first cell

#### Scenario: Enter moves down
- **WHEN** Enter is pressed in the second cell of the first row
- **THEN** the caret is at the start of the second cell of the second row, and no block was split

#### Scenario: Add a column
- **WHEN** a column is added at the right of a 3×2 table
- **THEN** every row has three cells, and one Cmd/Ctrl+Z removes the column

#### Scenario: Last column can't be deleted
- **WHEN** the only column of a table is deleted from its menu
- **THEN** nothing changes

### Requirement: Editing code blocks
In a code block, Enter SHALL insert a new line, Tab SHALL insert two spaces, and Shift+Tab SHALL remove up to two spaces at the start of the caret's line. Cmd/Ctrl+Enter SHALL add a paragraph after the code block and move the caret there. Mark shortcuts, links, the `/` menu and the `@` menu SHALL NOT apply in code; pasted text SHALL be kept as plain text, line breaks included. A code block SHALL offer choosing its language from common languages and "Plain text", showing any other language it has as written.

#### Scenario: Indent a line
- **WHEN** the caret is in a code block and Tab is pressed
- **THEN** two spaces are inserted at the caret and the block stays a code block

#### Scenario: Leave a code block
- **WHEN** Cmd/Ctrl+Enter is pressed in a code block
- **THEN** an empty paragraph follows the code block and holds the caret

### Requirement: Callout emoji and tone
A callout SHALL show its emoji before its text; activating the emoji SHALL offer choosing another emoji from a set of common ones and one of the five tones, each choice saved as one undo step.

#### Scenario: Change a callout's tone
- **WHEN** the tone "warning" is chosen from a callout's emoji menu
- **THEN** the callout is tinted as a warning, and after reloading it still is
