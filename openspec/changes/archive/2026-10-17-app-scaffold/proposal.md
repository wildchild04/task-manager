## Why

The block model exists but there is nothing to open in a browser. Every next step (the keyboard-navigation spike, the editor, project and task screens) needs a running app with the design system wired in and a server boundary that calls the domain. Setting that up on its own keeps framework plumbing out of the spike, which should only contain the experiment.

## What Changes

- Add **React Router 7 framework mode** (the successor of Remix v2) with Vite and server-side rendering, laid out as in kikimora: `app/root.tsx`, `app/routes.ts`, `app/routes/`.
- Add **`@wildchild/design-system`** from GitHub at tag `v0.3.3` with its peer dependencies, and an app theme provider that keeps light/dark mode in a cookie so the server renders the right mode.
- Add a **server-only services module** that builds the services from `src/composition.ts` once per process. Loaders are the only UI code that calls domain services.
- Add an **app shell**: the design system's `PageShell` with the workspace's root pages in the navigation, and a theme toggle.
- Add a **read-only page viewer** at `/pages/:pageId` that renders a page's block tree with design-system components, including nested content, sub-page links and resolved references.
- Add **dev data scripts**: `db:seed` creates sample pages covering every block type, and `db:reset` deletes the local database.
- Add `dev`, `build`, `start` scripts; `typecheck` also runs React Router's type generation.

## Capabilities

### New Capabilities
- `app-shell`: framework setup, the server/domain boundary, theme mode, navigation, error and not-found pages.
- `page-viewer`: read-only rendering of a page's block tree.
- `dev-data`: seeding and resetting the local database.

### Modified Capabilities
<!-- None. -->

## Non-goals

- Editing of any kind, keyboard navigation, the block editor (the spike comes next).
- Projects, tasks, comments and dashboard screens (they come with their changes).
- Authentication (single user, local app), deployment and Docker.
- Upgrading to React Router 8.

## External dependencies

None missing. The shell and viewer use existing components: `PageShell`, `Typography`, `Checkbox`, `List`, `Divider`, `Link`, `Icon`, `ThemeToggle`, `Alert`.

## Prerequisites

- `block-data-model` (applied).

## Impact

- New: `app/`, `react-router.config.ts`, `vite.config.ts`, `scripts/` (seed and reset).
- `package.json`: new dependencies (`react-router`, `@react-router/node`, `@react-router/serve`, `@react-router/dev`, `react`, `react-dom`, the design system and its peers) and scripts.
- `tsconfig.json`: JSX, DOM libs and React Router's generated types.
- `vitest.config.ts` stays separate, so tests don't load the React Router plugin.
