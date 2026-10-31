## Why

Anyone who can reach the homelab (LAN or tailnet) can read and change everything, and every agent shares one `AGENT_TOKEN`, naming itself with a header it chooses. Now that ownership decides who may edit a finding or withdraw a suggestion, an agent's name has to be trustworthy, and the app needs a door. The decision on "Login and access control": real accounts, with a token registered per agent.

## What Changes

- **An owner account, identified by its email address.** The first visit with no account offers "Create your account" (an email address and a password). After that, every screen and route requires signing in, except the sign-in page itself and static assets. Humans stay recorded as "human"; there's one account.
- **Everything already in the database belongs to the owner.** With one account, a human action means the owner, so existing projects, pages, tasks, comments, findings and history need no migration. Records carry no owner yet; if more people ever get accounts, that change assigns everything existing to the owner's account first.
- **Sign in and out.** A password checked against a scrypt hash; a session cookie (HTTP-only, `SameSite=Lax`, `Secure` over HTTPS) kept 30 days and renewed while used; sign out from the top bar. Repeated wrong passwords slow down.
- **Settings page** (`/settings`): change the password; register an agent by name and see its token once; list agents with when each token was last used; revoke a token.
- **Agent tokens decide the agent.** `/api/agent/*` accepts `Authorization: Bearer <token>` for a registered, unrevoked agent and acts as that agent's name. **BREAKING**: `X-Agent-Name` is ignored, and the shared `AGENT_TOKEN` is no longer read; the MCP server needs only `APP_URL` and `AGENT_TOKEN` (the agent's own token), and `AGENT_NAME` is dropped.
- **Recovery from the command line**: `just account password` sets a new password, and `just account agent <name>` registers an agent and prints its token, both run against the database.
- **BREAKING (deployment)**: after deploying, the owner creates the account, registers "claude" in settings, and puts its token in the MCP profiles.

## Capabilities

### New Capabilities
- `accounts`: the owner account, first-run setup, signing in and out, sessions, what requires signing in, changing the password, and recovery from the command line.
- `agent-tokens`: registering agents and their tokens, revoking them, and the settings page that lists them.

### Modified Capabilities
- `agent-api`: authentication and identity come from the agent's own token, not `AGENT_TOKEN` and `X-Agent-Name`.
- `agent-mcp`: configured by `APP_URL` and `AGENT_TOKEN` only.
- `app-shell`: the top bar offers Settings and Sign out.

## Impact

- `db/migrations/008_accounts.sql`: `accounts`, `sessions` and `agent_tokens` tables.
- New domain module `src/domain/accounts/` (account, sessions, agent tokens; scrypt and SHA-256 from `node:crypto`), SQLite and in-memory repositories, wired in `src/composition.ts`.
- React Router middleware (`future.v8_middleware`) on the root route requiring a session; new routes `/setup`, `/login`, `/logout`, `/settings`.
- `app/lib/agent/request.server.ts` and `app/routes/api.agent.ts` (token lookup), `mcp/server.ts`, `mcp/README.md`, `justfile` (`agent-token` recipe replaced by `account`), `docker-compose.yml` (no `AGENT_TOKEN`).
- Tests: domain contract tests, agent API tests, MCP tests, a Playwright global setup that creates the account and an agent token, and a Playwright spec for setup, sign-in and settings.
