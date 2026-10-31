## Context

`agent_tokens` keeps the SHA-256 of each token (to authenticate) and its first 8 characters; the token itself is only in the registration dialog. The owner chose: keep tokens so Settings can show them again, encrypted with a key from the environment (`SECRET_KEY`), so a copy of the database alone (a backup) doesn't reveal them.

## Goals / Non-Goals

**Goals:** show a registered agent's token again, behind the owner's password; tokens at rest encrypted with a key that isn't in the database.

**Non-Goals:** encrypting other data; key rotation tooling (re-registering covers it); recovering tokens registered before this change.

## Decisions

### Storage and cipher

Migration 009 adds `token_encrypted TEXT` to `agent_tokens` (null for tokens registered before, or without a key). The hash stays the only thing requests are checked against: decryption is never on the request path.

`AesTokenCipher` (in `src/domain/accounts/secrets.ts`, `node:crypto`):
- key: SHA-256 of `SECRET_KEY` (the secret is required to be at least 32 characters, so it's high-entropy already; SHA-256 just fixes its length);
- `encrypt(token, agentId)`: AES-256-GCM, a random 12-byte IV, the agent's ID as additional data (a ciphertext copied to another row won't decrypt), stored as `v1.<iv>.<ciphertext+tag>` in base64url;
- `decrypt` returns `undefined` when the tag doesn't verify (a different key).

`AgentTokenService` takes an optional cipher. `register` stores the ciphertext when there is one. `reveal(id)` returns the token, or throws `AccountError`:
- `not_found` for an unknown or revoked agent;
- `unavailable` "This token wasn't kept: revoke it and register the agent again to be able to show it" (no ciphertext);
- `unavailable` "This token can't be read with the current SECRET_KEY" (decryption fails), or "Set SECRET_KEY to keep and show tokens" (no cipher).

`list()` reports `kept: boolean` per agent, so Settings knows whether to offer Show token.

### Configuration

`createServices` reads `SECRET_KEY` (through `ServiceOptions.secretKey`, for tests). Shorter than 32 characters: the app refuses to start, naming the setting. Unset: no cipher; registering still works, show-once. Compose passes `SECRET_KEY: ${SECRET_KEY:-}`; `just secret-key` appends a random one to `.env` if there's none (never overwriting), like the removed `agent-token` recipe. The dev `.env` gets one too.

### Showing a token

Settings lists, per agent, **Show token…** when `kept`. It opens a dialog asking for the owner's password; the `reveal-agent` action checks it with `accounts.verify` (wrong passwords count toward the sign-in throttle) and answers with the token, shown in the same dialog as after registering (Copy, `AGENT_TOKEN=` line). Agents whose token wasn't kept show "registered before tokens were kept" instead. The command line gets `account token <name>` (no password: whoever runs it has the database and the key).

## Risks / Trade-offs

- **Key beside the database on the host**: `.env` and `data/` live in the same checkout on the homelab; backups of `data/` (as the README suggests) don't include `.env`. Good enough for the stated goal.
- **Lost key**: Show token stops working for existing agents; they keep authenticating by hash. Re-register to show again.
- **A stolen session can read tokens**: the password prompt guards that.

## Migration Plan

Deploy, run `just secret-key` on the homelab (then `just deploy` or `docker compose up -d` to pass it in), and re-register "claude" if you want its token showable.
