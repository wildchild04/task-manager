## MODIFIED Requirements

### Requirement: MCP server for agents

A stdio MCP server in `mcp/` SHALL expose the agent API as tools — `list_projects`, `list_tasks`, `create_task`, `get_task`, `read_description`, `read_project_description`, `list_comments`, `list_history`, `list_references`, `transition`, `comment`, `append_description`, `list_steps`, `update_step`, `list_diagnostics`, `add_diagnostic`, `update_diagnostic`, `mark_diagnostic_incorrect`, `clear_diagnostic_mark`, `get_or_create_shift`, `suggest_transition`, `search_pages`, `read_page`, `create_page`, `suggest`, `list_suggestions`, `get_suggestion`, `withdraw_suggestion`, `get_markdown_guide` — with parameters matching the API's requests (`read_page`, `read_description` and `read_project_description` taking `anchors`). It SHALL be configured by `APP_URL`, `AGENT_TOKEN` and `AGENT_NAME`, and send the token and name with every call. At startup it SHALL fill in `${VAR}` and `${VAR:-fallback}` in `AGENT_NAME` from its environment, and nothing else: a variable that is unset or empty uses its fallback, and one without a fallback, a name that ends up empty, or one holding control characters SHALL stop the server with a message naming the problem. The launcher SHALL pass a profile's `AGENT_NAME` through unexpanded, and an `AGENT_NAME` already in the environment SHALL win over the profile's. `list_steps` and `update_step` SHALL say they work on a ticket's triage steps, and that other kinds (experiments included) have none. Each tool's description SHALL state what it returns, its defaults and caps, and how to ask for more; `suggest`'s description SHALL say to read with `anchors: true` first to get block IDs, and that a human approves or rejects every suggestion; every tool that takes Markdown SHALL point to `get_markdown_guide` and say that unsupported Markdown comes back as `warnings`. Tool results SHALL be the API's response, compact (no added fields, no pretty-printing), as text and as `structuredContent`; every tool SHALL declare an `outputSchema` describing its response, and the structured content SHALL match it. API errors SHALL come back as tool errors with the API's code and message, without structured content.

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

#### Scenario: A name per pane

- **WHEN** two sessions start the server with the profile line `AGENT_NAME=kiro-${HERDR_PANE_ID:-local}`, in panes `wQ:p4` and `wQ:p5`
- **THEN** they act as `kiro-wQ:p4` and `kiro-wQ:p5`, and a work task one started can't be completed by the other

#### Scenario: No pane

- **WHEN** the server starts with that template and no `HERDR_PANE_ID`
- **THEN** it acts as `kiro-local`

#### Scenario: Missing variable

- **WHEN** the server starts with `AGENT_NAME=kiro-${HERDR_PANE_ID}` and no `HERDR_PANE_ID`
- **THEN** it exits with a message naming `${HERDR_PANE_ID}`

#### Scenario: Steps are a ticket's

- **WHEN** a client lists the tools
- **THEN** there are 29, with no `add_step`, and `list_steps` and `update_step` describe a ticket's triage steps

#### Scenario: Structured results
- **WHEN** a client lists the tools and calls `get_task`
- **THEN** every tool has an object `outputSchema`, and the result's `structuredContent` equals its text parsed as JSON and matches `get_task`'s schema

#### Scenario: Errors have no structured content
- **WHEN** an agent calls `get_task` with an unknown ID
- **THEN** the result is a tool error `not_found: …` with no `structuredContent`
