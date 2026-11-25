## Context

A mention is one `TextSpan` whose text is the placeholder character and which carries `mention: { pageId }`. Read-only (`app/blocks/rich-text.tsx`) and in the editor (`app/editor/dom-caret.ts`) it resolves `pageId` to the target's current title through `MentionTargets`, so renaming a page updates every mention of it. Part C adds an optional label that overrides the shown text for that one mention, without losing the live title (kept for hover).

## Decisions

### Label lives on the span, not the target
`TextSpan["mention"]` becomes `{ pageId: string; label?: string }`. The label belongs to the one mention, so two mentions of the same page can show different labels, and the resolved `MentionTarget` (title + href) stays shared and keeps tracking the live title. An absent `label` means "follow the target's current title" — the pre-Part-C behaviour, and the wrap fallback.

### Store a label only when it differs from the current title
On the way in (Markdown parse, and within-app paste), a label equal to the target's current title is dropped, so the mention keeps following renames; a label that differs is stored. This needs the target's title at parse time, so `MarkdownWriter.findTarget` returns `title` alongside `pageId`/`href` (both implementers — the server agent writer and the editor paste writer — already have it). Serialize is the mirror: `@[label](kind:id)` with `label ?? currentTitle`, so an unlabelled mention's Markdown is unchanged and a labelled one round-trips.

### Rendering shows the label, hover shows the full title
`Mention` shows `label ?? target.title`. When a label is shown it also sets the native `title` attribute to the target's current full title, so hovering reveals what the mention points at; an unlabelled mention needs no tooltip. A missing target still renders the missing-page marker regardless of label. In the editor the shown text is drawn by CSS from `data-title` (set to `label ?? title`); the full title goes on the element's `title` attribute.

### Editing a label reuses the link-card pattern
The editor already shows a floating card for a hovered link (`HoverCard` in `app/editor/floating.tsx`, driven from `page-editor.tsx`). A mention gets the same treatment: its card offers Open, **Edit label** (an inline text input prefilled with the shown text; Enter stores it, empty resets), and **Reset to title** (clears the label). Relabelling is a single editor command/undo step. The caret still never enters a mention; the label is edited in the card, not inline.

### Editing helpers carry the label through
`src/editor/rich-text.ts` already preserves `s.mention` wholesale in `slice`/`normalize`, so a labelled mention survives selection, marking and block splits. A new `setMentionLabel(text, offset, label | null)` sets or clears the label on the mention span at an offset; `insertMention` is unchanged (new mentions start unlabelled, following the title).

## Risks / trade-offs

- A labelled mention whose target is later deleted loses its label (it renders as the missing-page marker). Acceptable: the mention is already broken, and the label has no target to describe.
- Serialize/parse asymmetry if `findTarget` can't resolve the title: the label would be kept verbatim. All real callers resolve the title; the type makes it required so this can't silently regress.

## Non-goals

Truncation inside table cells (option B), changes to the `@` menu or to a mention's one-character behaviour, and any per-table display rule. The label is a property of the mention.
