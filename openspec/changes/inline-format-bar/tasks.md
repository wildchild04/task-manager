## 1. Design system

- [ ] 1.1 Feature request `~/dev/design-system/feature-requests/selection-toolbar.md` (component and formatting icons)

## 2. Bar

- [ ] 2.1 `app/editor/format-bar.tsx`: `formatBarFor(state, selection)` (when it shows, which buttons, pressed states) with tests; the `FormatBar` component in a `HoverCard` (toolbar role, labelled buttons with shortcuts, Turn into menu)
- [ ] 2.2 `page-editor.tsx`: showing after a pointer release or a settled keyboard selection, hiding on collapse, input, composition, ranges and block selections, Escape and outside clicks; the selection's rectangle, re-read on scroll; placement by pointer type; commands through `toggleMark`, the link dialog and `turnInto`, keeping the selection

## 3. Check

- [ ] 3.1 Headless check in Chromium and Firefox: bold from the bar with pressed state, italic then code and two undos, typing hides it, none in code, Turn into from the bar, touch placement at phone width; typecheck and full test run
