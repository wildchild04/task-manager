## MODIFIED Requirements

### Requirement: MCP server for agents
A stdio MCP server in `mcp/` SHALL expose the agent API as tools — `list_projects`, `list_tasks`, `create_task`, `get_task`, `read_description`, `read_project_description`, `list_comments`, `list_history`, `list_references`, `transition`, `comment`, `append_description`, `list_steps`, `add_step`, `update_step`, `list_diagnostics`, `add_diagnostic`, `update_diagnostic`, `mark_diagnostic_incorrect`, `clear_diagnostic_mark`, `get_or_create_shift`, `suggest_transition`, `search_pages`, `read_page`, `create_page`, `suggest`, `get_suggestion`, `withdraw_suggestion`, `get_markdown_guide` — with parameters matching the API's requests (`read_page`, `read_description` and `read_project_description` taking `anchors`). It SHALL be configured by `APP_URL`, `AGENT_TOKEN` and `AGENT_NAME`, and send the token and name with every call. Each tool's description SHALL state what it returns, its defaults and caps, and how to ask for more; `suggest`'s description SHALL say to read with `anchors: true` first to get block IDs, and that a human approves or rejects every suggestion; every tool that takes Markdown SHALL point to `get_markdown_guide` and say that unsupported Markdown comes back as `warnings`. Tool results SHALL be the API's response, compact (no added fields, no pretty-printing); API errors SHALL come back as tool errors with the API's code and message.

#### Scenario: Tool call
- **WHEN** an agent calls `list_tasks` with `state: "todo"` and `limit: 3`
- **THEN** the result is at most three `{ id, kind, state, title }` entries and `more`, and nothing else

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

### Requirement: Tool annotations
Every tool SHALL declare MCP annotations with `openWorldHint: false`. The tools that only read — `list_projects`, `list_tasks`, `get_task`, `read_description`, `read_project_description`, `list_comments`, `list_history`, `list_references`, `list_steps`, `list_diagnostics`, `search_pages`, `read_page`, `get_suggestion`, `get_markdown_guide` — SHALL declare `readOnlyHint: true`. Every other tool SHALL declare `readOnlyHint: false` with `destructiveHint` (`true` only for `update_step`, `update_diagnostic` and `withdraw_suggestion`, which overwrite or remove the agent's own content) and `idempotentHint` (`true` for `update_step`, `update_diagnostic`, `mark_diagnostic_incorrect`, `clear_diagnostic_mark`, `get_or_create_shift` and `withdraw_suggestion`). `suggest_transition` SHALL declare `destructiveHint: false` and `idempotentHint: true` (suggesting again replaces the agent's own).

#### Scenario: Reads are marked read-only
- **WHEN** a client lists the tools
- **THEN** `read_page` has `readOnlyHint: true`, and `transition` has `readOnlyHint: false` and `destructiveHint: false`

#### Scenario: Overwrites are marked destructive
- **WHEN** a client lists the tools
- **THEN** `update_diagnostic` has `destructiveHint: true` and `idempotentHint: true`
