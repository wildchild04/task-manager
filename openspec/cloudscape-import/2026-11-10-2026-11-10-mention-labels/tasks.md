## 1. Data model

- [x] 1.1 `TextSpan.mention` gains an optional `label` (`src/domain/blocks/types.ts`)
- [x] 1.2 Block content schema accepts `label` (`src/domain/blocks/schema.ts`) — the single validation path for memory and SQLite

## 2. Markdown

- [x] 2.1 `MarkdownWriter.findTarget` returns the target's `title`; update both implementers (`app/lib/agent/functions.server.ts`, `app/editor/page-editor.tsx`)
- [x] 2.2 Parse keeps the bracket text as `label` when it differs from the target's current title (`src/domain/blocks/markdown.ts`, `fromInlineMarkdown`)
- [x] 2.3 Serialize writes `label ?? currentTitle` for a mention (`toMarkdown`)
- [x] 2.4 Agent Markdown guide notes the label is kept (`src/domain/blocks/markdown.ts` guide, `mcp/tools.ts`, `mcp/README.md`)

## 3. Read-only rendering

- [x] 3.1 `Mention` shows `label ?? title`, with the full title on hover when a label is shown; missing target unchanged (`app/blocks/rich-text.tsx`)

## 4. Editor

- [x] 4.1 `setMentionLabel(text, offset, label | null)` helper (`src/editor/rich-text.ts`)
- [x] 4.2 Relabel command + editor method (`src/editor/commands.ts`, `src/editor/editor.ts`)
- [x] 4.3 `mentionElement` draws `label ?? title` and puts the full title on `title` (`app/editor/dom-caret.ts`)
- [x] 4.4 Mention card with Open / Edit label / Reset to title (`app/editor/page-editor.tsx`); reuses the link card's `HoverCard` and styles, so no `app.css` change was needed

## 5. Tests

- [x] 5.1 Markdown: labelled mention round trip, label dropped when it equals the title (`tests/markdown.test.ts`)
- [x] 5.2 Editor helper: set and clear a mention's label (`tests/editor/rich-text.test.ts`)
- [x] 5.3 Rendering: labelled mention shows the label with the title on hover (`tests/app/rich-text.test.tsx`)
- [x] 5.4 e2e: a mention's short label shows instead of the long title, with the full title on hover (`tests/e2e/project-flow.spec.ts`); the existing wrap test now uses an unlabelled mention
- [x] 5.5 Agent-api behaviour: `@[label](task:id)` stored with a differing label, read back unchanged (`tests/app/agent-api.test.ts`)

## 6. Verify and archive

- [x] 6.1 `openspec validate 2026-11-10-mention-labels --strict`
- [x] 6.2 typecheck, full vitest (1341), build, full Playwright (Chromium + Firefox)
- [x] 6.3 Archive the change
