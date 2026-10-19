## Context

The shell's loader runs on every navigation and already builds the navigation's projects and pages. The home dashboard builds "Needs attention" (urgent chores, returned work, work in progress) and "Waiting for review" (places with pending suggestions) in `app/lib/home.server.ts`. The design system has `IconButton` (custom children allowed), `Badge` and `Menu` (options with `ReactNode` labels and `onClick`), but no bell icon.

## Goals / Non-Goals

**Goals:** one place, on every screen, that says how many things wait for you and takes you to each.

**Non-Goals:** delivery outside the app, read state, live updates (see the proposal).

## Decisions

### 1. Computed from the same builders as the home dashboard
`notificationsView(services, now)` reuses the dashboard's `review` and the urgent/returned parts of `attention`, so the bell and the dashboard never disagree. *Alternative:* a notifications table with events. Rejected for now: it needs read state and cleanup, and every item here is already derivable from current state.

### 2. Loaded with the shell
The shell loader adds `notifications`; React Router revalidates it after every navigation and every action (approving a suggestion, completing a chore), so the count follows what you do without polling. A page that stays open doesn't update until the next navigation or action; that's accepted.

Cost: the shell loader now walks every task and pending suggestion on each navigation, as the home dashboard already does on its own route. Fine at single-user scale; if it ever shows, the attention scan can be cached per request.

### 3. Order and count
Rows: suggestions waiting (oldest first), then overdue chores, then urgent chores (by due time), then returned work. The badge counts rows (places), not suggestions: three suggestions on one page are one thing to open. The badge hides at zero; the bell stays.

### 4. A menu of links
`Menu` with one option per row: the title on the first line, the reason on the second ("2 suggestions · claude", "Overdue · due 19 Oct 09:00", "Returned by builder"). Choosing a row navigates to its page or task. An empty list shows one disabled row, "Nothing needs you". The button's accessible name includes the count ("Notifications, 3").

### 5. The bell icon
Requested from the design system as `notifications`. Until then the app renders a 24px outlined bell SVG as `IconButton`'s children, colored `currentColor`; one line changes when the icon ships.

## Risks / Trade-offs

- [Stale count on a page left open] → Refreshes on the next navigation or action; push and live updates belong to the Notifications exploration.
- [Shell loader cost] → See decision 2.
