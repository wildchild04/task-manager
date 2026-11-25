## MODIFIED Requirements

### Requirement: MCP server for agents
A stdio MCP server in `mcp/` SHALL expose the agent API as tools — `list_projects`, `create_project`, `list_tasks`, `create_task`, `get_task`, `read_description`, `list_comments`, `list_references`, `transition`, `comment`, `list_findings`, `add_finding`, `edit_finding`, `delete_finding`, `append_description`, `search_pages`, `read_page`, `read_page_asset`, `create_page`, `suggest`, `suggest_action`, `get_suggestion`, `list_suggestions`, `revise_suggestion`, `withdraw_suggestion`, `get_markdown_guide` — with parameters matching the API's requests (`read_page` and `read_description` taking `anchors`). It SHALL be configured by `APP_URL`, `AGENT_TOKEN` and `AGENT_NAME`, and send the token and name with every call. Each tool's description SHALL state what it returns, its defaults and caps, and how to ask for more; `suggest`'s description SHALL say to read with `anchors: true` first to get block IDs, and that a human approves or rejects every suggestion; every tool that takes Markdown SHALL point to `get_markdown_guide` and say that unsupported Markdown comes back as `warnings`. Tool results SHALL be the API's response, compact (no added fields, no pretty-printing); API errors SHALL come back as tool errors with the API's code and message.

#### Scenario: Tool call
- **WHEN** an agent calls `list_tasks` with `state: "todo"` and `limit: 3`
- **THEN** the result is at most three `{ id, fullId, kind, state, title }` entries and `more`, and nothing else

#### Scenario: Refused change
- **WHEN** an agent calls `transition` with `name: "cancel"`
- **THEN** the tool returns an error with code `forbidden`

#### Scenario: Missing configuration
- **WHEN** the server starts without `AGENT_TOKEN` or `AGENT_NAME`
- **THEN** it exits with a message naming the missing variable

#### Scenario: Suggest through the tools
- **WHEN** an agent calls `read_page` with `anchors: true`, then `suggest` with `action: "insert"` and `after` set to an anchor from it
- **THEN** the result is `{ ok, id }`, and `get_suggestion` with that ID reports `pending`

#### Scenario: Learning the Markdown
- **WHEN** an agent calls `get_markdown_guide`
- **THEN** the result is the API's guide, listing the supported blocks and what isn't supported

## ADDED Requirements

### Requirement: Tool annotations
Every tool SHALL declare MCP annotations with `openWorldHint: false`. Read-only tools SHALL declare `readOnlyHint: true`; all others SHALL declare `readOnlyHint: false` and explicit `destructiveHint` and `idempotentHint` values. Editing or deleting a finding, revising a suggestion, and withdrawing a suggestion SHALL be marked destructive. Editing a finding and withdrawing a suggestion SHALL be marked idempotent.

#### Scenario: Reads are marked read-only
- **WHEN** a client lists the tools
- **THEN** `read_page` has `readOnlyHint: true`, and `transition` has `readOnlyHint: false` and `destructiveHint: false`

#### Scenario: Overwrites are marked destructive
- **WHEN** a client lists the tools
- **THEN** `edit_finding` has `destructiveHint: true` and `idempotentHint: true`
