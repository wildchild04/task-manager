## Why

The MCP tools return their results as JSON text only, so clients have to parse text and can't know a result's shape in advance. Split from the MCP functions audit.

## What Changes

- Every tool (29) declares an `outputSchema`: the agent API's response for it, from `mcp/outputs.ts`.
- Successful results carry the response as `structuredContent` as well as the same compact JSON text, for clients that ignore structured output. The MCP SDK checks the structured content against the schema.
- Errors stay tool errors with the API's code and message, without structured content.
- Schemas aren't strict: a field the app adds later doesn't fail an older installed server. A tool registered without a schema fails at startup.

## Capabilities

### Modified Capabilities
- `agent-mcp`: output schemas and structured content.

## Non-goals

- Changing any response; schemas describe what the API already returns.
- Generating the schemas from the API code.

## Cloudscape gaps

None: no screens change.

## Impact

- New `mcp/outputs.ts`; `mcp/tools.ts` (`outputSchema` on each tool, `structuredContent` in results); `mcp/README.md`. Tests in `tests/mcp.test.ts` call all 29 tools and check their structured content against the schemas.
