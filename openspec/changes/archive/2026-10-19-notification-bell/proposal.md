## Why

Agents now leave suggestions on pages and descriptions, return work and let chores run late, but nothing tells you: the home dashboard only shows it when you go there. A bell in the top bar answers "does anything need me?" from any screen, starting with what's waiting for a decision.

## What Changes

- A bell button in the app shell's top bar, on every screen, with a badge counting the places that need you.
- Opening it lists them, most pressing first, each opening its page or task:
  - pages and tasks with **suggestions waiting for review** (with how many, and from which agents)
  - chores that are **overdue or urgent**
  - work **returned by an agent** (with who returned it)
- The list and count come from the same view the home dashboard uses, recomputed on every navigation; an item leaves the list when it's resolved.

## Capabilities

### Modified Capabilities
- `app-shell`: the notification bell in the top bar.

## Non-goals

- Browser, email or phone (ntfy) notifications, and anything delivered while the app isn't open: still in the Notifications exploration.
- Read/unread state, dismissing items, or notification history.
- Real-time updates while a page stays open (the count refreshes on navigation and after actions).
- Work in progress: it's on the home dashboard, but nothing is waiting for you.

## External dependencies

- **Design system: a `notifications` (bell) icon** in the `Icon` catalog (`~/dev/design-system/feature-requests/notifications-icon.md`). Until it ships, `IconButton` renders an app-local bell SVG as its children, swapped for `icon="notifications"` when it lands.
- Uses existing `IconButton`, `Badge`, `Menu` and `Typography`.

## Impact

- `app/lib/home.server.ts`: the attention and review builders shared with a new `notificationsView`; `app/lib/shell.server.ts` (shell loader data); `app/routes/shell.tsx` and a `NotificationBell` component; tests.
- No domain or schema change.
