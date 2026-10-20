## ADDED Requirements

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
On workspace pages and project pages, the slash menu's Page command SHALL create an empty, untitled sub-page: in place of the block when the block is otherwise empty, or after it, with the `/` text removed. The new sub-page SHALL open at once, after the edit is saved, with the caret in its title. Undoing the creation before the sub-page has any blocks SHALL remove it. The sidebar and the page's links SHALL show the new sub-page, and stop showing it when it is removed by undo. When any page opens with an empty title and no blocks, the caret SHALL be in its title.

#### Scenario: Page from an empty block
- **WHEN** "/page" is typed in an empty paragraph and Enter is pressed
- **THEN** the paragraph is replaced by a sub-page, the sub-page opens, and its title holds the caret

#### Scenario: Page after text
- **WHEN** "/page" is typed at the end of the paragraph "See " and Enter is pressed
- **THEN** the paragraph reads "See " and a sub-page follows it

#### Scenario: Not in task bodies
- **WHEN** "/pa" is typed in a task's body
- **THEN** the slash menu offers no Page command

## MODIFIED Requirements

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

### Requirement: Block handle and menu
Pointing at a block on pages, project home pages and task bodies SHALL show a handle beside it; on touch screens the handle SHALL show beside the block holding the caret and beside selected blocks. Tables SHALL have one handle; their rows and cells, the blocks inside a suggestion and the title SHALL have none. Comment editors SHALL show no handles. Clicking or tapping the handle SHALL select the block (keeping a block selection it is part of) and open a menu with Turn into, Delete, Duplicate, Move up, Move down and Copy, each acting on the selection as the matching key does; Turn into SHALL open the list of types (see "Turning blocks into another type") with the selected blocks' type checked when they share one; items that would change nothing SHALL be disabled. Dragging the handle SHALL move the block, or the whole selection when the block is part of it: a line SHALL show where the blocks will go, before or after the block under the pointer at its level, or inside a block that can hold children as its first child when pointing past the start of its text; dropping SHALL move them there in order as one undo step. Dropping into the dragged blocks themselves, into a table or a suggestion SHALL not be offered. Escape or releasing outside the editor SHALL cancel the drag. The page SHALL scroll while dragging near the top or bottom of the window.

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
