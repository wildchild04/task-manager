## MODIFIED Requirements

### Requirement: MCP server for agents
A stdio MCP server in `mcp/` SHALL expose the agent API as tools — `list_projects`, `create_project`, `list_tasks`, `create_task`, `get_task`, `read_description`, `list_comments`, `list_references`, `transition`, `comment`, `append_description`, `list_findings`, `add_finding`, `edit_finding`, `delete_finding`, `search_pages`, `read_page`, `read_page_asset`, `create_page`, `suggest`, `suggest_action`, `list_suggestions`, `get_suggestion`, `revise_suggestion`, `withdraw_suggestion`, `get_markdown_guide` — with parameters matching the API's requests (`read_page` and `read_description` taking `anchors`). It SHALL be configured by `APP_URL` and `AGENT_TOKEN` (the agent's own token, which decides its name), and send the token with every call; `AGENT_NAME` SHALL be ignored when set. Each tool's description SHALL state what it returns, its defaults and caps, and how to ask for more; `add_finding`'s description SHALL say that findings record an exploration's results, are added without approval, and that an agent may edit and delete only its own; `suggest`'s description SHALL say to read with `anchors: true` first to get block IDs, and that a human approves or rejects every suggestion; `suggest_action`'s description SHALL list what can be suggested (renaming or deleting a project, page or task, a chore's schedule, and the ending transitions) and say that a human approves or rejects it; `list_suggestions`'s description SHALL say it lists only the agent's own open suggestions and that `changes_requested` ones have feedback to read with `get_suggestion`; `revise_suggestion`'s description SHALL say it changes the same suggestion in place, which fields fit which action, and to withdraw and suggest again to change the action, target or subject; every tool that takes Markdown SHALL point to `get_markdown_guide` and say that unsupported Markdown comes back as `warnings`. `read_page_asset`'s description SHALL say it returns an uploaded image listed in `assets` by `read_page` or `read_description`, that external image URLs are never fetched, and which formats come back. Tool results SHALL be the API's response, compact (no added fields, no pretty-printing), except `read_page_asset`, whose result SHALL be the image as MCP image content (its bytes and MIME type) followed by a text item with the API's response without `data`; API errors SHALL come back as tool errors with the API's code and message.

#### Scenario: Tool call
- **WHEN** an agent calls `list_tasks` with `state: "todo"` and `limit: 3`
- **THEN** the result is at most three `{ id, kind, state, title }` entries and `more`, and nothing else

#### Scenario: Refused change
- **WHEN** an agent calls `transition` with a transition not allowed from the task's state
- **THEN** the tool returns an error with code `invalid_transition`

#### Scenario: Missing configuration
- **WHEN** the server starts without `APP_URL` or `AGENT_TOKEN`
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

#### Scenario: Revising through the tools
- **WHEN** the human requested changes on an agent's suggestion, and the agent calls `list_suggestions` with `state: "changes_requested"`, `get_suggestion`, then `revise_suggestion`
- **THEN** the list includes it, `get_suggestion` shows the `feedback`, and `revise_suggestion` returns `{ ok, revision }`

#### Scenario: Looking at an image through the tools
- **WHEN** an agent calls `read_page` on a page holding an uploaded PNG, then `read_page_asset` with the page and the ID from `assets`
- **THEN** the result is an image item with `mimeType: "image/png"` and the image's bytes, then a text item `{"id":…,"type":"image/png","size":…,"width":…,"height":…}`
