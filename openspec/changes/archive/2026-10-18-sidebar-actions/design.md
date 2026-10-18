## Decisions

- The dialogs live in the shell, rendered once outside the navigation (which is drawn twice: sidebar and mobile drawer), and post to the home route's action (`intent=create-page` for pages), which redirects to what it created. Because the shell persists, the dialogs close whenever the location changes.
- Removing deletion from the navigation removes what only it needed: the shared fetcher and watcher that navigated away when the open page was deleted, the deletion lookup endpoint, and the page action's "stay" mode.
