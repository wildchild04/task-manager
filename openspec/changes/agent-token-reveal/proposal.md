## Why

An agent's token is shown once, when it's registered. Setting up a second machine's MCP profile, or losing the profile, means revoking and registering again. The owner wants tokens kept in the database, encrypted, so Settings can show one again.

## What Changes

- **Tokens kept, encrypted.** Registering stores the token encrypted with AES-256-GCM under a key from `SECRET_KEY`, beside the hash that still checks requests. Without `SECRET_KEY`, nothing is kept and tokens stay show-once, as today.
- **Show token.** Each agent in Settings gets **Show token…**: after the owner's password, a dialog shows the token with Copy and the profile line. `just account token <name>` prints it from the command line.
- **Tokens from before** have no stored copy: Settings says to revoke and register again to be able to show it.
- **`SECRET_KEY`**: a new setting (at least 32 characters), passed to the container by compose; `just secret-key` adds one to `.env` when it's missing. Losing or changing it only loses Show token: agents keep working.

## Capabilities

### New Capabilities

### Modified Capabilities
- `agent-tokens`: tokens are kept encrypted when `SECRET_KEY` is set; Settings and the command line can show a token again.

## Impact

- `db/migrations/009_agent_token_secrets.sql`: `agent_tokens.token_encrypted`.
- `src/domain/accounts/`: a `TokenCipher` (AES-256-GCM, the key derived from `SECRET_KEY`), `AgentTokenService.register` storing the ciphertext and `reveal(id)`; composition reads `SECRET_KEY`.
- `app/lib/account.server.ts`, `app/routes/settings.tsx` (Show token… with the password), `scripts/account.ts` (`token <name>`).
- `docker-compose.yml`, `.env.example`, `.env.docker.example`, `justfile` (`secret-key`), README.
