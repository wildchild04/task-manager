/** The owner's account: the only one. Human actions are recorded as `{ kind: "human" }`, meaning this account. */
export type Account = {
  id: string;
  /** Trimmed and lower-cased; what the owner signs in with. Nothing is sent to it. */
  email: string;
  /** `scrypt$N$r$p$salt$hash`, salt and hash in base64url. */
  passwordHash: string;
  createdAt: string;
  updatedAt: string;
};

/** A signed-in browser. Only the SHA-256 of the cookie's token is stored. */
export type Session = {
  idHash: string;
  accountId: string;
  createdAt: string;
  /** 30 days after `lastSeenAt`. */
  expiresAt: string;
  lastSeenAt: string;
};

/** A registered agent: its token (stored as a hash) decides its name. */
export type AgentToken = {
  id: string;
  name: string;
  tokenHash: string;
  /** The token's first 8 characters, to tell tokens apart. */
  prefix: string;
  /** The token encrypted under `SECRET_KEY` (`v1.<iv>.<ciphertext>`), to show it again; null when it wasn't kept. */
  tokenEncrypted: string | null;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
};
