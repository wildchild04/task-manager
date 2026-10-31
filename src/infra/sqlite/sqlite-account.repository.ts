import type Database from "better-sqlite3";

import type { AccountRepository, AgentTokenRepository } from "~/domain/accounts/account.repository";
import type { Account, AgentToken, Session } from "~/domain/accounts/types";

type AccountRow = { id: string; email: string; password_hash: string; created_at: string; updated_at: string };
type SessionRow = { id_hash: string; account_id: string; created_at: string; expires_at: string; last_seen_at: string };
type AgentRow = {
  id: string;
  name: string;
  token_hash: string;
  prefix: string;
  token_encrypted: string | null;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
};

const toAccount = (r: AccountRow): Account => ({
  id: r.id,
  email: r.email,
  passwordHash: r.password_hash,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});
const toSession = (r: SessionRow): Session => ({
  idHash: r.id_hash,
  accountId: r.account_id,
  createdAt: r.created_at,
  expiresAt: r.expires_at,
  lastSeenAt: r.last_seen_at,
});
const toAgent = (r: AgentRow): AgentToken => ({
  id: r.id,
  name: r.name,
  tokenHash: r.token_hash,
  prefix: r.prefix,
  tokenEncrypted: r.token_encrypted,
  createdAt: r.created_at,
  lastUsedAt: r.last_used_at,
  revokedAt: r.revoked_at,
});

export class SqliteAccountRepository implements AccountRepository {
  private readonly s;

  constructor(db: Database.Database) {
    this.s = {
      getAccount: db.prepare<[], AccountRow>("SELECT * FROM accounts ORDER BY created_at LIMIT 1"),
      insertAccount: db.prepare(
        "INSERT INTO accounts (id, email, password_hash, created_at, updated_at) VALUES (@id, @email, @passwordHash, @createdAt, @updatedAt)",
      ),
      updateAccount: db.prepare(
        "UPDATE accounts SET email = @email, password_hash = @passwordHash, updated_at = @updatedAt WHERE id = @id",
      ),
      insertSession: db.prepare(
        `INSERT INTO sessions (id_hash, account_id, created_at, expires_at, last_seen_at)
         VALUES (@idHash, @accountId, @createdAt, @expiresAt, @lastSeenAt)`,
      ),
      getSession: db.prepare<[string], SessionRow>("SELECT * FROM sessions WHERE id_hash = ?"),
      updateSession: db.prepare("UPDATE sessions SET expires_at = @expiresAt, last_seen_at = @lastSeenAt WHERE id_hash = @idHash"),
      deleteSession: db.prepare("DELETE FROM sessions WHERE id_hash = ?"),
      deleteSessions: db.prepare("DELETE FROM sessions WHERE id_hash IS NOT ?"),
    };
  }

  getAccount(): Account | undefined {
    const row = this.s.getAccount.get();
    return row && toAccount(row);
  }
  insertAccount(account: Account): void {
    this.s.insertAccount.run(account);
  }
  updateAccount(account: Account): void {
    this.s.updateAccount.run(account);
  }
  insertSession(session: Session): void {
    this.s.insertSession.run(session);
  }
  getSession(idHash: string): Session | undefined {
    const row = this.s.getSession.get(idHash);
    return row && toSession(row);
  }
  updateSession(session: Session): void {
    this.s.updateSession.run(session);
  }
  deleteSession(idHash: string): void {
    this.s.deleteSession.run(idHash);
  }
  deleteSessions(keepIdHash?: string): void {
    this.s.deleteSessions.run(keepIdHash ?? null);
  }
}

export class SqliteAgentTokenRepository implements AgentTokenRepository {
  private readonly s;

  constructor(db: Database.Database) {
    this.s = {
      insert: db.prepare(
        `INSERT INTO agent_tokens (id, name, token_hash, prefix, token_encrypted, created_at, last_used_at, revoked_at)
         VALUES (@id, @name, @tokenHash, @prefix, @tokenEncrypted, @createdAt, @lastUsedAt, @revokedAt)`,
      ),
      update: db.prepare("UPDATE agent_tokens SET last_used_at = @lastUsedAt, revoked_at = @revokedAt WHERE id = @id"),
      get: db.prepare<[string], AgentRow>("SELECT * FROM agent_tokens WHERE id = ?"),
      findByHash: db.prepare<[string], AgentRow>("SELECT * FROM agent_tokens WHERE token_hash = ?"),
      findActive: db.prepare<[string], AgentRow>("SELECT * FROM agent_tokens WHERE name = ? AND revoked_at IS NULL"),
      listActive: db.prepare<[], AgentRow>("SELECT * FROM agent_tokens WHERE revoked_at IS NULL ORDER BY created_at, rowid"),
    };
  }

  insert(token: AgentToken): void {
    this.s.insert.run(token);
  }
  update(token: AgentToken): void {
    this.s.update.run(token);
  }
  get(id: string): AgentToken | undefined {
    const row = this.s.get.get(id);
    return row && toAgent(row);
  }
  findByHash(tokenHash: string): AgentToken | undefined {
    const row = this.s.findByHash.get(tokenHash);
    return row && toAgent(row);
  }
  findActive(name: string): AgentToken | undefined {
    const row = this.s.findActive.get(name);
    return row && toAgent(row);
  }
  listActive(): AgentToken[] {
    return this.s.listActive.all().map(toAgent);
  }
}
