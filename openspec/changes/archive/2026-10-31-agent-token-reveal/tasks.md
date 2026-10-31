## 1. Domain and storage

- [x] 1.1 `db/migrations/009_agent_token_secrets.sql` (`token_encrypted`); repositories store and read it
- [x] 1.2 `AesTokenCipher` (SHA-256 of `SECRET_KEY`, AES-256-GCM, agent ID as AAD, `v1.` format); `AgentTokenService` takes it: `register` keeps the ciphertext, `reveal(id)`, `list()` reports `kept`
- [x] 1.3 `ServiceOptions.secretKey`; `createServices` reads `SECRET_KEY` and refuses one shorter than 32 characters; contract tests (kept, reveal, not kept, other key, no key)

## 2. Settings and command line

- [x] 2.1 `reveal-agent` settings action (password via `accounts.verify`, failures count in the throttle); Show token… dialog reusing the token dialog; "registered before tokens were kept" for the rest; tests
- [x] 2.2 `account token <name>`
- [x] 2.3 `SECRET_KEY` in compose, `.env.example`, `.env.docker.example`; `just secret-key`; README; the dev `.env`

## 3. Check

- [x] 3.1 Typecheck, unit tests, Playwright (extend the accounts spec: Show token after the password); the dev instance
