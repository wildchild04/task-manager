## Why

The "+" and the block handle appear on whatever block the pointer passes over, so they flicker across the page while reading or moving to click something. They're wanted beside the block being worked on: the one holding the caret, and selected blocks.

## What Changes

- The handle and the "+" show beside the active block (the innermost block holding the caret, or with focus on one of its controls) and beside selected blocks, on every device. Pointing at a block no longer shows them.

## Capabilities

### Modified Capabilities
- `block-editor`: when the block handle and the "+" show.

## Non-goals

- Changing what the handle, its menu or the "+" do, or where they sit.

## Cloudscape gaps

None: CSS on the app's own handle and "+" containers.

## Impact

- `app/app.css` only; the e2e tests click the controls after focusing the block.
