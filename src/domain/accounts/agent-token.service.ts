import { randomBytes as cryptoRandomBytes } from "node:crypto";

import type { AgentTokenRepository } from "./account.repository";
import { AccountError } from "./errors";
import { hashToken, type RandomBytes, type TokenCipher } from "./secrets";
import type { AgentToken } from "./types";

export const AGENT_NAME_PATTERN = /^[A-Za-z0-9_-]{1,40}$/;
const TOKEN_PREFIX = "ntm_";
/** `last_used_at` is written at most this often. */
const USE_GRANULARITY = 60 * 1000;

const fail = (code: AccountError["code"], message: string, field?: string): never => {
  throw new AccountError(code, message, field);
};

/** A registered agent as listed: never its token; `kept` says whether it can be shown again. */
export type AgentSummary = Pick<AgentToken, "id" | "name" | "prefix" | "createdAt" | "lastUsedAt"> & { kept: boolean };

const summary = ({ id, name, prefix, createdAt, lastUsedAt, tokenEncrypted }: AgentToken): AgentSummary => ({
  id,
  name,
  prefix,
  createdAt,
  lastUsedAt,
  kept: tokenEncrypted !== null,
});

/** Agents and their tokens: the token an agent calls with decides its name. */
export class AgentTokenService {
  constructor(
    private readonly repo: AgentTokenRepository,
    private readonly newId: () => string = () => crypto.randomUUID(),
    private readonly now: () => string = () => new Date().toISOString(),
    private readonly randomBytes: RandomBytes = cryptoRandomBytes,
    /** Keeps tokens encrypted so they can be shown again; without it, a token is shown once. */
    private readonly cipher?: TokenCipher,
  ) {}

  /** Registers an agent: its token is returned, its hash kept to check requests, and with a cipher an encrypted copy. */
  register(name: string): { token: string; agent: AgentSummary } {
    const trimmed = name.trim();
    if (!AGENT_NAME_PATTERN.test(trimmed)) {
      fail("validation", "A name is 1 to 40 letters, digits, - or _", "name");
    }
    if (this.repo.findActive(trimmed)) fail("exists", `"${trimmed}" already has a token`, "name");
    const token = TOKEN_PREFIX + this.randomBytes(32).toString("base64url");
    const id = this.newId();
    const agent: AgentToken = {
      id,
      name: trimmed,
      tokenHash: hashToken(token),
      prefix: token.slice(0, 8),
      tokenEncrypted: this.cipher ? this.cipher.encrypt(token, id) : null,
      createdAt: this.now(),
      lastUsedAt: null,
      revokedAt: null,
    };
    this.repo.insert(agent);
    return { token, agent: summary(agent) };
  }

  /** Whether tokens are kept (encrypted) when registered, so they can be shown again. */
  get keepsTokens(): boolean {
    return this.cipher !== undefined;
  }

  /** Registered agents whose token works, oldest first. */
  list(): AgentSummary[] {
    return this.repo.listActive().map(summary);
  }

  /** A registered agent's token, decrypted, to show it again. */
  reveal(id: string): string {
    const agent = this.repo.get(id);
    if (!agent || agent.revokedAt) fail("not_found", "There is no such agent");
    if (!agent!.tokenEncrypted) {
      fail("unavailable", "This token wasn't kept: revoke it and register the agent again to be able to show it");
    }
    if (!this.cipher) fail("unavailable", "Set SECRET_KEY to keep and show tokens");
    return this.cipher!.decrypt(agent!.tokenEncrypted!, agent!.id) ?? fail("unavailable", "This token can't be read with the current SECRET_KEY");
  }

  /** The token of the agent registered under `name`. */
  revealByName(name: string): string {
    const agent = this.repo.findActive(name.trim()) ?? fail("not_found", `No agent is registered as "${name}"`);
    return this.reveal(agent.id);
  }

  /** Stops an agent's token at once; its name is free to register again. */
  revoke(id: string): void {
    const agent = this.repo.get(id);
    if (!agent || agent.revokedAt) fail("not_found", "There is no such agent");
    this.repo.update({ ...agent!, revokedAt: this.now() });
  }

  /** Revokes the agent registered under `name`. */
  revokeByName(name: string): void {
    const agent = this.repo.findActive(name.trim()) ?? fail("not_found", `No agent is registered as "${name}"`);
    this.revoke(agent.id);
  }

  /** The name of the agent a token belongs to, if it's registered and not revoked. */
  authenticate(token: string): string | undefined {
    if (!token.startsWith(TOKEN_PREFIX)) return undefined;
    const agent = this.repo.findByHash(hashToken(token));
    if (!agent || agent.revokedAt) return undefined;
    const at = this.now();
    if (!agent.lastUsedAt || Date.parse(at) - Date.parse(agent.lastUsedAt) >= USE_GRANULARITY) {
      this.repo.update({ ...agent, lastUsedAt: at });
    }
    return agent.name;
  }
}
