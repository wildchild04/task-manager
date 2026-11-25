## MODIFIED Requirements

### Requirement: Block handle and menu
On pages, project home pages and task bodies, a handle SHALL show beside the active block (the innermost block holding the caret, or holding focus on one of its own controls) and beside selected blocks, on every device; pointing at a block SHALL not show it. A block without text of its own (an image, a divider, a sub-page row, a reference) never holds the caret: clicking it, outside its own links and controls, SHALL select it (Shift+click extending the selection), so its handle shows and the block keys act on it. Tables SHALL have one handle; their rows and cells, the blocks inside a suggestion and the title SHALL have none. Comment editors SHALL show no handles. Clicking or tapping the handle SHALL select the block (keeping a block selection it is part of) and open a menu with Turn into, Add below, Delete, Duplicate, Move up, Move down and Copy, each acting on the selection as the matching key does (Add below acting on the handle's block, see "Adding a block from beside another"); Turn into SHALL open the list of types (see "Turning blocks into another type") with the selected blocks' type checked when they share one; items that would change nothing SHALL be disabled. Dragging the handle SHALL move the block, or the whole selection when the block is part of it: a line SHALL show where the blocks will go, before or after the block under the pointer at its level, or inside a block that can hold children as its first child when pointing past the start of its text; dropping SHALL move them there in order as one undo step. Dropping into the dragged blocks themselves, into a table or a suggestion SHALL not be offered. Escape or releasing outside the editor SHALL cancel the drag. The page SHALL scroll while dragging near the top or bottom of the window.

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

#### Scenario: Handle beside the active block
- **WHEN** the caret is in the second paragraph and the pointer rests on the first
- **THEN** the handle and "+" show beside the second paragraph only

#### Scenario: Delete an image
- **WHEN** an image is clicked and Backspace is pressed
- **THEN** the image is deleted, and one Cmd/Ctrl+Z brings it back
