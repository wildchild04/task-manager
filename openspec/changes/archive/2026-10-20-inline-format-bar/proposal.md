## Why

Formatting selected text needs keyboard shortcuts (Cmd/Ctrl+B, I, U, Shift+S, E, K) that nothing on screen reveals, and on touch screens there is no keyboard to press them. The "Block editor v1" exploration lists an inline edit bar: Notion's toolbar that appears over selected text.

## What Changes

- Selecting text inside one block shows a **bar over the selection**: Turn into (showing the block's type), Bold, Italic, Underline, Strikethrough, Code and Link. A mark's button shows pressed when all the selected text has it.
- The buttons do what the matching shortcuts do, keeping the selection (so several marks can be applied in a row). Link opens the existing link dialog. Turn into opens the type list from the handle menu.
- The bar shows after a mouse selection is released or a keyboard selection settles, and hides when the selection collapses, when typing, and on Escape or a click elsewhere. It never takes focus from the text.
- It doesn't show in code blocks (plain text) or the title. In table cells it shows without Turn into. Over text selected across blocks it doesn't show (marks apply within one block).
- On touch screens it shows below the selection, clear of the system's own copy and paste bubble.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `block-editor`: the inline formatting bar.

## Non-goals

- Text colour and highlight (marks the block model doesn't have).
- Marks over text selected across blocks.
- Comment and mention buttons in the bar (`@` already mentions).
- Moving focus into the bar with the keyboard: keyboard users have the shortcuts, which the buttons' labels show.

## External dependencies

Design-system feature request in `~/dev/design-system/feature-requests/`:
- **`selection-toolbar.md`**: a compact toolbar anchored to a DOM rectangle (as `HoverCard` is) with `role="toolbar"`, toggle buttons and a slot for a dropdown, not taking focus; plus icons `format_bold`, `format_italic`, `format_underlined`, `format_strikethrough`, `code` and `link`. Until it ships, the app puts `IconButton`s with letter glyphs (**B**, *I*, U̲, S̶, `<>`, a link symbol) in a `HoverCard`.

## Impact

- `app/editor/format-bar.tsx` (new): the bar, from the selection's rectangle and the block's marks.
- `app/editor/page-editor.tsx`: when to show and hide it; its commands go through the existing `Editor` methods and link dialog.
- `src/editor/rich-text.ts`: `hasMark` and `linkAt` already tell the pressed states; no editor-state changes.
- Tests for the pressed states and showing rules; headless check.
