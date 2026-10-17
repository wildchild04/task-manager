## Context

`block-data-model` is implemented as a framework-free library in `src/`. The project config fixes React Router 7 framework mode as the app framework, mirroring kikimora (`~/dev/typescript/kikimora`): SSR, Vite, `app/` for routes, the design system from GitHub, a cookie-based theme mode, and a `global` singleton for the database in development.

## Goals / Non-Goals

**Goals:**
- A running app with the design system, so the next changes only add screens and behaviour.
- A strict server boundary: domain services live on the server and reach components only through loaders.
- Seed data that exercises every block type, so the viewer and the upcoming spike have real content.

**Non-Goals:**
- Editing, keyboard navigation, project/task screens, auth, deployment (see the proposal).

## Decisions

### 1. React Router 7.18, not 8
React Router 8 was released in June 2026; 7.18 is still maintained and supports Vite 8 (already in the repo through Vitest 5). Staying on 7 matches kikimora and keeps an upgrade out of the scaffold. Upgrading to 8 can be its own change.

React Router 7 accepts TypeScript `^5.1 || ^6` only (its type generation uses the TypeScript JavaScript API), so the project moved from TypeScript 7 to 6. Vite 8 resolves tsconfig `paths` natively (`resolve.tsconfigPaths`), so no paths plugin is used.

### 2. Services singleton in `app/lib/services.server.ts`
It calls `createServices()` from `src/composition.ts` once and stores the result on `globalThis` in development, like kikimora's `db.server.ts`, so hot reloads reuse one SQLite connection. The `.server.ts` suffix makes React Router keep it out of the client bundle. `DATABASE_PATH` (default `data/app.sqlite`) chooses the file.

### 3. Loaders return plain view data
The page loader loads the tree, resolves every reference (walking the tree with its expansion path), and returns a serializable view model: blocks with their children, and for references either the resolved target or a `missing`/`cycle` marker. Components render that model and never call services. This keeps the renderer a pure function of data, which the keyboard spike and the editor can reuse.

### 4. Block renderers mirror the future registry
`app/blocks/` holds one small component per block type and a `renderBlock` switch keyed by type. It is the read-only version of the block registry discussed earlier; the editor will add editing behaviour per type, not replace this structure.

### 5. Theme mode in a cookie
As in kikimora: the root loader reads the mode cookie, `AppThemeProvider` passes it to `DesignSystemProvider` and writes the cookie when it changes. Only light/dark for now; the design system's named themes (Tokyo Night) can be exposed later.

### 6. Seeding uses the block service
`scripts/seed.ts` runs with `tsx`, because Node's type stripping can't resolve the domain's extensionless imports or the `~` alias. It inserts pages through `BlockService.apply`, so seed data is validated like any other write. Fixed block IDs make it idempotent: if the "Welcome" page exists, seeding stops.

**Alternative considered:** raw SQL inserts. Rejected: they would bypass validation and the linked-list ordering.

### 7. Marks and lists use semantic HTML
The design system has no components for bold/italic/underline/strikethrough or for document-style bullet and numbered lists (`List` is a bordered, menu-style container). The viewer uses `<strong>`, `<em>`, `<u>`, `<s>`, `<ul>`/`<ol>` and a small `app/app.css` for indentation, with `InlineCode` and `Link` from the design system. Document text and list primitives are a candidate design-system feature request.

### 8. Separate Vite and Vitest configs
`vite.config.ts` loads the React Router plugin; `vitest.config.ts` stays as it is so domain tests don't boot the framework. Component tests, when added, render with `react-dom/server` in Vitest.

## Risks / Trade-offs

- [The design system's peer ranges and React Router's may disagree] → Install with the versions kikimora uses as the baseline; resolve conflicts during apply, without `--force`.
- [npm drops Vite's native binding (`@rolldown/binding-*`) on incremental installs (npm/cli#4828)] → After adding a dependency, reinstall cleanly: `rm -rf node_modules package-lock.json && npm install`.
- [Resolving references in the loader adds reads per reference] → Pages are small and the database is local.

## Migration Plan

No data migration. Existing databases keep working; `db:reset` is available for a clean start.

## Open Questions

- Upgrade to React Router 8 later, as its own change?
- Expose the design system's named themes (Tokyo Night) next to light/dark?
