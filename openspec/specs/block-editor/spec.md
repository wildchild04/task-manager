# block-editor Specification

## Purpose
TBD - created by archiving change block-editor-v0. Update Purpose after archive.
## Requirements
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

### Requirement: Splitting blocks and line breaks
Enter SHALL split the block at the caret: the text before stays, and the text after moves to a new block created according to the type's Enter rule, which takes the caret at its start. When the caret is at the start of a non-empty block, Enter SHALL insert the new block before it instead. Shift+Enter SHALL insert a line break inside the block. Enter in the page title SHALL move the caret to the start of the first block, creating an empty paragraph if the page has none. A block's children SHALL stay with the original block.

#### Scenario: Split a paragraph
- **WHEN** Enter is pressed in "Hello world" between "Hello " and "world"
- **THEN** the paragraph holds "Hello " and a new paragraph after it holds "world" with the caret at its start

#### Scenario: Line break
- **WHEN** Shift+Enter is pressed in a paragraph
- **THEN** the paragraph contains a line break and no new block is created

### Requirement: Joining and removing at block edges
Backspace with the caret at the start of a text block SHALL apply the type's Backspace rule: turn it into a paragraph, or, for a paragraph, merge its text into the end of the previous text block (its children move under that block), leaving the caret at the join. If the previous block is a reference, Backspace SHALL remove the reference. If the previous block is a sub-page or a divider, Backspace SHALL move the caret to the end of the text block before it and remove nothing, except that a divider SHALL be removed. Delete at the end of a text block SHALL merge the next text block into it, with the same rules. Backspace SHALL never delete a sub-page. A block nested under another SHALL first be un-nested by Backspace at its start before merging.

#### Scenario: Merge paragraphs
- **WHEN** Backspace is pressed at the start of a paragraph "world" after the paragraph "Hello "
- **THEN** one paragraph "Hello world" remains, with the caret between "Hello " and "world"

#### Scenario: Sub-page is kept
- **WHEN** Backspace is pressed at the start of a paragraph that follows a sub-page
- **THEN** the sub-page still exists and the caret is at the end of the text block before the sub-page

#### Scenario: Reference is removed
- **WHEN** Backspace is pressed at the start of a paragraph that follows a reference
- **THEN** the reference is removed and the caret stays at the start of the paragraph

### Requirement: Nesting with Tab
Tab SHALL nest a block as the last child of its previous sibling, keeping its own children; it SHALL do nothing for the first block among its siblings or when the previous sibling can't have children (divider, reference). Shift+Tab SHALL move a nested block out to follow its parent, taking the blocks after it in the parent with it as its children. Nesting SHALL keep the caret where it was.

#### Scenario: Indent a list item
- **WHEN** Tab is pressed in the second of two bulleted items
- **THEN** it becomes the child of the first item and is shown indented under it

#### Scenario: Outdent takes followers
- **WHEN** Shift+Tab is pressed in the first of three items nested under a parent
- **THEN** that item follows the parent, and the other two become its children

### Requirement: Moving between blocks with the keyboard
↑ on the first visual line of a block SHALL move the caret to the last line of the previous text block at about the same horizontal position; ↓ on the last line SHALL move to the first line of the next text block. ← at the start of a block SHALL move to the end of the previous text block; → at the end SHALL move to the start of the next. Blocks that can't hold the caret, and the children of closed toggles, SHALL be skipped. ↑ in the first block SHALL move into the title. When no text block follows a table or code block, ↓ on its last line (in a table, its last row) and → at its end SHALL add an empty paragraph after it and move the caret there. Clicking the space below the last block SHALL put the caret in an empty paragraph at the end of the page, adding one when the page doesn't end with one.

#### Scenario: Up across wrapped lines
- **WHEN** ↑ is pressed on the second visual line of a wrapped paragraph
- **THEN** the caret moves to the first line of the same paragraph, not to the previous block

#### Scenario: Skipping a divider
- **WHEN** ↓ is pressed on the last line of a paragraph followed by a divider and another paragraph
- **THEN** the caret moves into the paragraph after the divider

#### Scenario: Out of a table at the end of the page
- **WHEN** ↓ is pressed in the last row of a table that is the page's last block
- **THEN** an empty paragraph is added after the table and holds the caret, and Cmd/Ctrl+Z removes it

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
Typing `/` in a text block other than the title, a table cell or a code block, at its start or after a space, SHALL open a menu at the caret listing: Text, Heading 1, Heading 2, Heading 3, Heading 4, Heading 5, Heading 6, Bulleted list, Numbered list, To-do, Toggle, Quote, Callout, Code, Table, Divider and, on workspace pages and project pages, Page. The menu SHALL show the matching commands five at a time, with a page row ("Page 1 of 2") above them when there are more: Tab or Page Down SHALL turn to the next page and Shift+Tab or Page Up to the previous one, wrapping around, with the page's first command highlighted; choosing the page row (by click, or ↓ and Enter) SHALL turn to the next page. Changing the filter text SHALL go back to the first page. The text typed after `/` SHALL filter the list by name; ↑ and ↓ SHALL move the highlight, Enter SHALL apply the highlighted command, and Escape SHALL close the menu leaving the text. While the menu is open, Tab SHALL not nest the block. Focus SHALL stay in the block while the menu is open, and clicking a command SHALL apply it. Applying a command SHALL remove the `/` and the filter text, then turn the block into that type, keeping its other text; Divider SHALL replace an empty block with a divider followed by an empty paragraph, or insert a divider after a non-empty one; Table SHALL replace an empty block with a 3×3 table with a header row, or insert it after a non-empty one, with the caret in its first cell; Code SHALL turn the block into a code block holding its text as plain text; Page SHALL create a sub-page as described in "Creating sub-pages from the editor". The menu SHALL close when the caret leaves the `/` text, when the `/` is deleted, or when nothing matches and a space is typed. Applying a command SHALL be one undo step.

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

### Requirement: Undo and redo
Cmd/Ctrl+Z SHALL undo the last edit and Shift+Cmd/Ctrl+Z (or Ctrl+Y) SHALL redo it, restoring the caret, the text selection across blocks, or the block selection that was there before (after, for redo). Consecutive typing in one block without pausing SHALL undo as one step; every structural edit (split, merge, nesting, type change, todo check, removing, duplicating or moving blocks, replacing a selection across blocks) SHALL be one step. Undo and redo SHALL be saved like any other edit. The history SHALL last while the page stays open.

#### Scenario: Undo typing
- **WHEN** a word is typed without pausing and Cmd/Ctrl+Z is pressed
- **THEN** the whole word is removed in one step, and the removal is saved

#### Scenario: Undo a move restores the selection
- **WHEN** two selected blocks are moved down with Cmd/Ctrl+Shift+↓ and Cmd/Ctrl+Z is pressed
- **THEN** they are back in their place and still selected

### Requirement: Saving edits
Every edit SHALL show at once and be saved in the background as a batch of block operations: typing after it pauses briefly, and any structural edit at once, preserving the order of edits. The page SHALL show whether edits are being saved, are saved, or couldn't be saved. A failed save SHALL keep the edits on the page and retry; a save the server rejects SHALL show the reason and reload the page's content from the server. Following a link with unsaved edits SHALL save them first and leave once they are saved; while they aren't, it SHALL ask whether to leave and lose them. Closing the browser tab with unsaved edits SHALL ask for confirmation. A change made elsewhere to the page while it is open with no unsaved edits (for example a task's return appending to its description) SHALL appear in the editor.

#### Scenario: Fast typing then Enter
- **WHEN** text is typed and Enter pressed several times quickly, then the page is reloaded once saved
- **THEN** the reloaded page has exactly the same blocks and text

#### Scenario: Leaving with unsaved edits
- **WHEN** a link is followed while an edit hasn't been saved, and the server can't be reached
- **THEN** the page asks whether to leave and lose the edit, and stays if asked to

### Requirement: Edits stay inside the edited page
The server SHALL accept an edit batch only if every block it touches is in the edited page's own content, outside any sub-page's content; it SHALL reject a batch that deletes a sub-page, deletes or changes the type of the page block itself, or inserts a page, comment or suggestion block. On workspace pages and project pages, it SHALL accept inserting a page block holding only its title (an empty sub-page) where a block may go, and deleting a sub-page that has no blocks of its own; a sub-page with blocks, or a block containing a sub-page, SHALL still not be deleted. It SHALL also reject a batch that inserts into, updates or deletes a suggestion, that updates, moves or deletes a block inside one, or that deletes a block containing a suggestion; suggestions change only by being approved or rejected. Moving a suggestion as a whole (its proposed blocks go with it), moving a block that contains one, and editing or deleting a suggestion's target, SHALL be allowed. A rejected batch SHALL change nothing.

#### Scenario: Batch outside the page
- **WHEN** an edit batch for page A updates a block of page B
- **THEN** the server rejects it and neither page changes

#### Scenario: Deleting a sub-page through an edit
- **WHEN** an edit batch deletes a sub-page block that has blocks of its own
- **THEN** the server rejects it and the sub-page still exists

#### Scenario: Creating and removing an empty sub-page
- **WHEN** an edit batch for a workspace page inserts a page block, and a later batch deletes it while it still has no blocks
- **THEN** the server accepts both, and the sub-page exists in between

#### Scenario: No sub-pages in a task body
- **WHEN** an edit batch for a task's body inserts a page block
- **THEN** the server rejects it

#### Scenario: Changing a suggestion through an edit
- **WHEN** an edit batch updates the content of a block inside a suggestion
- **THEN** the server rejects it and the suggestion is unchanged

#### Scenario: Outdenting past a suggestion
- **WHEN** Shift+Tab is pressed in a nested list item whose following sibling is a suggestion
- **THEN** the item moves out and the suggestion, unchanged, becomes its child

#### Scenario: Editing a suggestion's target
- **WHEN** an edit batch changes the text of a block that a pending replace suggestion targets
- **THEN** the edit is saved and the suggestion becomes outdated

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

### Requirement: Editing around mentions
A mention SHALL behave as one character: the caret moves over it with one arrow press, Backspace after it or Delete before it removes the whole mention, a selection containing it can be deleted, marked or replaced, and splitting or merging blocks keeps it intact. Clicking a mention SHALL open its page in the app. The caret SHALL never be placed inside a mention.

#### Scenario: Delete a mention
- **WHEN** the caret is right after a mention and Backspace is pressed
- **THEN** the whole mention is removed, and undo brings it back

#### Scenario: Open the mentioned page
- **WHEN** a mention in the editor is clicked
- **THEN** the browser opens the mentioned page in the app

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
In a code block, Enter SHALL insert a new line, Tab SHALL insert two spaces, and Shift+Tab SHALL remove up to two spaces at the start of the caret's line. Cmd/Ctrl+Enter SHALL add a paragraph after the code block and move the caret there; in a table cell it SHALL do the same after the table. Mark shortcuts, links, the `/` menu and the `@` menu SHALL NOT apply in code; pasted text SHALL be kept as plain text, line breaks included. A code block SHALL offer choosing its language from common languages and "Plain text", showing any other language it has as written.

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

### Requirement: Pasting keeps structure
Pasting into a text block other than a code block, a table cell or the page title SHALL turn the clipboard into blocks: content copied from this app exactly (mentions and links to pages kept), HTML by its elements (paragraphs, headings, lists and todos, quotes, dividers, code blocks with their language, tables, bold, italic, strikethrough, underline, inline code and links; other elements by their text), and plain text read as Markdown (see the agent-api capability's Markdown conversion). A paste that is a single paragraph SHALL be inserted at the caret with its marks. Otherwise, pasting into an empty paragraph SHALL replace it with the pasted blocks, and pasting elsewhere SHALL split the block at the caret: the text before stays, the first pasted paragraph's text joins it, the other pasted blocks follow with their nesting, and the text after the caret follows them as a paragraph. The caret SHALL end at the end of the last pasted text block. A paste SHALL be one undo step. Pasting into a code block, a table cell or the title SHALL insert the clipboard's plain text at the caret.

#### Scenario: A list from another app
- **WHEN** HTML for a bulleted list of three items, the second with **bold** text, is pasted into an empty paragraph
- **THEN** the paragraph is replaced by three bulleted list items, the second with a bold span, and one Cmd/Ctrl+Z brings the empty paragraph back

#### Scenario: Markdown with a table and code
- **WHEN** the plain text "Intro\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\n```ts\nlet x = 1;\n```" is pasted at the end of the paragraph "Notes: "
- **THEN** the paragraph reads "Notes: Intro", followed by a 2-column table with a header row and a TypeScript code block, and the caret is at the end of the code block

#### Scenario: Pasting into a sentence
- **WHEN** two paragraphs "A" and "B" are pasted between "Hello " and "world"
- **THEN** the blocks read "Hello A", "B" and "world"

#### Scenario: One paragraph keeps marks
- **WHEN** a bold word copied from another page of the app is pasted inside a paragraph
- **THEN** the word is inserted at the caret, bold, and no block is added

#### Scenario: Paste into code
- **WHEN** "- one\n- two" is pasted into a code block
- **THEN** the code block contains those two lines as text, and no list is created

### Requirement: Copying keeps structure
Copying a selection that spans several blocks SHALL put Markdown on the clipboard as plain text: every block from the start of the selection to its end, the first and last text blocks with only their selected text, tables and code blocks whole, and the children of each included block, with mentions written as `@Title` and links to app pages as their full URLs. It SHALL also put the same content in a format only this app reads, which keeps mentions and page links exactly, so pasting it back into the app rebuilds the same blocks. Copying within one block SHALL keep the browser's plain text and add that app-only format with the selection's marks. Copying a block selection SHALL put the selected blocks whole, with their children, in both formats. Cutting SHALL put the same on the clipboard as copying and then remove the selection: within one block its text, across blocks as described in "Editing over a selection across blocks", and for a block selection as described in "Acting on selected blocks"; a cut SHALL be one undo step.

#### Scenario: Copy a list and a table
- **WHEN** a heading, two bulleted items and a table are selected and copied
- **THEN** the clipboard's text is "## Heading\n\n- one\n- two\n\n| a | b |\n|---|---|\n| 1 | 2 |"

#### Scenario: Copy and paste within the app
- **WHEN** a paragraph with a mention of "Architecture" and the list after it are copied and pasted into another page
- **THEN** the other page gets a paragraph with a mention of "Architecture" and the same list

#### Scenario: Cut selected blocks
- **WHEN** two selected bulleted items are cut and pasted into an empty paragraph further down
- **THEN** the items are gone from their old place and appear in place of the empty paragraph, each step undoable on its own

#### Scenario: Cut across blocks
- **WHEN** text is selected from the middle of one paragraph into the middle of the next and cut
- **THEN** the clipboard holds the selected text as two paragraphs, and the page has the two remaining halves joined in one paragraph

### Requirement: Selecting text across blocks
Text selection SHALL extend from one block into others: by dragging from one text block into another, by Shift+click in another text block, and by Shift+↑ on a block's first line, Shift+↓ on its last line, Shift+← at its start or Shift+→ at its end, which move the selection's end into the neighbouring text block (skipping blocks that can't hold the caret and the children of closed toggles). The selection SHALL be shown highlighted in every block it covers. The page title SHALL NOT take part: a selection starting in the title stays in the title. A selection reaching into a table SHALL cover the table whole. Without Shift, ← and ↑ SHALL collapse the selection to its start and → and ↓ to its end.

#### Scenario: Drag across paragraphs
- **WHEN** a drag starts in the middle of the paragraph "Hello world" and ends in the middle of the next paragraph "Second line"
- **THEN** the end of the first paragraph and the start of the second are selected and highlighted

#### Scenario: Shift+Down from the last line
- **WHEN** Shift+↓ is pressed with the caret on the last line of a paragraph followed by another paragraph
- **THEN** the selection runs from the caret into the next paragraph, at about the same horizontal position

### Requirement: Editing over a selection across blocks
With text selected across blocks, typing, Enter, Shift+Enter, Backspace, Delete, paste and cut SHALL first remove the selection: the first block keeps its text before the selection, the text after the selection in the last text block joins it (marks kept), and every block between is removed with its children. Children of removed blocks that come after the selection, and the last block's children, SHALL move under the first block, after its own children (after it, as siblings, when it can't hold children). Sub-pages, suggestions and blocks containing either SHALL never be removed this way: they stay where they are. Then the typed text, line break, split or pasted blocks SHALL apply at the join as they would at a caret there. Each SHALL be one undo step. If the selection starts or ends inside a table, the table SHALL be removed whole and nothing is joined across it.

#### Scenario: Typing over two paragraphs
- **WHEN** "lo wor" is selected from "Hello" into "world", and "p" is typed
- **THEN** the two paragraphs become one paragraph "Helpld" with the caret after "p", and one Cmd/Ctrl+Z restores both paragraphs and the selection

#### Scenario: Backspace over a list
- **WHEN** the selection runs from the middle of a paragraph "Intro text" through two bulleted items into the middle of a third paragraph "Outro text", and Backspace is pressed
- **THEN** the first paragraph keeps its text before the selection with the rest of "Outro text" appended, and the bulleted items are gone

#### Scenario: A sub-page in the selection
- **WHEN** the selection runs from one paragraph over a sub-page into the next paragraph, and Delete is pressed
- **THEN** the paragraphs are joined, and the sub-page still exists, right after the joined paragraph

#### Scenario: Enter over a selection
- **WHEN** text is selected across two paragraphs and Enter is pressed
- **THEN** the selection is removed and the block is split at the join, as one undo step

### Requirement: Select all
Cmd/Ctrl+A in a text block SHALL select its whole text. Pressed again while the block's whole text is selected, it SHALL select every block of the page as a block selection. In the title it SHALL select the title's text only.

#### Scenario: Twice selects the page
- **WHEN** Cmd/Ctrl+A is pressed twice in a paragraph
- **THEN** the first press selects the paragraph's text and the second selects every block of the page

### Requirement: Block selection
Whole blocks SHALL be selectable: Escape in a text block (when no menu, link dialog or link card is open) SHALL select that block, a table cell selecting its table; clicking a block's handle SHALL select it; Escape over a text selection across blocks SHALL select the blocks it covers. While blocks are selected, ↑ and ↓ SHALL select the previous or next block alone, Shift+↑ and Shift+↓ SHALL extend or shrink the selection by one block, and Shift+click on another block's handle SHALL extend the selection to it. A block selection SHALL always be a run of consecutive blocks in reading order; selecting a block SHALL include its children; dividers, sub-pages, references and suggestions SHALL be selectable like any block; the rows and cells of a table, the blocks inside a suggestion and the children of closed toggles SHALL not be selectable on their own. Selected blocks SHALL be highlighted, no caret SHALL show, and the number of selected blocks SHALL be announced to screen readers. Escape, a click in text, or a click outside the editor SHALL end the block selection.

#### Scenario: Escape selects the block
- **WHEN** Escape is pressed with the caret in a paragraph
- **THEN** the paragraph is highlighted as selected and no caret shows

#### Scenario: Extend with Shift+Down
- **WHEN** a paragraph is selected and Shift+↓ is pressed twice
- **THEN** the paragraph and the next two blocks are selected

#### Scenario: A cell selects its table
- **WHEN** Escape is pressed with the caret in a table cell
- **THEN** the whole table is selected

### Requirement: Acting on selected blocks
With blocks selected: Backspace or Delete SHALL remove them; Cmd/Ctrl+D SHALL duplicate them right after the last one, with their children, and select the copies; paste SHALL replace them with the pasted blocks; Enter SHALL put the caret at the end of the last selected text block (or the start of the first text block after the selection); Tab and Shift+Tab SHALL nest and un-nest them together when they share a parent, following the nesting rules for a single block. Sub-pages, suggestions and blocks containing either SHALL never be removed or duplicated this way: removing keeps them, selected, and duplicating leaves them out. After removing blocks the caret SHALL go to the end of the text block before them, or the start of the one after, or an empty paragraph when the page is left with no blocks. Typing a character SHALL do nothing. Each action SHALL be one undo step, and undoing it SHALL select the same blocks again.

#### Scenario: Delete two blocks
- **WHEN** a heading and the paragraph after it are selected and Backspace is pressed
- **THEN** both are removed, the caret is at the end of the text block before them, and Cmd/Ctrl+Z brings both back selected

#### Scenario: Duplicate a toggle
- **WHEN** a toggle with two children is selected and Cmd/Ctrl+D is pressed
- **THEN** a copy of the toggle with copies of both children appears right after it, and the copy is selected

#### Scenario: A sub-page is kept
- **WHEN** a paragraph, a sub-page and another paragraph are selected and Delete is pressed
- **THEN** both paragraphs are removed and the sub-page stays, selected

#### Scenario: Nest selected items
- **WHEN** the second and third of three bulleted items are selected and Tab is pressed
- **THEN** both become children of the first item, in order

### Requirement: Moving blocks
Cmd/Ctrl+Shift+↑ and Cmd/Ctrl+Shift+↓ SHALL move the selected blocks, or with the caret in a block that block, up before the previous sibling or down after the next one, keeping the caret or selection on them. At the first or last place among its siblings a block SHALL move out to its parent's level, before or after the parent; at the start or end of the page nothing SHALL happen. Selected blocks that don't share a parent SHALL not move by keyboard. With the caret in a table cell, these keys SHALL move the cell's row. Each move SHALL be one undo step.

#### Scenario: Move a paragraph up
- **WHEN** the caret is in the third paragraph and Cmd/Ctrl+Shift+↑ is pressed
- **THEN** it becomes the second paragraph, the caret stays where it was in its text, and the move is saved

#### Scenario: Out of a toggle
- **WHEN** the first child of an open toggle is selected and Cmd/Ctrl+Shift+↑ is pressed
- **THEN** it moves out of the toggle to just before it

### Requirement: Block handle and menu
Pointing at a block on pages, project home pages and task bodies SHALL show a handle beside it; on touch screens the handle SHALL show beside the block holding the caret and beside selected blocks. Tables SHALL have one handle; their rows and cells, the blocks inside a suggestion and the title SHALL have none. Comment editors SHALL show no handles. Clicking or tapping the handle SHALL select the block (keeping a block selection it is part of) and open a menu with Turn into, Add below, Delete, Duplicate, Move up, Move down and Copy, each acting on the selection as the matching key does (Add below acting on the handle's block, see "Adding a block from beside another"); Turn into SHALL open the list of types (see "Turning blocks into another type") with the selected blocks' type checked when they share one; items that would change nothing SHALL be disabled. Dragging the handle SHALL move the block, or the whole selection when the block is part of it: a line SHALL show where the blocks will go, before or after the block under the pointer at its level, or inside a block that can hold children as its first child when pointing past the start of its text; dropping SHALL move them there in order as one undo step. Dropping into the dragged blocks themselves, into a table or a suggestion SHALL not be offered. Escape or releasing outside the editor SHALL cancel the drag. The page SHALL scroll while dragging near the top or bottom of the window.

#### Scenario: Drag a block down
- **WHEN** the handle of the first paragraph is dragged below the third paragraph and released
- **THEN** the paragraph becomes the third block, and one Cmd/Ctrl+Z puts it back

#### Scenario: Drag a selection into a toggle
- **WHEN** two selected paragraphs are dragged by one of their handles past the start of a toggle's text and released
- **THEN** both become the toggle's first children, in order

#### Scenario: Menu on touch
- **WHEN** on a touch screen the handle beside the caret's block is tapped and Move down is chosen
- **THEN** the block moves after its next sibling and stays selected

#### Scenario: Turn into from the handle
- **WHEN** a heading 2's handle is clicked and Turn into is chosen
- **THEN** the list of types shows Heading 2 checked, and choosing Quote turns the heading into a quote with the same text

### Requirement: Turning blocks into another type
"Turn into" SHALL change blocks to Text, Heading 1–6, Bulleted list, Numbered list, To-do, Toggle, Quote, Callout or Code, as the slash menu's commands do: keeping the text and children, except that Code keeps the text without marks or mentions and its children move out to follow it. It SHALL act on the selected blocks (not on their children) in a block selection, on every text block a text selection across blocks touches, or else on the block holding the caret. Blocks without text of their own (dividers, tables, sub-pages, references, suggestions), table cells and the title SHALL not change. Cmd/Ctrl+Shift+0 to 8 SHALL turn blocks into Text, Heading 1, Heading 2, Heading 3, To-do, Bulleted list, Numbered list, Toggle and Code. Turning blocks into a type SHALL be one undo step and SHALL keep the caret or selection where it was.

#### Scenario: Several blocks into a list
- **WHEN** three paragraphs are selected and turned into Bulleted list
- **THEN** all three are bulleted list items with the same text, and one Cmd/Ctrl+Z turns them back

#### Scenario: Shortcut on the caret's block
- **WHEN** Cmd/Ctrl+Shift+2 is pressed with the caret in the middle of a paragraph
- **THEN** the paragraph becomes a heading 2 and the caret stays at the same place in its text

#### Scenario: Non-text blocks are skipped
- **WHEN** a paragraph, a divider and a paragraph are selected and turned into To-do
- **THEN** both paragraphs become unchecked to-dos and the divider stays a divider

#### Scenario: A text selection across blocks
- **WHEN** text is selected from the middle of one paragraph into the middle of the next and Cmd/Ctrl+Shift+1 is pressed
- **THEN** both paragraphs become headings 1 and the text stays selected

### Requirement: Creating sub-pages from the editor
On workspace pages and project pages, the slash menu's Page command SHALL create an empty, untitled sub-page: in place of the block when the block is otherwise empty, or after it, with the `/` text removed. The new sub-page SHALL open at once, after the edit is saved, with the caret in its title. Undo does not reach across pages: once the sub-page has opened, an unwanted one is deleted from its own page. The sidebar and the page's links SHALL show the new sub-page. When any page opens with an empty title and no blocks, the caret SHALL be in its title.

#### Scenario: Page from an empty block
- **WHEN** "/page" is typed in an empty paragraph and Enter is pressed
- **THEN** the paragraph is replaced by a sub-page, the sub-page opens, and its title holds the caret

#### Scenario: Page after text
- **WHEN** "/page" is typed at the end of the paragraph "See " and Enter is pressed
- **THEN** the paragraph reads "See " and a sub-page follows it

#### Scenario: Not in task bodies
- **WHEN** "/pa" is typed in a task's body
- **THEN** the slash menu offers no Page command

### Requirement: Adding a block from beside another
A "+" button SHALL show beside each block's handle where the handle shows on pointing devices (not on touch screens). Clicking it SHALL add an empty paragraph holding `/` after the block, at the block's level (after a table as a whole), with the caret after the `/`, and open the slash menu there as if `/` had been typed; Alt/Option+click SHALL add it before the block instead. When the block is an empty paragraph without children, the `/` SHALL go into it instead of a new block. The handle menu's "Add below" SHALL do the same as clicking "+". Adding the block SHALL be one undo step, and the command then chosen from the menu SHALL be another.

#### Scenario: Add after a table
- **WHEN** the "+" beside a table is clicked and "Heading 2" is chosen from the menu
- **THEN** a heading 2 holding the caret follows the table, and two Cmd/Ctrl+Z remove it

#### Scenario: Add above
- **WHEN** the "+" beside the second paragraph is Alt/Option+clicked and Escape is pressed
- **THEN** a paragraph holding "/" sits between the first and second paragraphs

#### Scenario: Reuse an empty paragraph
- **WHEN** the "+" beside an empty paragraph is clicked
- **THEN** no block is added; the paragraph holds "/" with the slash menu open

#### Scenario: Add below on touch
- **WHEN** on a touch screen the handle beside a to-do is tapped and Add below is chosen
- **THEN** a paragraph holding "/" follows the to-do with the slash menu open

### Requirement: Inline formatting bar
Selecting text within one block, other than the title or a code block, SHALL show a bar over the selection with Turn into (labelled with the block's type; not in table cells), Bold, Italic, Underline, Strikethrough, Code and Link. Each mark's button SHALL show pressed when all the selected text has that mark, and Link when the selection is within one link. The buttons SHALL do what Cmd/Ctrl+B, I, U, Shift+S, E and K do, keeping the text selected and the bar shown with updated states; Turn into SHALL list the types as the handle menu does. The bar SHALL show once a pointer selection is released or a keyboard selection has stopped changing, SHALL hide when the selection collapses, when text is typed or composed, when the selection spans blocks or whole blocks are selected, on Escape and on a click outside it, and SHALL never take focus from the text. On touch screens it SHALL show below the selection; elsewhere above it, each flipping when there is no room.

#### Scenario: Bold from the bar
- **WHEN** a word in a paragraph is selected with the mouse and the bar's Bold is clicked
- **THEN** the word is bold, still selected, and the bar shows Bold pressed

#### Scenario: Two marks in a row
- **WHEN** a selected word is made italic and then code from the bar
- **THEN** the word has both marks, and two Cmd/Ctrl+Z remove them one at a time

#### Scenario: Typing hides it
- **WHEN** the bar is showing and a letter is typed
- **THEN** the selected text is replaced by the letter and the bar is gone

#### Scenario: Not in code
- **WHEN** text in a code block is selected
- **THEN** no bar shows

#### Scenario: Turn into from the bar
- **WHEN** text in a paragraph is selected and the bar's Turn into is used to choose Heading 1
- **THEN** the paragraph becomes a heading 1 with the same text still selected

