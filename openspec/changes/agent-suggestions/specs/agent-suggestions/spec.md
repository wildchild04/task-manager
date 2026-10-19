## ADDED Requirements

### Requirement: Suggestions
A suggestion SHALL be an agent's proposed change to the own content of one page (a workspace page, a library document, or a task's description), stored as a `suggestion` block at the place it applies, with the proposed blocks as its children. Its action SHALL be one of:
- **insert**: new blocks after a given block (in the same parent), as the last children of a given block, or at the end of the page;
- **replace**: new blocks in place of one target block; the suggestion is placed right after the target;
- **delete**: removing one target block and its children; the suggestion is placed right after the target and has no children.

Insert and replace SHALL have at least one proposed block. Positions and targets SHALL be in the page's own content: not inside a sub-page's content, not inside a suggestion, and not a sub-page or a suggestion themselves. Proposed blocks SHALL NOT include pages, comments or suggestions. A suggestion that breaks these rules SHALL be refused and nothing SHALL be created.

#### Scenario: Insert after a block
- **WHEN** agent "planner" suggests inserting two bullets after the bullet "Deleting blocks with Backspace" in the exploration "Block editor v1"
- **THEN** a pending suggestion by "planner" follows that bullet in the description, holding the two bullets, and the description's own bullets are unchanged

#### Scenario: Target inside a sub-page
- **WHEN** an agent suggests replacing a block that belongs to a sub-page's content, through the parent page
- **THEN** it is refused and nothing is created

### Requirement: Suggestion record and status
Every suggestion SHALL have a record with its author (the agent's name), action, target (for replace and delete), an optional note, when it was made, and its status: `pending`, `approved`, `rejected` or `withdrawn`, with when it was resolved. The record SHALL remain after the suggestion leaves the page. A pending replace or delete SHALL additionally be reported as `outdated` when its target no longer exists, or when the target's type, props or content (for delete, its whole subtree) differ from when the suggestion was made.

#### Scenario: Target edited after the suggestion
- **WHEN** an agent suggests replacing the paragraph "Ship on Monday", and the human then changes it to "Ship on Tuesday"
- **THEN** the suggestion's status is `outdated`

#### Scenario: Record after rejection
- **WHEN** a suggestion is rejected
- **THEN** it is no longer on the page, and its record has status `rejected` with when it was resolved

### Requirement: Approving a suggestion
Approving a pending suggestion that isn't outdated SHALL apply it in one step: for insert, the proposed blocks take the suggestion's place; for replace, the proposed blocks take the target's place, the target is removed, and the target's children move under the first proposed block; for delete, the target and its children are removed. The suggestion block SHALL be removed and its record set to `approved`. Approving an outdated suggestion SHALL be refused, changing nothing. Only humans SHALL approve.

#### Scenario: Approve an insert
- **WHEN** the human approves a suggestion inserting the bullet "Tables" after the bullet "Code blocks"
- **THEN** "Tables" is an ordinary bullet right after "Code blocks", no suggestion remains, and the record is `approved`

#### Scenario: Approve a replace
- **WHEN** the human approves a suggestion replacing the toggle "Notes" (which has two children) with the heading "Notes"
- **THEN** the heading stands where the toggle was, with the toggle's two children nested under it

#### Scenario: Outdated can't be approved
- **WHEN** the human tries to approve an outdated suggestion
- **THEN** it is refused with a message that the block changed since it was suggested, and the page is unchanged

### Requirement: Rejecting a suggestion
Rejecting a pending or outdated suggestion SHALL remove the suggestion block and its proposed blocks, leave the rest of the page unchanged, and set its record to `rejected`. Only humans SHALL reject.

#### Scenario: Reject a delete
- **WHEN** the human rejects a suggestion to delete the paragraph "Legacy notes"
- **THEN** "Legacy notes" is still there and no suggestion remains

### Requirement: Withdrawing a suggestion
The agent that made a pending or outdated suggestion SHALL be able to withdraw it: the suggestion block and its proposed blocks are removed, the rest of the page is unchanged, and its record is set to `withdrawn`. Withdrawing another agent's suggestion, or one that is already resolved, SHALL be refused. Withdrawing SHALL offer no undo.

#### Scenario: Withdraw own suggestion
- **WHEN** "builder" withdraws its pending insert suggestion
- **THEN** the suggestion is no longer on the page and its record is `withdrawn`

#### Scenario: Another agent's suggestion
- **WHEN** "reviewer" tries to withdraw a suggestion made by "builder"
- **THEN** it is refused and the suggestion stays pending

### Requirement: Undoing an approval or rejection
After approving or rejecting a suggestion, the page SHALL offer **Undo** until the next edit to that page. Undo SHALL restore the page as it was before, with the suggestion pending again.

#### Scenario: Undo an approval
- **WHEN** the human approves a replace and then chooses Undo
- **THEN** the original block is back, the suggestion is pending again in its place, and its record is `pending`

### Requirement: Approve all and reject all
A page with more than one pending suggestion SHALL offer **Approve all** and **Reject all**, applying to that page's pending suggestions in document order as one step. Approve all SHALL skip outdated suggestions and report how many were approved and how many were skipped.

#### Scenario: Approve all with one outdated
- **WHEN** a page has three pending suggestions, one of them outdated, and Approve all is chosen
- **THEN** two are approved, the outdated one stays pending, and the page reports "2 approved, 1 outdated"

### Requirement: Reviewing suggestions on a page
On every page and task description that shows content, a suggestion SHALL be shown in place as one enclosed, highlighted (yellow) region showing its author, its action ("Suggests adding", "Suggests replacing", "Suggests deleting"), its note, "Outdated" when it is, and **Approve** (not shown when outdated) and **Reject**. A replace or delete SHALL also show a struck-through copy of the target's current content inside the region, and the target SHALL be marked at its own position. The page SHALL show how many suggestions are pending.

#### Scenario: A replace on the page
- **WHEN** a page with a pending replace suggestion from "builder" is opened
- **THEN** the target paragraph is marked, and a yellow region after it shows "builder", "Suggests replacing", the old text struck through, the new blocks, and Approve and Reject

#### Scenario: Approve from the page
- **WHEN** Approve is chosen on an insert suggestion
- **THEN** the region is replaced by the proposed blocks as ordinary content, and Undo is offered
