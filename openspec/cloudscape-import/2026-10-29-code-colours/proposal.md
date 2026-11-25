## Why

Code blocks show all code in one colour, which makes longer snippets hard to read. Promoted from the exploration "Color syntax for code blocks".

## What Changes

- Code blocks in ts, tsx (as TypeScript), js, json, sh, python, go, rust, html, css, yaml and md are shown in syntax colours, in read-only views and while editing, in light and dark mode. Plain text, sql (no highlighter) and other languages stay plain.
- The colours come from Cloudscape's code view (`@cloudscape-design/code-view` highlighters, built on `ace-code`, with its `cloud_editor` light and dark themes). Only the highlighters for those languages are used, each loaded on demand the first time a code block in its language is shown, so pages without code don't load Ace; until then, and when rendered on the server, code shows plain.
- In the editor, a coloured copy is drawn under the editable text in the same grid cell, and the text is made transparent with a visible caret and a translucent selection. The block stays plain text, so saving, undo, copy, paste and agent Markdown don't change.

## Capabilities

### Modified Capabilities
- `block-editor`: colours in code blocks while editing.
- `page-viewer`: colours in read-only code blocks.

## Non-goals

- Highlighting sql, or languages outside the code block's list.
- Line numbers, or Cloudscape's `CodeView` component itself (its layout differs from the editor's code block).

## Cloudscape gaps

- Cloudscape has no editable highlighted code: the editor's coloured layer under transparent editable text is the app's own, styled with Cloudscape tokens (`--app-text` caret, `--app-info` selection) and the code view's themes.

## Impact

- New dependency `@cloudscape-design/code-view` 3.0.191 (pinned; brings `ace-code`). New `app/blocks/code-highlight.tsx`; `app/blocks/block-view.tsx` (`CodeView`); `app/editor/editor-blocks.tsx` (`CodeBody`); `app/theme-mode.tsx` (`useThemeModeOrLight`); `app/app.css`. Tests: `tests/app/block-view.test.tsx`, an e2e test in `tests/e2e/project-flow.spec.ts`.
