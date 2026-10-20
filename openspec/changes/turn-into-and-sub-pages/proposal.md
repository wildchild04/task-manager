## Why

A block's type can only change through Markdown shortcuts typed at its start or through the slash menu, which needs a `/` typed into the text; neither works on several blocks at once, and neither is reachable from the block handle. Sub-pages can only be made from the sidebar or by an agent, so writing a page means leaving it to create the pages it links down to. Both are on the "Block editor v1" exploration: a "turn into" command, and creating a sub-page from the editor with `/page`.

## What Changes

- **Turn into from the handle.** The block handle menu gains "Turn into", listing Text, Heading 1–6, Bulleted list, Numbered list, To-do, Toggle, Quote, Callout and Code, with the current type checked. It changes every selected text block at once (or the handle's block), keeping text and children as the slash menu does; other blocks (dividers, tables, sub-pages) are left as they are. One undo step.
- **Turn into from the keyboard.** Cmd/Ctrl+Shift+0 to 8 turn the caret's block, the blocks a text selection touches, or the selected blocks into Text, Heading 1, 2, 3, To-do, Bulleted list, Numbered list, Toggle and Code.
- **`/page`.** A "Page" command in the slash menu, on workspace pages and project pages: it creates an empty sub-page in place of an empty block, or after a block with text, and opens it with the caret in its title. An unwanted one is deleted from its own page, as in Notion: undo doesn't follow you back to the parent page.
- The server accepts an edit batch that creates an empty sub-page inside the edited page, and one that deletes a sub-page with no content (the undo of creating it, sent when the editor stays on the page because the save failed). Sub-pages with content still can't be deleted through edits.
- A page opened with an empty title and no blocks puts the caret in its title.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `block-editor`: "Turn into" in the handle menu and its shortcuts; the Page command in the slash menu; empty sub-pages created and removed through edits; the caret in the title of a new empty page.

## Non-goals

- Turning a block into a page (its text as the title and its children as the new page's content): it moves content across pages, which edits don't do. Later, if wanted.
- Turning blocks into tables, dividers or references, or tables into text.
- `/page` in task bodies and comments: sub-pages there have no page of their own to open.
- Moving blocks into another page ("Move to").

## External dependencies

None: the handle menu is the existing `Menu`, opened a second time for the list of types.

## Impact

- `src/editor/`: a `turnInto` command over several blocks sharing the slash menu's type change (`commands.ts`); a `page` slash action; `Editor` methods.
- `src/domain/blocks/page-edit.ts`: inserting an empty sub-page and deleting a sub-page without content, with an option for which surfaces allow sub-pages; `app/lib/page-edit.server.ts` passes whether a sub-page has content.
- `app/editor/`: the handle's "Turn into" list (`editor-blocks.tsx`), shortcuts and opening a new sub-page (`page-editor.tsx`), the sidebar re-read after a sub-page is created or removed.
- Tests for the command, the edit checks and the editor.
