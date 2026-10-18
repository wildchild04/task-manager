## Decisions

### 1. The editor stays mounted across tabs
The task's title is edited in the header and the description in the Description tab, both through one `PageEditor`. Switching tabs hides the editor's body (`hideBody`) instead of unmounting it, so unsaved typing, undo history and the save queue survive a tab switch; other tabs render after the editor.

### 2. Tab in the URL
`?tab=` is read in the component (`useSearchParams`) and changed with `setSearchParams` (replace, no scroll), so switching tabs doesn't refetch anything beyond the usual revalidation. Unknown values fall back to Description. On load, a `#comment-…` hash without a tab switches to Comments and scrolls the comment into view.

### 3. Chore header controls
Urgency is a design-system `Select` that submits `intent=urgency` through a fetcher on change. The schedule chip is a clickable `Chip` (or a text button) that opens a `FormDialog` with the schedule part of the chore form (`ScheduleFields`, split out of `ChoreFields` and prefilled from the chore's current schedule as form values). It posts `intent=schedule`; the handler parses with the existing `scheduleFromForm` and calls `ChoreService.setSchedule` (`null` for "No schedule").

### 4. References tab
"References (n)" counts outgoing references plus backlinks; the tab shows the References list (with add/remove) and, under it, "Mentioned in".
