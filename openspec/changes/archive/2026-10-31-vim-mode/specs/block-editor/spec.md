## MODIFIED Requirements

### Requirement: Block selection
Whole blocks SHALL be selectable: Escape in a text block (when no menu, link dialog or link card is open) SHALL select that block, a table cell selecting its table (with Vim mode on, Space then Escape in Normal mode does this instead, and Escape is Vim's; see the vim-mode capability); clicking a block's handle SHALL select it; Escape over a text selection across blocks SHALL select the blocks it covers. While blocks are selected, ↑ and ↓ SHALL select the previous or next block alone, Shift+↑ and Shift+↓ SHALL extend or shrink the selection by one block, and Shift+click on another block's handle SHALL extend the selection to it. A block selection SHALL always be a run of consecutive blocks in reading order; selecting a block SHALL include its children; dividers, sub-pages, references and suggestions SHALL be selectable like any block; the rows and cells of a table, the blocks inside a suggestion and the children of closed toggles SHALL not be selectable on their own. Selected blocks SHALL be highlighted, no caret SHALL show, and the number of selected blocks SHALL be announced to screen readers. Escape, a click in text, or a click outside the editor SHALL end the block selection.

#### Scenario: Escape selects the block
- **WHEN** Escape is pressed with the caret in a paragraph
- **THEN** the paragraph is highlighted as selected and no caret shows

#### Scenario: Extend with Shift+Down
- **WHEN** a paragraph is selected and Shift+↓ is pressed twice
- **THEN** the paragraph and the next two blocks are selected

#### Scenario: A cell selects its table
- **WHEN** Escape is pressed with the caret in a table cell
- **THEN** the whole table is selected

#### Scenario: With Vim mode on, the leader selects the block
- **WHEN** Vim mode is on and Space then Escape is pressed in Normal mode in a paragraph
- **THEN** the paragraph is selected; Escape alone would not have selected it
