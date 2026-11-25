## Why

Part C of "Short-form mentions so long titles don't stretch tables" (the wrap part shipped as `2026-11-05-mention-wrap`). A mention stores only its target (`mention: { pageId }`) and always shows the target's full current title. On the Kiro Agents page the Project column mentions tasks whose titles run over 100 characters, so even though mentions now wrap, the cells are still bulky and the label an agent wrote in `@[label](task:id)` is thrown away. A mention needs an optional short label of its own, settable by a human in the editor or by an agent in Markdown, while unlabelled mentions keep following the target's title.

## What Changes

- A mention can carry its own label (`mention: { pageId, label? }`). It shows the label everywhere it is rendered, with the target's full current title on hover. A mention with no label still shows (and follows) the target's current title; a missing target still shows as a missing-page marker. Wrap (from `2026-11-05-mention-wrap`) remains the fallback for an unlabelled mention.
- Editor: a mention offers "Edit label" and "Reset to title".
- Markdown in: `@[label](task:id)` / `@[label](page:id)` keeps `label` when it differs from the target's current title. Markdown out: a labelled mention writes its label; an unlabelled one writes the current title (unchanged).
- Agent Markdown guide and the agent-api Markdown-conversion contract state that a mention's label is kept.

## Capabilities

### Modified Capabilities
- `block-editor`: a mention can be relabelled (and reset), and shows its label.
- `page-viewer`: a mention renders its label, with the full title on hover.
- `agent-api`: Markdown keeps a mention's label when it differs from the target's title.

## Non-goals

- Truncating mentions inside table cells (option B of the task): not needed now that labels and wrap exist.
- Changing how a mention behaves as one character, or how the `@` menu finds pages.
- A per-column or per-table display rule; the label is a property of the mention itself.

## Cloudscape gaps

None: the mention label input and card reuse the editor's own floating components (Cloudscape has no block editor); the card is styled with Cloudscape tokens like the existing link card.

## Impact

- Data model: `src/domain/blocks/types.ts` (`TextSpan.mention`).
- Markdown: `src/domain/blocks/markdown.ts` (parse keeps a differing label, serialize writes it; `MarkdownWriter.findTarget` also returns the target's `title`); its implementers `app/lib/agent/functions.server.ts` and `app/editor/page-editor.tsx`; the agent Markdown guide.
- Read-only render: `app/blocks/rich-text.tsx` (`Mention`), `app/blocks/view-model.ts`.
- Editor: `src/editor/rich-text.ts` (relabel helper), `src/editor/commands.ts`, `src/editor/editor.ts`, `app/editor/dom-caret.ts` (`mentionElement`), `app/editor/page-editor.tsx` (the mention card), `app/app.css`.
- Agent docs: `mcp/tools.ts`, `mcp/README.md`.
- Tests: `tests/markdown.test.ts`, `tests/editor/rich-text.test.ts`, a rendering test, and an e2e labelled-mention round trip with hover. No SQLite migration (labels live in block content).
