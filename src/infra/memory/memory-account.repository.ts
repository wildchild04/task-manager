import type { AccountRepository, AgentTokenRepository } from "~/domain/accounts/account.repository";
import type { Account, AgentToken, Session } from "~/domain/accounts/types";

export class MemoryAccountRepository implements AccountRepository {
  private account: Account | undefined;
  private readonly sessions = new Map<string, Session>();

  getAccount(): Account | undefined {
    return this.account;
  }
  insertAccount(account: Account): void {
    if (this.account) throw new Error("UNIQUE constraint failed: accounts");
    this.account = account;
  }
  updateAccount(account: Account): void {
    this.account = account;
  }
  insertSession(session: Session): void {
    this.sessions.set(session.idHash, session);
  }
  getSession(idHash: string): Session | undefined {
    return this.sessions.get(idHash);
  }
  updateSession(session: Session): void {
    this.sessions.set(session.idHash, session);
  }
  deleteSession(idHash: string): void {
    this.sessions.delete(idHash);
  }
  deleteSessions(keepIdHash?: string): void {
    for (const idHash of [...this.sessions.keys()]) if (idHash !== keepIdHash) this.sessions.delete(idHash);
  }
}

export class MemoryAgentTokenRepository implements AgentTokenRepository {
  private readonly tokens = new Map<string, AgentToken>();

  insert(token: AgentToken): void {
    this.tokens.set(token.id, token);
  }
  update(token: AgentToken): void {
    this.tokens.set(token.id, token);
  }
  get(id: string): AgentToken | undefined {
    return this.tokens.get(id);
  }
  findByHash(tokenHash: string): AgentToken | undefined {
    return [...this.tokens.values()].find((t) => t.tokenHash === tokenHash);
  }
  findActive(name: string): AgentToken | undefined {
    return [...this.tokens.values()].find((t) => t.name === name && !t.revokedAt);
  }
  listActive(): AgentToken[] {
    return [...this.tokens.values()].filter((t) => !t.revokedAt);
  }
}
