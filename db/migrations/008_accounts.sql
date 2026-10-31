-- The owner's account (at most one), its sessions, and the agents registered with their own tokens.
CREATE TABLE accounts (
  id TEXT PRIMARY KEY,
  -- Trimmed and lower-cased.
  email TEXT NOT NULL UNIQUE,
  -- scrypt$N$r$p$salt$hash
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE sessions (
  -- SHA-256 of the cookie's token: the token itself is never stored.
  id_hash TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL
);

CREATE TABLE agent_tokens (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  -- SHA-256 of the token, which is shown once when registered.
  token_hash TEXT NOT NULL UNIQUE,
  -- The token's first 8 characters, to tell tokens apart.
  prefix TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_used_at TEXT,
  revoked_at TEXT
);

-- A name has one working token at a time; revoking frees it.
CREATE UNIQUE INDEX agent_tokens_active_name ON agent_tokens (name) WHERE revoked_at IS NULL;
