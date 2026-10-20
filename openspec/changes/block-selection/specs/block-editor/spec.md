## ADDED Requirements

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
Pointing at a block on pages, project home pages and task bodies SHALL show a handle beside it; on touch screens the handle SHALL show beside the block holding the caret and beside selected blocks. Tables SHALL have one handle; their rows and cells, the blocks inside a suggestion and the title SHALL have none. Comment editors SHALL show no handles. Clicking or tapping the handle SHALL select the block (keeping a block selection it is part of) and open a menu with Delete, Duplicate, Move up, Move down and Copy, each acting on the selection as the matching key does; items that would change nothing SHALL be disabled. Dragging the handle SHALL move the block, or the whole selection when the block is part of it: a line SHALL show where the blocks will go, before or after the block under the pointer at its level, or inside a block that can hold children as its first child when pointing past the start of its text; dropping SHALL move them there in order as one undo step. Dropping into the dragged blocks themselves, into a table or a suggestion SHALL not be offered. Escape or releasing outside the editor SHALL cancel the drag. The page SHALL scroll while dragging near the top or bottom of the window.

#### Scenario: Drag a block down
- **WHEN** the handle of the first paragraph is dragged below the third paragraph and released
- **THEN** the paragraph becomes the third block, and one Cmd/Ctrl+Z puts it back

#### Scenario: Drag a selection into a toggle
- **WHEN** two selected paragraphs are dragged by one of their handles past the start of a toggle's text and released
- **THEN** both become the toggle's first children, in order

#### Scenario: Menu on touch
- **WHEN** on a touch screen the handle beside the caret's block is tapped and Move down is chosen
- **THEN** the block moves after its next sibling and stays selected

## MODIFIED Requirements

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

### Requirement: Undo and redo
Cmd/Ctrl+Z SHALL undo the last edit and Shift+Cmd/Ctrl+Z (or Ctrl+Y) SHALL redo it, restoring the caret, the text selection across blocks, or the block selection that was there before (after, for redo). Consecutive typing in one block without pausing SHALL undo as one step; every structural edit (split, merge, nesting, type change, todo check, removing, duplicating or moving blocks, replacing a selection across blocks) SHALL be one step. Undo and redo SHALL be saved like any other edit. The history SHALL last while the page stays open.

#### Scenario: Undo typing
- **WHEN** a word is typed without pausing and Cmd/Ctrl+Z is pressed
- **THEN** the whole word is removed in one step, and the removal is saved

#### Scenario: Undo a move restores the selection
- **WHEN** two selected blocks are moved down with Cmd/Ctrl+Shift+↓ and Cmd/Ctrl+Z is pressed
- **THEN** they are back in their place and still selected
