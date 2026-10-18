## ADDED Requirements

### Requirement: Editable surfaces
The editor SHALL edit the title and blocks of: pages opened at `/pages/:pageId` (library documents and workspace pages, nested or not), a project's home page on `/projects/:projectId`, and a task's body page on `/tasks/:taskId` (its title is the task's title). The server SHALL render these pages read-only, and they SHALL become editable once loaded in the browser, with the same content in the same place. Sub-pages inside an edited page SHALL not have their own content edited there; they open their own page.

#### Scenario: Edit a library document
- **WHEN** a library document is opened and a word is typed into its first paragraph
- **THEN** the paragraph shows the word at once, and after reloading the page it is still there

#### Scenario: Rename a task
- **WHEN** a task's title is changed on its page to "Add passkey login"
- **THEN** the task lists, the dashboard and the breadcrumb show "Add passkey login"

### Requirement: Block types declare their editing behavior
Each block type SHALL declare, in one place, whether it holds text and what Enter, Enter on an empty block, and Backspace at the start do. The editor SHALL follow these declarations without type-specific code elsewhere:

| Type | Text | Enter | Enter when empty | Backspace at start |
|---|---|---|---|---|
| paragraph | yes | new paragraph | new paragraph | merge into previous |
| heading 1–3 | yes | new paragraph | new paragraph | becomes paragraph |
| bulleted / numbered list item | yes | same type | becomes paragraph | becomes paragraph |
| todo | yes | new unchecked todo | becomes paragraph | becomes paragraph |
| toggle | yes | first child if open, else new paragraph | becomes paragraph | becomes paragraph |
| quote | yes | new paragraph | becomes paragraph | becomes paragraph |
| divider | no | — | — | — |
| sub-page | no (shows its title) | — | — | — |
| reference | no (shows its target) | — | — | — |

#### Scenario: Leaving a list
- **WHEN** Enter is pressed in an empty bulleted list item
- **THEN** the item becomes a paragraph at the same position

#### Scenario: Heading continues as a paragraph
- **WHEN** Enter is pressed at the end of a heading
- **THEN** a new paragraph follows the heading and holds the caret

### Requirement: Editing text and marks
Typing, deleting and replacing selected text SHALL change the block's rich text at the caret, keeping the marks of the text around it. Cmd/Ctrl+B, I, U, Shift+S and E SHALL toggle bold, italic, underline, strikethrough and inline code on the selected text; Cmd/Ctrl+K SHALL ask for a URL (focused, saved with Enter) and add a link to the selected text (with the caret on a link and nothing selected, it SHALL edit that whole link, prefilled with its URL), or remove it when the URL is left empty; a URL without a scheme SHALL get `https://`. Typing `@` in that field SHALL list the workspace's pages and library documents matching the text after it, with their place, and choosing one SHALL link the text to that page (`/pages/:pageId`). Editing a link to a page SHALL show it as `@` and the page's title, with that page highlighted, never its ID. Clicking a link in the editor SHALL open an app page in the same tab and any other URL in a new tab. Text typed at the end of a marked span SHALL continue with the same marks, except links.

#### Scenario: Bold a word
- **WHEN** a word is selected and Cmd/Ctrl+B is pressed
- **THEN** the word is bold, the rest of the text is unchanged, and the change is saved

#### Scenario: Link to a page
- **WHEN** a word is selected, Cmd/Ctrl+K is pressed, "@Archi" is typed and Enter is pressed
- **THEN** the word links to the "Architecture" document, and clicking it opens that document in the same tab

#### Scenario: Accented input
- **WHEN** "é" is typed with a dead key or input method
- **THEN** the block contains "é" once and the caret is after it

### Requirement: Block type functions
A todo's checkbox SHALL check and uncheck it, and the change SHALL be saved. A toggle's arrow SHALL open and close it, hiding its children while closed; toggles SHALL start open, and the open state SHALL not be saved. Sub-page and page-reference blocks SHALL open their page when clicked. Dividers, sub-pages and references SHALL never hold the caret.

#### Scenario: Check a todo
- **WHEN** an unchecked todo's checkbox is clicked
- **THEN** it is checked, and it is still checked after reloading

#### Scenario: Close a toggle
- **WHEN** an open toggle's arrow is clicked
- **THEN** its children are hidden, and the arrow shows it is closed

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
↑ on the first visual line of a block SHALL move the caret to the last line of the previous text block at about the same horizontal position; ↓ on the last line SHALL move to the first line of the next text block. ← at the start of a block SHALL move to the end of the previous text block; → at the end SHALL move to the start of the next. Blocks that can't hold the caret, and the children of closed toggles, SHALL be skipped. ↑ in the first block SHALL move into the title.

#### Scenario: Up across wrapped lines
- **WHEN** ↑ is pressed on the second visual line of a wrapped paragraph
- **THEN** the caret moves to the first line of the same paragraph, not to the previous block

#### Scenario: Skipping a divider
- **WHEN** ↓ is pressed on the last line of a paragraph followed by a divider and another paragraph
- **THEN** the caret moves into the paragraph after the divider

### Requirement: Markdown shortcuts change the type
Typing one of these at the start of a paragraph, followed by a space, SHALL remove the typed characters and change the block's type, keeping the rest of its text: `#` heading 1, `##` heading 2, `###` heading 3, `-` or `*` bulleted list item, `1.` numbered list item, `[]` unchecked todo, `>` quote. Typing `---` in an empty paragraph SHALL turn it into a divider followed by a new empty paragraph holding the caret. Undo right after a shortcut SHALL restore the typed characters and the paragraph.

#### Scenario: Make a heading
- **WHEN** "# " is typed at the start of an empty paragraph
- **THEN** it becomes an empty heading 1 holding the caret

#### Scenario: Undo a shortcut
- **WHEN** "- " turns a paragraph into a list item and Cmd/Ctrl+Z is pressed
- **THEN** the paragraph is back, containing "- "

### Requirement: Slash menu
Typing `/` in a text block other than the title, at its start or after a space, SHALL open a menu at the caret listing: Text, Heading 1, Heading 2, Heading 3, Bulleted list, Numbered list, To-do, Toggle, Quote and Divider. The menu SHALL show the matching commands five at a time, with a page row ("Page 1 of 2") above them when there are more: Tab or Page Down SHALL turn to the next page and Shift+Tab or Page Up to the previous one, wrapping around, with the page's first command highlighted; choosing the page row (by click, or ↓ and Enter) SHALL turn to the next page. Changing the filter text SHALL go back to the first page. The text typed after `/` SHALL filter the list by name; ↑ and ↓ SHALL move the highlight, Enter SHALL apply the highlighted command, and Escape SHALL close the menu leaving the text. While the menu is open, Tab SHALL not nest the block. Focus SHALL stay in the block while the menu is open, and clicking a command SHALL apply it. Applying a command SHALL remove the `/` and the filter text, then turn the block into that type, keeping its other text; Divider SHALL replace an empty block with a divider followed by an empty paragraph, or insert a divider after a non-empty one. The menu SHALL close when the caret leaves the `/` text, when the `/` is deleted, or when nothing matches and a space is typed. Applying a command SHALL be one undo step.

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

### Requirement: Undo and redo
Cmd/Ctrl+Z SHALL undo the last edit and Shift+Cmd/Ctrl+Z (or Ctrl+Y) SHALL redo it, restoring the caret. Consecutive typing in one block without pausing SHALL undo as one step; every structural edit (split, merge, nesting, type change, todo check) SHALL be one step. Undo and redo SHALL be saved like any other edit. The history SHALL last while the page stays open.

#### Scenario: Undo typing
- **WHEN** a word is typed without pausing and Cmd/Ctrl+Z is pressed
- **THEN** the whole word is removed in one step, and the removal is saved

### Requirement: Saving edits
Every edit SHALL show at once and be saved in the background as a batch of block operations: typing after it pauses briefly, and any structural edit at once, preserving the order of edits. The page SHALL show whether edits are being saved, are saved, or couldn't be saved. A failed save SHALL keep the edits on the page and retry; a save the server rejects SHALL show the reason and reload the page's content from the server. Following a link with unsaved edits SHALL save them first and leave once they are saved; while they aren't, it SHALL ask whether to leave and lose them. Closing the browser tab with unsaved edits SHALL ask for confirmation. A change made elsewhere to the page while it is open with no unsaved edits (for example a task's return appending to its description) SHALL appear in the editor.

#### Scenario: Fast typing then Enter
- **WHEN** text is typed and Enter pressed several times quickly, then the page is reloaded once saved
- **THEN** the reloaded page has exactly the same blocks and text

#### Scenario: Leaving with unsaved edits
- **WHEN** a link is followed while an edit hasn't been saved, and the server can't be reached
- **THEN** the page asks whether to leave and lose the edit, and stays if asked to

### Requirement: Edits stay inside the edited page
The server SHALL accept an edit batch only if every block it touches is in the edited page's own content, outside any sub-page's content; it SHALL reject a batch that deletes a sub-page, deletes or changes the type of the page block itself, or inserts a page or comment block. A rejected batch SHALL change nothing.

#### Scenario: Batch outside the page
- **WHEN** an edit batch for page A updates a block of page B
- **THEN** the server rejects it and neither page changes

#### Scenario: Deleting a sub-page through an edit
- **WHEN** an edit batch deletes a sub-page block
- **THEN** the server rejects it and the sub-page still exists
