## Why

`read_page` gives agents the Markdown of a page, with uploaded images as absolute `/content/<id>` URLs on the app's private address. An agent can't look at them: models don't fetch URLs, and agents outside the LAN or tailnet can't reach them anyway. The request "expose page attachments through MCP" asks for the image itself through MCP, so agents can analyse scores, diagrams and screenshots on pages they can already read.

## What Changes

- **Assets listed**: `GET page/:id` and `GET task/:id/description` (MCP `read_page`, `read_description`) gain `assets: [{ id, alt }]`, the uploaded images in the whole page, in order and without repeats. It's left out when there are none. The Markdown doesn't change.
- **Reading one**: `GET page/:id/asset/:asset` and `GET task/:id/asset/:asset` answer `{ id, type, size, width?, height?, data }` (base64). Only an uploaded image that an image block in that page or description uses is answered. Anything else is `not_found`, and the bytes being gone is `missing`, without storage paths. External image URLs are never fetched.
- **MCP**: a new tool, `read_page_asset` (`page` or `task`, plus `asset`), returns MCP image content plus the metadata as text, so the agent sees the image directly.
- **Dimensions**: read from PNG, JPEG, GIF and WebP headers in the content domain.
- Not in this change: resizing large images for models, attachments other than images, and images in comments or findings.

## Capabilities

### Modified Capabilities
- `agent-api`: the functions table gains the two asset functions and `assets` on page and description reads. A new requirement, "Agents read images", covers them.
- `agent-mcp`: the tool list gains `read_page_asset`, and its result is image content instead of JSON.

## Impact

- `src/domain/content/content.repository.ts`: `imageSize(bytes, type)`, with tests.
- `app/lib/agent/functions.server.ts`: `assets` on `readPage` and `readDescription`, plus `readPageAsset` and `readTaskAsset`. `app/lib/agent/request.server.ts`: routes, and awaiting async handlers.
- `mcp/tools.ts`, `mcp/README.md`: `read_page_asset`. `tests/mcp.test.ts` goes up to 26 tools.
- `tests/app/agent-api.test.ts`: the new functions.
