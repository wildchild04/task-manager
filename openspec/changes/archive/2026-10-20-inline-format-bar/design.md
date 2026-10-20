## Context

Marks are toggled by `Editor.toggleMark` over the in-block selection; links go through the page editor's link dialog (`setLinkFor`). The link card already floats over text in a `HoverCard`, which places itself against a `DOMRect`, flips when there's no room, closes on Escape and outside presses, and never takes focus. "Turn into" (from `turn-into-and-sub-pages`) lists the slash menu's types and runs `Editor.turnInto`.

## Goals / Non-Goals

**Goals:** show the formatting commands where the selection is, on desktop and touch, without disturbing typing or the selection.

**Non-Goals:** see the proposal.

## Decisions

### 1. When it shows

A pure function `formatBarFor(state, selection)` in `app/editor/format-bar.tsx` (tested without a DOM) returns `null` unless the selection is non-collapsed, inside one block, not the title or a code block; else which buttons to show (Turn into only for blocks "Turn into" can change) and which are pressed (`hasMark` for each mark over the selection, `linkAt` for Link).

The page editor shows the bar when that function says so, with the selection's rectangle (`getRangeAt(0).getBoundingClientRect()`), after the selection settles: on `pointerup` for pointer selections and 300ms after the last `selectionchange` otherwise (keyboard selections, touch handles). It hides at once on a collapsed selection, any `beforeinput`, composition, a text range across blocks or a block selection, and on the `HoverCard`'s dismiss (Escape, outside press). Scrolling moves it with the selection (the rectangle is read again on scroll).

### 2. Commands keep the selection

Buttons cancel `mousedown` (as the link card's do), so the text keeps the selection; each runs the existing command and the editor restores the selection, so the bar stays with updated pressed states. Link closes the bar and opens the link dialog for the selection. Turn into opens a `Menu` anchored to its button with the types, the current one checked.

### 3. Placement

Above the selection on pointing devices (`placement="top-start"`); below on coarse pointers, where the system's copy and paste bubble takes the space above. `HoverCard` flips either way when there's no room.

### 4. Stand-in until the design system has a selection toolbar

The `HoverCard` holds a row with `role="toolbar"` and `aria-label="Formatting"`, `IconButton`s with `pressed` and letter glyphs as children, and a text `Button` for Turn into. Link uses a small inline SVG chain (an emoji isn't drawn on systems without an emoji font). The Turn into `Menu` is rendered outside the `HoverCard`, anchored to an invisible fixed element where the button was, and the bar hides while the list is open (it was drawn over the list); choosing a type or closing the list brings the bar back over the still-selected text. A pointer release shows the bar at once rather than on a timer, since a double-click's `selectionchange` could cancel a pending timer. Each button's label names its shortcut ("Bold (Ctrl+B)", "⌘B" on macOS). The request `selection-toolbar.md` asks for the component and the icons.

## Risks / Trade-offs

- [The bar covers the line above the selection] → It's small and moves away as soon as typing starts; Notion has the same trade-off.
- [Keyboard selections flicker the bar] → The 300ms settle delay; Shift+Arrow held down keeps it hidden until released.
