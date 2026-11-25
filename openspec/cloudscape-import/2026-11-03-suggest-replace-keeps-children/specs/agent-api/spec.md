## MODIFIED Requirements

### Requirement: Agents suggest changes
`POST suggest` SHALL create a suggestion (see agent-suggestions) by the calling agent, on `page` (a page ID as for `GET page/:id`), on `task` (a task ID: its description) or on `project` (a project ID: its description, the project home), exactly one of them. For `insert`, `after` (a block to follow) or `inside` (a block to append under) MAY be given, at most one, and the end of the page is the default; `markdown` holds the proposed blocks. For `replace`, `target` and `markdown` are required; for `delete`, `target` is required and `markdown` SHALL NOT be given. Block IDs SHALL be resolved by their 8-character prefix within the page's own content. `note` SHALL be at most 280 characters. A `replace` whose target (not a table) has nested blocks and whose proposed blocks have nested blocks of their own SHALL still be created, and its answer SHALL carry a `warnings` entry saying the target's nested blocks are kept under the first proposed block, so they shouldn't be repeated. A request that breaks these rules or the placement rules of agent-suggestions SHALL be refused with status 422 (code `validation`); an unknown page, task or block with status 404 (code `not_found`); nothing SHALL be created when a request is refused. `GET suggestion/:id` SHALL report the suggestion's status: `pending`, `outdated`, `approved`, `rejected` or `withdrawn`. `POST suggestion/:id/withdraw` SHALL withdraw the calling agent's own pending or outdated suggestion; another agent's SHALL be refused with status 403 (code `forbidden`), and a resolved one with status 409 (code `resolved`).

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

#### Scenario: Suggest on a project's description
- **WHEN** "planner" reads project "Garden"'s description with anchors and suggests inserting "- Build raised beds" after "Grow tomatoes"
- **THEN** the answer is `{ ok: true, id }`, `GET suggestion/:id` reports `pending` with place `project:<id>`, and the project home shows the suggestion after that paragraph

#### Scenario: Replace repeating the nested blocks
- **WHEN** an agent suggests replacing the bullet "P" (with sub-bullets "C1" and "C2") with `- P'\n  - C1\n  - C2`
- **THEN** the suggestion is created and the answer's `warnings` say the 2 nested blocks are kept and shouldn't be repeated; replacing it with `- P'` alone gives no warning, and after approval the page reads "P'" with "C1" and "C2" once
