## Context

Today:
- **Humans:** there's no login. Every human change is recorded with the actor `{ kind: "human" }`, without a name.
- **Agents:** they authenticate with one shared `AGENT_TOKEN` (`app/routes/api.agent.ts` passes `process.env.AGENT_TOKEN` to `handleAgentRequest`). The agent's name comes from `X-Agent-Name`, so any holder of the token can claim any name.
- **Serving:**
  - In production, `server.mjs` (Express) serves the React Router build behind Caddy, over HTTPS, under `/task-manager`.
  - In development, `react-router dev` serves it, with no Express in front.
  - React Router is 7.18, which has stable middleware behind `future.v8_middleware`.
- **Agent ownership:** who holds a work task, and whose findings and suggestions an agent may change, depends on the agent's name.

Decisions taken on the work task "Accounts and agent tokens":
- one owner account;
- a password;
- one token per agent name;
- the shared `AGENT_TOKEN` is removed.

### Ownership of existing data

Everything in the database when accounts arrive belongs to the owner, the one account (on the homelab, the owner's email). Nothing needs migrating for that: there is one account, every human action already means "the owner", and records carry no owner. The setup screen doesn't prefill or hardcode an address. If several people ever get accounts, that change adds owners to records and assigns everything existing to the owner's account, by its ID, in its migration.

## Goals / Non-Goals

**Goals:**
- Nothing of the app is reachable without signing in, except:
  - the sign-in and first-run screens;
  - static assets;
  - the agent API, which has its own tokens.
- An agent's name comes from its token, so agents can't act as each other.
- The owner manages agent tokens in the app, and can recover from the command line.
- The development server and the tests run the same checks as production.

**Non-Goals:**
- Several human accounts, names on human actions, and roles.
- Passkeys, two-factor sign-in, and email password reset.
- Per-agent permissions beyond the name.
- Auth in Caddy.

## Decisions

### Storage: migration 008

- `accounts`:
  - `id`
  - `email` (unique; stored trimmed and lower-cased, and what you sign in with)
  - `password_hash`: `scrypt$N$r$p$salt$hash`
  - `created_at`, `updated_at`

  At most one row. The domain refuses to create a second account.
- `sessions`:
  - `id_hash`: the SHA-256 of the cookie's random 32-byte token, so a leaked database can't be used to sign in.
  - `account_id`, `created_at`, `expires_at`, `last_seen_at`
- `agent_tokens`:
  - `id`
  - `name`: unique while the token isn't revoked
  - `token_hash`: SHA-256
  - `prefix`: the first 8 characters, to tell tokens apart in the list
  - `created_at`, `last_used_at`, `revoked_at`

Tokens are `ntm_` followed by 32 random bytes in base64url. They're only ever shown once.

Hashing uses `node:crypto` only:
- passwords: `scrypt`, with N=16384, r=8, p=1 and a 16-byte salt, compared with `timingSafeEqual`;
- session and agent tokens: SHA-256. These are random secrets, so a fast hash is enough.

### Domain: `AccountService`

The service lives in `src/domain/accounts/` and uses the unit of work. Its methods:
- `hasAccount()`
- `createOwner(email, password)`: refused once an account exists.
- `verify(email, password)`: the email compared ignoring case
- `changePassword(old, new)`: ends every other session.
- `setPassword(new)`: for the command line.
- `startSession()`: returns `{ token, expiresAt }`.
- `resumeSession(token)`: returns the session, or `undefined`. A session expires 30 days after it was last used. It's renewed when it is used and more than a day has passed since `last_seen_at`, which avoids a write per request.
- `endSession(token)`

Passwords are at least 12 characters. The email needs one `@` with text on both sides; nothing is sent to it.

`AgentTokenService` has `register(name)` (returns `{ token, agent }`), `list()`, `revoke(id)` and `authenticate(token)` (returns the agent's name, and updates `last_used_at` at most once a minute). A name has the same rules as before: 1 to 40 characters, letters, digits, `-` and `_`. A name that already has an active token is refused. Revoking frees the name.

Time and randomness are injected (`now`, `newId`, `randomBytes`), as in the other services, so the contract tests are deterministic.

### Requiring a session: root middleware

`app/root.tsx` exports a middleware, with `future.v8_middleware` turned on in `react-router.config.ts`. It runs for every document request, data request and resource route:

| Path | Without a session |
|---|---|
| `/login`, `/setup` | allowed. `/setup` only while no account exists, otherwise it redirects to `/login`. |
| `/api/agent/*` | allowed: the agent API checks its own token |
| anything else, while no account exists | redirect to `/setup` |
| anything else, with an account | documents and data requests: redirect to `/login?next=<path>`. `/api/*` and `/content/*`: 401 JSON. |

The session goes into the router context, for the shell's top bar. Static assets are served before the router, by Express `static` in production and by Vite in development, so they need no exception.

*Alternative considered:* checking in Express in `server.mjs`. Rejected: `npm run dev` and Playwright don't run through it.

### Cookies and CSRF

The cookie is named `ntm_session`, with `Path=<basename>/`, `HttpOnly`, `SameSite=Lax`, and `Secure` when the request is HTTPS (Express already trusts the proxy's `X-Forwarded-Proto`). It has a `Max-Age` of 30 days and is refreshed when the session is renewed.

`SameSite=Lax` keeps the cookie off cross-site POSTs. React Router already refuses form posts whose `Origin` doesn't match. The JSON resource routes (`/api/edits`, `/api/suggestions` …) also get an `Origin` check in the middleware: a POST whose `Origin` header is present and differs from the app's origin is refused with 403.

### Sign-in throttling

Wrong passwords are counted in memory, for the app as a whole: there is one account, and the client IP isn't reachable in the router during development. From the 5th failure within 15 minutes, each further attempt waits `2^(n-5)` seconds, capped at 60, before it's checked. A success clears the count. An in-memory count is enough for a single process.

### Screens

- **`/setup`:** "Create your account", with Email, Password and Confirm. It's shown only while no account exists. Creating the account signs in and opens home.
- **`/login`:** Email and Password. A wrong email or password says "Wrong email or password" and nothing else. Success goes to `next`, which must be a same-app path; otherwise it goes home.
- **`/logout`:** a POST that ends the session, clears the cookie and goes to `/login`.
- **`/settings`:**
  - **Account:** the email, and changing the password (current, new and confirm).
  - **Agents:** registered agents, each with its name, its token's prefix, when it was created, and when it was last used ("never" until then), with **Revoke** (after a confirmation).
  - **Register agent…**: takes a name and shows the token once, in a dialog with Copy and the line to put in an MCP profile (`AGENT_TOKEN=…`).
- **Top bar:** the shell's top bar gets an account menu with the email, Settings and Sign out.

### Agent API

`handleAgentRequest(services, request, path)` no longer takes the environment token. It authenticates the Bearer token with `agentTokens.authenticate`, and acts as `{ kind: "agent", name }` with that name:
- a missing token is answered with 401 `unauthorized`;
- an unknown or revoked token is also answered with 401 `unauthorized`;
- `X-Agent-Name` is ignored;
- the `disabled` (403) answer goes away. Without registered agents, every agent request is simply unauthorized.

The MCP server needs only `APP_URL` and `AGENT_TOKEN`, and stops sending `X-Agent-Name`. `AGENT_NAME`, if still set, is ignored with no error, so the old profiles keep starting.

### Command line

`scripts/account.ts` (`npm run account`, and `just account …`) opens `DATABASE_PATH` and runs the migrations. Its subcommands:
- `password`: prompts twice without echo, and creates the account (asking for the email) if there is none.
- `agent <name>`: registers the agent and prints the token.
- `agents`: lists the agents.
- `revoke <name>`

On the homelab it runs inside the container, through `just` and `docker compose exec`. The `agent-token` recipe is removed.

SQLite runs in WAL mode, so the script can write while the app is running.

### Tests

- **Contract tests:** `accounts` and `agent tokens`, against memory and SQLite.
- **App tests:**
  - the middleware's table: setup redirect, login redirect with `next`, 401 for API and content routes, agent API passing;
  - login, logout and settings actions;
  - the agent API with registered tokens: the name from the token, a revoked token refused, `X-Agent-Name` ignored.
- **Playwright:**
  - A `globalSetup` creates the account and registers agents "builder" and "playwright" through the app's own routes (`/setup`, then `/settings`). It saves the storage state for every test, and writes the tokens to `tests/.tmp/agents.json` for `helpers.agent`.
  - `AGENT_TOKEN` leaves `playwright.config.ts`.
  - A new `accounts.spec.ts` covers sign-out, the login redirect back to the page, a wrong password, and registering and revoking an agent.

## Risks / Trade-offs

- **The first visitor claims the app:** between deploying and creating the account, anyone on the LAN or tailnet could create it. The window is short, because the owner deploys and opens it straight away. If someone else got there first, `just account password` on the server takes the account back, since it sets the password.
- **Agents break until they get their tokens:** after the deploy, the MCP servers get 401 until "claude" is registered and the profiles are updated. The deploy steps say so, and the 401 message says "Register this agent in Settings and use its token".
- **Server-side event streams and expiry:** `/api/changes` streams for hours. The session is checked when the stream opens. A session that expires while a stream is open shows up at the next reconnect, which is acceptable.
- **No email recovery:** recovery is through the command line on the host, which the owner has.

## Migration Plan

1. Deploy. Migration 008 creates empty tables. The app then redirects to `/setup` until the account exists.
2. Create the account in the browser.
3. In Settings, register "claude", then put its token as `AGENT_TOKEN` in `~/.config/notion-tasks-mcp/*.env`, and drop `AGENT_NAME`. Reconnect the MCP servers.
4. Remove `AGENT_TOKEN` from the homelab's `.env`.

To roll back, redeploy the previous image. The new tables are simply ignored, and `AGENT_TOKEN` would need to be set again.

## Open Questions

- None blocking. Whether to show the agent's token prefix in history ("claude (ntm_ab12…)") can wait for a need.
