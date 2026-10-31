# agent-mcp Specification

## Purpose
TBD - created by archiving change agent-api. Update Purpose after archive.
## Requirements
### Requirement: MCP server for agents
A stdio MCP server in `mcp/` SHALL expose the agent API as tools — `list_projects`, `create_project`, `list_tasks`, `create_task`, `get_task`, `read_description`, `list_comments`, `list_references`, `transition`, `comment`, `append_description`, `list_findings`, `add_finding`, `edit_finding`, `delete_finding`, `search_pages`, `read_page`, `create_page`, `suggest`, `suggest_action`, `get_suggestion`, `withdraw_suggestion`, `get_markdown_guide` — with parameters matching the API's requests (`read_page` and `read_description` taking `anchors`). It SHALL be configured by `APP_URL`, `AGENT_TOKEN` and `AGENT_NAME`, and send the token and name with every call. Each tool's description SHALL state what it returns, its defaults and caps, and how to ask for more; `add_finding`'s description SHALL say that findings record an exploration's results, are added without approval, and that an agent may edit and delete only its own; `suggest`'s description SHALL say to read with `anchors: true` first to get block IDs, and that a human approves or rejects every suggestion; `suggest_action`'s description SHALL list what can be suggested (renaming or deleting a project, page or task, a chore's schedule, and the ending transitions) and say that a human approves or rejects it; every tool that takes Markdown SHALL point to `get_markdown_guide` and say that unsupported Markdown comes back as `warnings`. Tool results SHALL be the API's response, compact (no added fields, no pretty-printing); API errors SHALL come back as tool errors with the API's code and message.

#### Scenario: Tool call
- **WHEN** an agent calls `list_tasks` with `state: "todo"` and `limit: 3`
- **THEN** the result is at most three `{ id, kind, state, title }` entries and `more`, and nothing else

#### Scenario: Refused change
- **WHEN** an agent calls `transition` with a transition not allowed from the task's state
- **THEN** the tool returns an error with code `invalid_transition`

#### Scenario: Missing configuration
- **WHEN** the server starts without `AGENT_TOKEN` or `AGENT_NAME`
- **THEN** it exits with a message naming the missing variable

#### Scenario: Suggest through the tools
- **WHEN** an agent calls `read_page` with `anchors: true`, then `suggest` with `action: "insert"` and `after` set to an anchor from it
- **THEN** the result is `{ ok, id }`, and `get_suggestion` with that ID reports `pending`

#### Scenario: Learning the Markdown
- **WHEN** an agent calls `get_markdown_guide`
- **THEN** the result is the API's guide, listing the supported blocks and what isn't supported

#### Scenario: Findings through the tools
- **WHEN** an agent calls `add_finding` on an exploration, then `list_findings` on it
- **THEN** the first result is `{ ok, id }`, and the list starts with that finding by the agent

#### Scenario: Suggesting an action through the tools
- **WHEN** an agent calls `suggest_action` with `action: "delete"` and a `page`
- **THEN** the result is `{ ok, id }`, and `get_suggestion` reports it `pending` with the page as its subject

#### Scenario: Creating a project through the tools
- **WHEN** an agent calls `create_project` with the title "Garden"
- **THEN** the result is `{ ok, id }`, and `list_projects` includes "Garden"

