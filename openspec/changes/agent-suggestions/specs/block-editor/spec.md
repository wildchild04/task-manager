## MODIFIED Requirements

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
| suggestion | no (shows the proposed change, see agent-suggestions) | — | — | — |

A suggestion and the blocks inside it SHALL never hold the caret; the caret moves past a suggestion as it does past a divider, Tab SHALL NOT nest a block into a suggestion, and Backspace at the start of the block after a suggestion SHALL move the caret to the end of the previous text block without removing the suggestion.

#### Scenario: Leaving a list
- **WHEN** Enter is pressed in an empty bulleted list item
- **THEN** the item becomes a paragraph at the same position

#### Scenario: Heading continues as a paragraph
- **WHEN** Enter is pressed at the end of a heading
- **THEN** a new paragraph follows the heading and holds the caret

#### Scenario: Backspace after a suggestion
- **WHEN** Backspace is pressed at the start of a paragraph that follows a suggestion
- **THEN** the suggestion is still there, and the caret is at the end of the text block before it

### Requirement: Edits stay inside the edited page
The server SHALL accept an edit batch only if every block it touches is in the edited page's own content, outside any sub-page's content; it SHALL reject a batch that deletes a sub-page, deletes or changes the type of the page block itself, or inserts a page, comment or suggestion block. It SHALL also reject a batch that inserts into, updates or deletes a suggestion, that updates, moves or deletes a block inside one, or that deletes a block containing a suggestion; suggestions change only by being approved or rejected. Moving a suggestion as a whole (its proposed blocks go with it), moving a block that contains one, and editing or deleting a suggestion's target, SHALL be allowed. A rejected batch SHALL change nothing.

#### Scenario: Batch outside the page
- **WHEN** an edit batch for page A updates a block of page B
- **THEN** the server rejects it and neither page changes

#### Scenario: Deleting a sub-page through an edit
- **WHEN** an edit batch deletes a sub-page block
- **THEN** the server rejects it and the sub-page still exists

#### Scenario: Changing a suggestion through an edit
- **WHEN** an edit batch updates the content of a block inside a suggestion
- **THEN** the server rejects it and the suggestion is unchanged

#### Scenario: Outdenting past a suggestion
- **WHEN** Shift+Tab is pressed in a nested list item whose following sibling is a suggestion
- **THEN** the item moves out and the suggestion, unchanged, becomes its child

#### Scenario: Editing a suggestion's target
- **WHEN** an edit batch changes the text of a block that a pending replace suggestion targets
- **THEN** the edit is saved and the suggestion becomes outdated
