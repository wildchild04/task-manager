## Why

Bug: pages keep a 760px column at every window width, so on large and 4K monitors the text sits in a narrow strip with most of the screen empty.

## What Changes

- A page's document column widens with the window: 760px at most by default, 920px from a 1600px window, 1080px from 2200px and 1240px from 2800px.

## Capabilities

### Modified Capabilities
- `app-shell`: the page column's width follows the window.

## Non-goals

- Task pages, project homes and comments, which keep their layout.
- A per-page "full width" toggle.
- Changing the font size.

## Cloudscape gaps

None: the column is the app's own document area (Cloudscape has no block editor); the breakpoints are plain CSS media queries.

## Impact

- `app/app.css` (`.document`). An e2e test of the column's width at a laptop and a 4K window.
