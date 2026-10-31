## ADDED Requirements

### Requirement: Change feed
Every committed write to the store (a batch of block operations, or any other change made in one transaction) SHALL advance a change number by one and notify subscribers with the new number, whatever made the write: the editor, a form, the agent API or MCP. A write that is rejected and commits nothing SHALL NOT advance it. The feed SHALL be chosen in the composition module with the repositories, and exist for both the SQLite and the in-memory services.

#### Scenario: An agent's comment advances the feed
- **WHEN** an agent comments on a task through the agent API while the change number is 41
- **THEN** subscribers are notified with 42 once the comment is stored

#### Scenario: A rejected edit doesn't
- **WHEN** an edit batch is refused by validation
- **THEN** the change number stays as it was and no subscriber is notified

### Requirement: Change event stream
`GET /api/changes` SHALL answer a Server-Sent Events stream (`text/event-stream`, not cached or compressed) that starts with a `hello` event holding the current change number, then sends a `change` event holding the new number after each committed write, and a comment line at least every 30 seconds while nothing changes. The stream SHALL carry change numbers only, never content. When the client goes away the server SHALL stop listening for it. It SHALL work behind the reverse proxy under the app's base path without proxy configuration.

#### Scenario: Events arrive as writes happen
- **WHEN** a tab is connected to `/api/changes` and a page is edited in another tab
- **THEN** the connected tab receives a `change` event with the new number within a second

#### Scenario: Through the production server
- **WHEN** the stream is requested from the production server, which compresses responses
- **THEN** the `hello` event arrives at once and uncompressed

### Requirement: Open tabs refresh themselves
Every open screen SHALL subscribe to the change stream and, when a change not made by its own editor arrives, re-read its data without reloading the page, so the sidebar, notification bell and the screen's content show it. Several changes arriving close together SHALL cause one re-read. A tab that is hidden SHALL wait until it is visible again to re-read. When the stream is lost (a network error, or the server answering an error while it restarts) the tab SHALL keep trying to reconnect, waiting longer each time up to 30 seconds, and once reconnected SHALL re-read its data if anything changed meanwhile or the server restarted.

#### Scenario: An agent's comment appears
- **WHEN** a task is open and an agent comments on it through MCP
- **THEN** the comment appears on the open task, and the notification bell shows it, without navigating

#### Scenario: A second tab follows
- **WHEN** the same page is open in two tabs and a paragraph is added in one
- **THEN** the paragraph appears in the other tab without reloading it

#### Scenario: Own saves don't refresh
- **WHEN** text is typed in a page's editor and saved
- **THEN** that tab doesn't re-read its data because of its own saves

#### Scenario: After a redeploy
- **WHEN** the server restarts while a tab is open, and a task is created while it's down and then back
- **THEN** the tab reconnects by itself once the server answers and shows the new task
