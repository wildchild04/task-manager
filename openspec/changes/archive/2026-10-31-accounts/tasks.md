## 1. Storage and domain

- [x] 1.1 `db/migrations/008_accounts.sql`: `accounts`, `sessions` (`id_hash`, `account_id`, `created_at`, `expires_at`, `last_seen_at`) and `agent_tokens` (`id`, `name`, `token_hash`, `prefix`, `created_at`, `last_used_at`, `revoked_at`; unique name among unrevoked); a migration test
- [x] 1.2 `src/domain/accounts/`: types, repository ports, scrypt password hashing and SHA-256 token hashing on `node:crypto`, with injected `now` and random bytes
- [x] 1.3 `AccountService`: `hasAccount`, `createOwner` (one only), `verify`, `changePassword` (ends other sessions), `setPassword` (ends all), `startSession`, `resumeSession` (30 days since last use; renewed at most daily), `endSession`; validation (an email address, stored lower-cased; 12+ character password)
- [x] 1.4 `AgentTokenService`: `register` (name rules, active name unique, `ntm_` token shown once), `list`, `revoke`, `authenticate` (`last_used_at` at most once a minute)
- [x] 1.5 SQLite and in-memory repositories; wiring in `src/composition.ts`; contract tests for both services against both stores

## 2. Requiring a session

- [x] 2.1 `future.v8_middleware`; the root middleware: `/login`, `/setup` (only without an account) and `/api/agent/*` pass; no account → `/setup`; documents and data → `/login?next=`; `/api/*` and `/content/*` → 401; cross-site `Origin` on POST → 403; the session in the router context
- [x] 2.2 Session cookie helpers (`ntm_session`, base path, `HttpOnly`, `SameSite=Lax`, `Secure` over HTTPS, `Max-Age` refreshed on renewal); `next` limited to app paths
- [x] 2.3 Sign-in throttling (in memory: from the 5th failure in 15 minutes, a doubling delay up to 60 s)
- [x] 2.4 Tests in `tests/app/` for the middleware's table, the cookie and `next`

## 3. Screens

- [x] 3.1 `/setup` and `/login` (outside the shell), `/logout` (POST)
- [x] 3.2 `/settings`: account (change password) and agents (list, Register agent… with the one-time token dialog and Copy, Revoke with confirmation)
- [x] 3.3 The shell's account menu (email, Settings, Sign out)
- [x] 3.4 Tests for the actions (setup, login, wrong password, change password ending other sessions, register, revoke)

## 4. Agents

- [x] 4.1 `handleAgentRequest` authenticates with `agentTokens.authenticate`, acts as the token's name, ignores `X-Agent-Name`, answers 401 with the "register in Settings" message; `api.agent.ts` stops reading `AGENT_TOKEN`; agent API tests use registered tokens (name from the token, revoked, `X-Agent-Name` ignored)
- [x] 4.2 `mcp/server.ts` needs only `APP_URL` and `AGENT_TOKEN`, sends no name; `mcp/README.md`; MCP tests
- [x] 4.3 `scripts/account.ts` (`password`, `agent <name>`, `agents`, `revoke <name>`), `npm run account`, `just account` (inside the container on the homelab); remove the `agent-token` recipe and `AGENT_TOKEN` from `docker-compose.yml`; README deploy steps

## 5. Check

- [x] 5.1 Playwright: `globalSetup` creating the account and agents "builder" and "playwright" through `/setup` and `/settings`, saving the storage state and the tokens for `helpers.agent`; drop `AGENT_TOKEN` from the config; `accounts.spec.ts` (sign out, redirect back after sign-in, wrong password, register and revoke an agent)
- [x] 5.2 Typecheck, unit tests, the whole Playwright suite
- [x] 5.3 On the dev instance: create the account, register "claude", update `dev.env`, reconnect `notion-tasks-dev` and use it
