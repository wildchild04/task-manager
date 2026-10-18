## Why

Hovering a link in the editor shows the browser's native tooltip ("https://… · Click to open - Select and Ctrl+K to edit"). It appears late, ignores the theme, and can't hold buttons, so editing a link still means arrowing into it and pressing Ctrl+K. The design system now has `HoverCard` (v0.5.2), built for exactly this: an interactive, non-modal card anchored to a link that isn't a React element.

## What Changes

- Resting the pointer on a link in the editor for a moment shows a `HoverCard` under it with where the link goes (the URL, or the page's title and place for an app page, or that the page no longer exists) and three actions:
  - **Open**: as clicking the link (app pages in the same tab, other URLs in a new tab)
  - **Edit**: the link dialog for the whole link, prefilled
  - **Remove**: removes the link and keeps its text, as one undo step
- The card stays open while the pointer moves from the link onto it, and closes shortly after the pointer leaves both, on Escape, on an outside click, or when the user types.
- The native `title` tooltip on editor links goes away.

## Capabilities

### New Capabilities
- (none)

### Modified Capabilities
- `block-editor`: hovering a link shows a card with its destination and Open / Edit / Remove, instead of a tooltip.

## Non-goals

- Previews of the linked page's content.
- Hover cards in read-only views (they keep the design system's `Link`).
- Hover cards for mentions (`inline-page-mentions` can reuse this card later).

## External dependencies

- `HoverCard` from `@wildchild/design-system` v0.5.2 (requested in `~/dev/design-system/feature-requests/link-hover-card.md`, delivered).

## Impact

- `app/editor/page-editor.tsx`: hover tracking over editor links, the card, its actions; the `title` hint goes.
- No server, domain or schema changes.
