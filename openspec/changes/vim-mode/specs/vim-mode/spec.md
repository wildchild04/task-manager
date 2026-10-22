## ADDED Requirements

### Requirement: Vim mode setting
The app shell's header SHALL offer a "Vim mode" toggle next to the theme toggle, only on desktop browsers: where `(hover: hover) and (pointer: fine)` matches. The setting SHALL be kept in a cookie and read by the root loader, so the server renders the editor in the chosen setting. Where the media query doesn't match, the toggle SHALL be hidden and Vim mode SHALL be off whatever the cookie says. Vim mode SHALL apply to page editors and task description editors; titles, comment drafts and other text fields SHALL keep their usual keys. With Vim mode off, the editor SHALL behave exactly as without this capability.

#### Scenario: Setting survives reload
- **WHEN** Vim mode is turned on and the page is reloaded
- **THEN** the toggle is on and the editor is in Normal mode

#### Scenario: Not offered on touch devices
- **WHEN** the app is opened on a phone with the Vim mode cookie set
- **THEN** no Vim mode toggle shows and the editor behaves as without Vim mode

#### Scenario: Title keeps its keys
- **WHEN** Vim mode is on and "jk" is typed in the page title
- **THEN** the title ends with "jk"

### Requirement: Modes and the mode indicator
With Vim mode on, the editor SHALL be in one of three modes: Normal, Insert or Visual (characterwise). It SHALL start in Normal mode when a page opens; clicking into text SHALL keep the current mode (a click while in Visual SHALL return to Normal). A mode indicator in the editor ("NORMAL", "INSERT", "VISUAL") SHALL show the current mode and announce changes to screen readers.

#### Scenario: Starts in Normal
- **WHEN** a page opens with Vim mode on
- **THEN** the indicator says "NORMAL"

#### Scenario: Indicator follows the mode
- **WHEN** `i` is pressed in Normal mode
- **THEN** the indicator says "INSERT"

### Requirement: Normal mode cursor and input
In Normal mode the caret SHALL be shown as a block cursor over the character after the caret position (over the end of an empty line, or of an empty block, a cursor-sized box). No typed text SHALL reach the page in Normal mode: keys without a Normal-mode meaning SHALL do nothing, and IME composition started in Normal mode SHALL be cancelled without inserting text. In Normal mode the caret SHALL never rest after a block's last character: moving to a line's end SHALL put it on the last character.

#### Scenario: Typing does nothing in Normal
- **WHEN** "q" is typed in Normal mode
- **THEN** the page's text is unchanged

#### Scenario: `$` rests on the last character
- **WHEN** `$` is pressed in Normal mode in a paragraph "Hello"
- **THEN** the block cursor is over "o"

### Requirement: Counts and motions
In Normal and Visual mode a count (digits, not starting with 0) SHALL repeat the following motion or operator. The motions SHALL be: `h` and `l` (a character left and right, within the block), `w` and `b` (to the next and previous word start), `e` (to the next word end), `0` (the line's start), `^` (the line's first non-blank character), `$` (the line's last character), `gg` (the start of the cursor's block's first line) and `G` (the start of its last line); `gg` and `G` SHALL never leave the cursor's block. `w`, `b` and `e` SHALL move into the next or previous text block at a block's edge. `j` and `k` SHALL move a visual line down and up, and between blocks, as ↓ and ↑ do without Vim mode: keeping the column, moving by column in tables, and stopping at images, which are then selected whole; from a selected image `j` and `k` SHALL go on to the next stop. Lines SHALL be the block's lines as the browser lays them out, and a code block's lines its text lines.

#### Scenario: Count with a word motion
- **WHEN** `3w` is pressed at the start of "one two three four"
- **THEN** the cursor is at the start of "four"

#### Scenario: `j` across blocks keeps the column
- **WHEN** `j` is pressed on the third character of a one-line paragraph followed by another
- **THEN** the cursor is near the third character of the next paragraph

#### Scenario: `j` stops at an image
- **WHEN** `j` is pressed on the last line of a paragraph followed by an image, then `j` again
- **THEN** the first press selects the image and the second puts the cursor in the text block after it

#### Scenario: `gg` and `G` stay in the block
- **WHEN** `G` is pressed in the middle of a three-line code block that has paragraphs before and after it, then `gg`
- **THEN** the cursor goes to the start of the code block's last line, then to the start of its first line

### Requirement: Entering Insert mode
In Normal mode `i` SHALL enter Insert at the cursor, `a` after the cursor's character, `I` at the line's first non-blank character, `A` at the block's end; `o` and `O` SHALL add a block after or before the cursor's block and enter Insert in it, the new block taking the type Enter would give it (a list item after a list item, an unchecked to-do after a to-do, a paragraph otherwise). `Esc` in Insert SHALL return to Normal with the cursor one character back (not before the line's start); with a slash menu, mention menu, link card or formatting bar open, `Esc` SHALL first close it, and a second `Esc` return to Normal. In Insert mode every key SHALL behave as it does without Vim mode, except that `Esc` never selects the block.

#### Scenario: `A` then type
- **WHEN** `A` is pressed in a paragraph "Hello" and "!" is typed
- **THEN** the paragraph says "Hello!" and the indicator says "INSERT"

#### Scenario: `o` continues a list
- **WHEN** `o` is pressed in a bulleted list item
- **THEN** a new empty bulleted list item follows it, holding the cursor, in Insert

#### Scenario: Esc closes the slash menu first
- **WHEN** "/" is typed in Insert and Esc is pressed once
- **THEN** the slash menu closes and the indicator still says "INSERT"; a second Esc says "NORMAL"

### Requirement: Operators
In Normal mode: `x` SHALL delete the character under the cursor (with a count, that many, within the block); `dw` SHALL delete to the next word start and `d$` to the line's end; `cw` SHALL delete to the current word's end and enter Insert, `cc` SHALL empty the block's text and enter Insert in it. `dd` SHALL delete the cursor's block (with a count, that many blocks from it, in reading order, never sub-pages or suggestions) and put the cursor in the block after, or before when it was last; `yy` SHALL copy the cursor's block (with a count, that many blocks) into the editor's register without changing the page. `p` and `P` SHALL paste the register's blocks after or before the cursor's block, or, when the register holds text, after or at the cursor. Text deleted with `x`, `d` or `c` SHALL go into the register as text. Each operator SHALL be one undo step. `u` and `Ctrl-r` SHALL undo and redo, in Normal mode, returning to Normal afterwards.

#### Scenario: `dd` deletes the block
- **WHEN** `dd` is pressed in the second of three paragraphs
- **THEN** two paragraphs are left and the cursor is in the one that was third

#### Scenario: `yy` and `p` duplicate a block
- **WHEN** `yy` then `p` is pressed in a to-do "Buy milk"
- **THEN** a second to-do "Buy milk" follows it, and one `u` removes it

#### Scenario: `cw` changes a word
- **WHEN** `cw` is pressed at the start of "old value" and "new" is typed
- **THEN** the block says "new value" in Insert

#### Scenario: Count with `x`
- **WHEN** `3x` is pressed at the start of "abcdef"
- **THEN** the block says "def"

### Requirement: Visual mode
In Normal mode `v` SHALL enter Visual mode with the character under the cursor selected. In Visual mode the motions SHALL extend the selection from where it started, within a block or across blocks (as a text selection across blocks); `d` and `x` SHALL delete the selection, `c` SHALL delete it and enter Insert, `y` SHALL copy it into the register (and to the clipboard), each returning to Normal (Insert for `c`); `Esc` and `v` SHALL return to Normal with nothing changed.

#### Scenario: Select and delete across blocks
- **WHEN** `v` is pressed in the middle of a paragraph, then `j`, then `d`
- **THEN** the text from there to the same column of the next paragraph is removed and the two paragraphs are joined, in Normal

#### Scenario: Esc leaves Visual
- **WHEN** `v` then `w` then Esc is pressed
- **THEN** nothing is selected, the text is unchanged and the indicator says "NORMAL"

### Requirement: Leader key
In Normal mode Space SHALL be the leader key: followed within one second by `/` it SHALL open the slash menu at the cursor and enter Insert (as if "/" had been typed after the cursor's character); by `@` it SHALL open the page mention menu the same way; by `Esc` it SHALL select the cursor's block as `Esc` does without Vim mode (a table cell selecting its table). Space followed by nothing within one second, or by another key, SHALL do nothing (the other key is then not acted on). While blocks are selected, keys SHALL work as they do without Vim mode, and `Esc` SHALL end the block selection and return to Normal with the cursor where it was.

#### Scenario: Leader slash
- **WHEN** Space then `/` is pressed in Normal mode at the end of a paragraph
- **THEN** the slash menu opens and the indicator says "INSERT"

#### Scenario: Leader Esc selects the block
- **WHEN** Space then Esc is pressed in Normal mode in a paragraph
- **THEN** the paragraph is selected as a block

#### Scenario: Leader alone does nothing
- **WHEN** Space is pressed in Normal mode and nothing follows for a second
- **THEN** the page and the cursor are unchanged

### Requirement: Shortcuts in every mode
Shortcuts with Ctrl or Cmd (marks, links, turn into, select all, copy, cut, paste, undo and redo) SHALL work in every mode as they do without Vim mode; pasting in Normal mode SHALL paste at the cursor and stay in Normal. Esc SHALL be Vim's: it SHALL never select a block in Normal, Insert or Visual mode.

#### Scenario: Bold over a Visual selection
- **WHEN** a word is selected in Visual mode and Ctrl+B is pressed
- **THEN** the word is bold

#### Scenario: Esc in Normal
- **WHEN** Esc is pressed in Normal mode
- **THEN** nothing changes and no block is selected
