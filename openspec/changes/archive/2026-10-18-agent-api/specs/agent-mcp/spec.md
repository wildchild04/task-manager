## ADDED Requirements

### Requirement: MCP server for agents
A stdio MCP server in `mcp/` SHALL expose the agent API as tools — `list_projects`, `list_tasks`, `get_task`, `read_description`, `list_comments`, `list_references`, `transition`, `comment`, `append_description`, `search_pages`, `read_page` — with parameters matching the API's requests. It SHALL be configured by `APP_URL`, `AGENT_TOKEN` and `AGENT_NAME`, and send the token and name with every call. Each tool's description SHALL state what it returns, its defaults and caps, and how to ask for more. Tool results SHALL be the API's response, compact (no added fields, no pretty-printing); API errors SHALL come back as tool errors with the API's code and message.

#### Scenario: Tool call
- **WHEN** an agent calls `list_tasks` with `state: "todo"` and `limit: 3`
- **THEN** the result is at most three `{ id, kind, state, title }` entries and `more`, and nothing else

#### Scenario: Refused change
- **WHEN** an agent calls `transition` with `name: "cancel"`
- **THEN** the tool returns an error with code `forbidden`

#### Scenario: Missing configuration
- **WHEN** the server starts without `AGENT_TOKEN` or `AGENT_NAME`
- **THEN** it exits with a message naming the missing variable
