## MODIFIED Requirements

### Requirement: Suggestions
A suggestion SHALL be an agent's proposed change to the own content of one page (a workspace page, a library document, or a task's description), stored as a `suggestion` block at the place it applies, with the proposed blocks as its children. Its action SHALL be one of:
- **insert**: new blocks after a given block (in the same parent), as the last children of a given block, or at the end of the page;
- **replace**: new blocks in place of one target block; the suggestion is placed right after the target;
- **delete**: removing one target block and its children; the suggestion is placed right after the target and has no children.

Insert and replace SHALL have at least one proposed block. Positions and targets SHALL be in the page's own content: not inside a sub-page's content, not inside a suggestion, and not a sub-page or a suggestion themselves. A whole table MAY be a position or target, but its rows and cells SHALL NOT be, and nothing SHALL be inserted inside a table. Proposed blocks SHALL NOT include pages, comments or suggestions. A suggestion that breaks these rules SHALL be refused and nothing SHALL be created.

#### Scenario: Insert after a block
- **WHEN** agent "planner" suggests inserting two bullets after the bullet "Deleting blocks with Backspace" in the exploration "Block editor v1"
- **THEN** a pending suggestion by "planner" follows that bullet in the description, holding the two bullets, and the description's own bullets are unchanged

#### Scenario: Target inside a sub-page
- **WHEN** an agent suggests replacing a block that belongs to a sub-page's content, through the parent page
- **THEN** it is refused and nothing is created

#### Scenario: A cell can't be targeted
- **WHEN** an agent suggests replacing one cell of a table
- **THEN** it is refused, and it can instead suggest replacing the whole table
