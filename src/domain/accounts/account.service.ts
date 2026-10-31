import { randomBytes as cryptoRandomBytes } from "node:crypto";

import type { AccountRepository } from "./account.repository";
import { AccountError } from "./errors";
import { hashPassword, hashToken, type RandomBytes, verifyPassword } from "./secrets";
import type { Account, Session } from "./types";

export const PASSWORD_MIN = 12;
/** A session ends this long after it was last used. */
export const SESSION_DAYS = 30;
const DAY = 24 * 60 * 60 * 1000;

const fail = (code: AccountError["code"], message: string, field?: string): never => {
  throw new AccountError(code, message, field);
};

const normalizeEmail = (email: string) => email.trim().toLowerCase();

function checkEmail(email: string): string {
  const normalized = normalizeEmail(email);
  if (!/^[^\s@]+@[^\s@]+$/.test(normalized)) fail("validation", "Enter an email address", "email");
  return normalized;
}

function checkPassword(password: string, field = "password"): void {
  if (password.length < PASSWORD_MIN) fail("validation", `The password needs at least ${PASSWORD_MIN} characters`, field);
}

const addDays = (iso: string, days: number) => new Date(Date.parse(iso) + days * DAY).toISOString();

/** A session that started or was resumed: the cookie's token and when it ends. */
export type SessionGrant = { token: string; expiresAt: string };

/** The owner's account, signing in and the sessions that keep a browser signed in. */
export class AccountService {
  constructor(
    private readonly repo: AccountRepository,
    private readonly newId: () => string = () => crypto.randomUUID(),
    private readonly now: () => string = () => new Date().toISOString(),
    private readonly randomBytes: RandomBytes = cryptoRandomBytes,
  ) {}

  hasAccount(): boolean {
    return this.repo.getAccount() !== undefined;
  }

  /** The account, without its password hash. */
  account(): { id: string; email: string } | undefined {
    const account = this.repo.getAccount();
    return account && { id: account.id, email: account.email };
  }

  /** Creates the owner's account; there is only ever one. */
  createOwner(email: string, password: string): { id: string; email: string } {
    if (this.hasAccount()) fail("exists", "The account already exists");
    const normalized = checkEmail(email);
    checkPassword(password);
    const at = this.now();
    const account: Account = {
      id: this.newId(),
      email: normalized,
      passwordHash: hashPassword(password, this.randomBytes(16)),
      createdAt: at,
      updatedAt: at,
    };
    this.repo.insertAccount(account);
    return { id: account.id, email: account.email };
  }

  /** Whether the email (ignoring case) and password are the account's. */
  verify(email: string, password: string): boolean {
    const account = this.repo.getAccount();
    // Hash anyway when there's no such account, so the answer takes as long either way.
    if (!account || account.email !== normalizeEmail(email)) {
      verifyPassword(password, hashPassword("", Buffer.alloc(16)));
      return false;
    }
    return verifyPassword(password, account.passwordHash);
  }

  /** Changes the password from Settings, ending every other session. */
  changePassword(current: string, next: string, keepToken?: string): void {
    const account = this.repo.getAccount() ?? fail("not_found", "There is no account");
    if (!verifyPassword(current, account.passwordHash)) fail("wrong_password", "That isn't the current password", "current");
    checkPassword(next, "password");
    this.store(account, next);
    this.repo.deleteSessions(keepToken ? hashToken(keepToken) : undefined);
  }

  /** Sets the password from the command line, creating the account if there is none; ends every session. */
  setPassword(password: string, email?: string): { id: string; email: string } {
    const account = this.repo.getAccount();
    if (!account) {
      if (email === undefined) fail("validation", "There is no account yet: give its email", "email");
      return this.createOwner(email!, password);
    }
    checkPassword(password);
    this.store(account, password);
    this.repo.deleteSessions();
    return { id: account.id, email: account.email };
  }

  startSession(): SessionGrant {
    const account = this.repo.getAccount() ?? fail("not_found", "There is no account");
    const token = this.randomBytes(32).toString("base64url");
    const at = this.now();
    const session: Session = {
      idHash: hashToken(token),
      accountId: account.id,
      createdAt: at,
      lastSeenAt: at,
      expiresAt: addDays(at, SESSION_DAYS),
    };
    this.repo.insertSession(session);
    return { token, expiresAt: session.expiresAt };
  }

  /**
   * The session a cookie's token belongs to, if it hasn't ended. Using it renews it, at most once a day
   * so most requests don't write; `renewed` says when the cookie should be sent again.
   */
  resumeSession(token: string): { email: string; expiresAt: string; renewed: boolean } | undefined {
    const session = this.repo.getSession(hashToken(token));
    const account = this.repo.getAccount();
    if (!session || !account || session.accountId !== account.id) return undefined;
    const at = this.now();
    if (Date.parse(session.expiresAt) <= Date.parse(at)) {
      this.repo.deleteSession(session.idHash);
      return undefined;
    }
    if (Date.parse(at) - Date.parse(session.lastSeenAt) < DAY) {
      return { email: account.email, expiresAt: session.expiresAt, renewed: false };
    }
    const renewed: Session = { ...session, lastSeenAt: at, expiresAt: addDays(at, SESSION_DAYS) };
    this.repo.updateSession(renewed);
    return { email: account.email, expiresAt: renewed.expiresAt, renewed: true };
  }

  endSession(token: string): void {
    this.repo.deleteSession(hashToken(token));
  }

  private store(account: Account, password: string) {
    this.repo.updateAccount({ ...account, passwordHash: hashPassword(password, this.randomBytes(16)), updatedAt: this.now() });
  }
}
