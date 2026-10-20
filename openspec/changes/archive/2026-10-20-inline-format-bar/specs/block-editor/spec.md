## ADDED Requirements

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
