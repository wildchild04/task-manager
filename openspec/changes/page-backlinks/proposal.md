## Why

Pages can now be mentioned inline and referenced with reference blocks, but a page doesn't show who points at it. "Everything should be referenced" works one way only: from a design document you can't see which tasks, notes or other documents rely on it, which is what you need before changing or deleting it.

## What Changes

- **Incoming mentions** in the block store: the blocks whose text mentions a given page, alongside the existing incoming references (reference blocks targeting it).
- **"Mentioned in" on a page** (`/pages/:pageId`): a section under the content listing the places that mention or reference the page, one entry per place:
  - another page (a library document or workspace page): its title, linking to it
  - a task (its description mentions or references the page): the task's title and kind, linking to it
  - each entry says how many times that place points at the page when it's more than once
- Places inside the page itself are left out, and the section is hidden when nothing points at the page.

## Capabilities

### New Capabilities
- (none)

### Modified Capabilities
- `block-references`: listing the blocks that mention a page.
- `page-viewer`: pages show where they are mentioned or referenced.

## Non-goals

- Backlinks for tasks and blocks (only pages can be mentioned so far).
- Showing the surrounding sentence of each mention (only the place).
- Counting plain `/pages/<id>` links as backlinks.
- Backlinks from comments (comments can't hold mentions yet).

## External dependencies

None; uses existing `Card`, `List`, `Link`, `Chip` and `Typography`.

## Impact

- `BlockRepository`: `listMentioning(pageId)` in the SQLite (via `json_each`) and memory implementations, with contract tests.
- `app/lib`: a backlinks view builder; the page route's loader and a "Mentioned in" section.
- No schema migration.
