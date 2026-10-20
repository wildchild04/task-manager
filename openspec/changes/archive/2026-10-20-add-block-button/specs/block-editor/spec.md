## ADDED Requirements

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

## MODIFIED Requirements

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
