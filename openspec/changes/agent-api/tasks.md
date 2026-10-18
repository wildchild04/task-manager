## 1. Markdown

- [x] 1.1 `toMarkdown`: every block type, nesting, marks, mentions, references; tests
- [x] 1.2 `fromMarkdown`: paragraphs, headings, lists, todos, quotes, dividers, marks, links, mentions (resolved or plain); round-trip tests

## 2. Agent API

- [x] 2.1 Request pipeline: token and name, actor, zod parsing, error mapping; ID prefixes; caps and cursors; tests
- [x] 2.2 Read functions: projects, tasks, task, description, comments, references, pages, page; tests for fields and caps
- [x] 2.3 Write functions with permissions and claiming: transition, comment, description; tests for every scenario
- [x] 2.4 Routes under `/api/agent/*`; `AGENT_TOKEN` documented in `.env.example`

## 3. MCP server

- [x] 3.1 `mcp/` package with the SDK; tools with input schemas and descriptions; config checks
- [x] 3.2 Tests: tools against an in-process app (memory services), including errors
- [x] 3.3 `mcp/README.md` with setup for Claude Code; an end-to-end check against the dev server
