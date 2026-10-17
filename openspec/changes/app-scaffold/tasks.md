## 1. Framework setup

- [x] 1.1 Install React Router 7.18 (`react-router`, `@react-router/node`, `@react-router/serve`, `@react-router/dev`), `react`, `react-dom`, their types, and `tsx` (for scripts)
- [x] 1.2 Install `@wildchild/design-system` from GitHub at `v0.3.3` and its peers (`@emotion/react`, `@emotion/styled`, `@mui/material`, `@mui/x-date-pickers`, `dayjs`)
- [x] 1.3 Add `react-router.config.ts` (SSR) and `vite.config.ts` (React Router plugin, Vite's native `resolve.tsconfigPaths`)
- [x] 1.4 Update `tsconfig.json` for JSX, DOM libs and `.react-router/types`; add `dev`, `build`, `start` scripts and make `typecheck` run `react-router typegen` first
- [x] 1.5 Add `app/root.tsx` with the HTML layout, root loader for the theme cookie, and error boundary

## 2. Server boundary and shell

- [x] 2.1 Add `app/lib/services.server.ts` (services singleton, reused across hot reloads)
- [x] 2.2 Add `app/theme-mode.tsx` (`AppThemeProvider` around `DesignSystemProvider`, cookie write on change)
- [x] 2.3 Add `app/routes.ts` and the shell layout route: `PageShell` with root pages in the navigation and a `ThemeToggle`
- [x] 2.4 Add the home route with the root page list and the empty state mentioning `npm run db:seed`
- [x] 2.5 Add the not-found handling for unknown routes and missing page IDs (status 404)

## 3. Page viewer

- [x] 3.1 Add the page loader: load the tree, reject owned roots, resolve references with their expansion paths, return a serializable view model
- [x] 3.2 Add `app/blocks/` renderers for every block type and rich-text marks, with numbered-list numbering
- [x] 3.3 Add the `/pages/:pageId` route rendering the title and blocks
- [x] 3.4 Add Vitest tests: the view-model builder (references ok/missing/cycle, owned root rejected) and server rendering of every block type and the numbering rule

## 4. Dev data

- [x] 4.1 Add `scripts/seed.ts` and `npm run db:seed` (Welcome and Block showcase pages, idempotent)
- [x] 4.2 Add `npm run db:reset` (delete the database and WAL files)

## 5. Verify

- [x] 5.1 `npm run typecheck` and `npm test` pass
- [x] 5.2 `npm run build` succeeds and the client bundle contains no `better-sqlite3` code
- [x] 5.3 Run `db:reset`, `db:seed` and `dev`; check the home page, navigation, showcase page, theme toggle and a 404 in the browser
