## ADDED Requirements

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
Copying a selection that spans several blocks SHALL put Markdown on the clipboard as plain text: every block from the start of the selection to its end, the first and last text blocks with only their selected text, tables and code blocks whole, and the children of each included block, with mentions written as `@Title` and links to app pages as their full URLs. It SHALL also put the same content in a format only this app reads, which keeps mentions and page links exactly, so pasting it back into the app rebuilds the same blocks. Copying within one block SHALL keep the browser's plain text and add that app-only format with the selection's marks.

#### Scenario: Copy a list and a table
- **WHEN** a heading, two bulleted items and a table are selected and copied
- **THEN** the clipboard's text is "## Heading\n\n- one\n- two\n\n| a | b |\n|---|---|\n| 1 | 2 |"

#### Scenario: Copy and paste within the app
- **WHEN** a paragraph with a mention of "Architecture" and the list after it are copied and pasted into another page
- **THEN** the other page gets a paragraph with a mention of "Architecture" and the same list
