import type { Account, AgentToken, Session } from "./types";

/**
 * The owner's account and its sessions. Kept apart from the unit of work on
 * purpose: signing in and renewing sessions aren't content changes, and must
 * not wake every open tab's live refresh.
 */
export interface AccountRepository {
  /** The account, if one was created. */
  getAccount(): Account | undefined;
  insertAccount(account: Account): void;
  updateAccount(account: Account): void;

  insertSession(session: Session): void;
  getSession(idHash: string): Session | undefined;
  updateSession(session: Session): void;
  deleteSession(idHash: string): void;
  /** Ends every session, or every one but `keepIdHash`. */
  deleteSessions(keepIdHash?: string): void;
}

export interface AgentTokenRepository {
  insert(token: AgentToken): void;
  update(token: AgentToken): void;
  get(id: string): AgentToken | undefined;
  findByHash(tokenHash: string): AgentToken | undefined;
  /** The unrevoked token registered under `name`. */
  findActive(name: string): AgentToken | undefined;
  /** Unrevoked tokens, oldest first. */
  listActive(): AgentToken[];
}
