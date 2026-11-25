## MODIFIED Requirements

### Requirement: Agents suggest changes
`POST suggest` SHALL create a suggestion (see agent-suggestions) by the calling agent, on `page` (a page ID as for `GET page/:id`) or on `task` (a task ID: its description), exactly one of them. For `insert`, `after` (a block to follow) or `inside` (a block to append under) MAY be given, at most one, and the end of the page is the default; `markdown` holds the proposed blocks. For `replace`, `target` and `markdown` are required; for `delete`, `target` is required and `markdown` SHALL NOT be given. Block IDs SHALL be resolved by their 8-character prefix within the page's own content. `note` SHALL be at most 280 characters. A replacement of a non-table target with nested blocks SHALL return a warning when the proposed Markdown also contains nested blocks. The warning SHALL say how many direct nested blocks are kept, whether they move under the first proposed block or after the proposed blocks when the first cannot hold children, and not to repeat them. A request that breaks these rules or the placement rules of agent-suggestions SHALL be refused with status 422 (code `validation`); an unknown page, task or block with status 404 (code `not_found`); nothing SHALL be created when a request is refused. `GET suggestion/:id` SHALL report the suggestion's status: `pending`, `outdated`, `approved`, `rejected` or `withdrawn`. `POST suggestion/:id/withdraw` SHALL withdraw the calling agent's own pending or outdated suggestion; another agent's SHALL be refused with status 403 (code `forbidden`), and a resolved one with status 409 (code `resolved`).

#### Scenario: Suggest bullets into an exploration
- **WHEN** "planner" reads exploration "Block editor v1" with anchors and suggests inserting "- Tables\n- Code blocks" after its last bullet, with the note "From the content audit"
- **THEN** the answer is `{ ok: true, id }`, the description shows the pending suggestion after that bullet, and `GET suggestion/:id` reports `pending`

#### Scenario: Replace needs Markdown
- **WHEN** an agent suggests a `replace` with a target and no `markdown`
- **THEN** it is refused with code `validation` and nothing is created

#### Scenario: Withdraw another agent's suggestion
- **WHEN** "reviewer" calls `POST suggestion/:id/withdraw` on a suggestion by "builder"
- **THEN** it is refused with code `forbidden` and the suggestion stays pending

#### Scenario: Status after approval
- **WHEN** the human approves a suggestion and its agent asks for its status
- **THEN** the answer reports `approved` with `resolvedAt`

#### Scenario: Replace with nested blocks
- **WHEN** a replacement proposes nested blocks for a non-table target with two nested blocks
- **THEN** it is created with a warning that the existing nested blocks are retained and should not be repeated
