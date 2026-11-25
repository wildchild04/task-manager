## Why

Bug (from "Short-form mentions so long titles don't stretch tables"): in the editor a mention couldn't wrap (`white-space: nowrap`), so a mention of a task with a long title, such as those in the Kiro Agents page's Project column, stayed on one line and stretched its table column, pushing the table into sideways scrolling. Read-only, mentions already wrapped.

## What Changes

- Mentions in the editor wrap like the text around them (`overflow-wrap: anywhere`), as they do read-only.

## Capabilities

### Modified Capabilities
- `block-editor`: long mentions wrap.

## Non-goals

- Short labels for mentions (option C of the task), which comes as its own change.
- Changing how mentions look or behave as one character.

## Cloudscape gaps

None: the editor's own typography (Cloudscape has no block editor).

## Impact

- `app/app.css` (`.editable .mention`). An e2e test with a long task mention in a table cell, which failed before.
