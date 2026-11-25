## MODIFIED Requirements

### Requirement: Reviewing suggestions on a page
On every page and task description that shows content, a suggestion SHALL be shown in place as one enclosed, highlighted (yellow) region showing its author, its action ("Suggests adding", "Suggests replacing", "Suggests deleting"), its note, "Outdated" when it is, and **Approve** (not shown when outdated) and **Reject**. Inside the region, the proposed blocks SHALL be shown as an addition (labelled "Proposed", tinted green) and, for a replace or delete, a struck-through copy of the target's current content as a deletion (labelled "Removed", tinted red), so old and new are told apart by label as well as colour. For a replace whose target is not a table and has nested blocks, the proposed section SHALL say how many direct nested blocks are retained and whether they go under the first proposed block or after the proposed blocks when the first cannot hold them. In the editor, the target itself SHALL be marked in place the same way as the region's "Removed" part (red tint and red bar), so what would go is recognisable at both places; the copy inside the region SHALL NOT be marked again. Line breaks in the target's text SHALL show in both places. The page SHALL show how many suggestions are pending.

#### Scenario: A replace on the page
- **WHEN** a page with a pending replace suggestion from "builder" is opened
- **THEN** the target paragraph is marked red in place, and a yellow region after it shows "builder", "Suggests replacing", the old text struck through under "Removed" in red, the new blocks under "Proposed" in green, and Approve and Reject

#### Scenario: Approve from the page
- **WHEN** Approve is chosen on an insert suggestion
- **THEN** the region is replaced by the proposed blocks as ordinary content, and Undo is offered

#### Scenario: Retained nested blocks
- **WHEN** a replacement targets a bullet with two nested bullets
- **THEN** the proposed section says those two blocks stay under the first proposed block
