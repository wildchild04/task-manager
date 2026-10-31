import { randomBytes as cryptoRandomBytes } from "node:crypto";

import type { AgentTokenRepository } from "./account.repository";
import { AccountError } from "./errors";
import { hashToken, type RandomBytes } from "./secrets";
import type { AgentToken } from "./types";

export const AGENT_NAME_PATTERN = /^[A-Za-z0-9_-]{1,40}$/;
const TOKEN_PREFIX = "ntm_";
/** `last_used_at` is written at most this often. */
const USE_GRANULARITY = 60 * 1000;

const fail = (code: AccountError["code"], message: string, field?: string): never => {
  throw new AccountError(code, message, field);
};

/** A registered agent as listed: never its token. */
export type AgentSummary = Pick<AgentToken, "id" | "name" | "prefix" | "createdAt" | "lastUsedAt">;

const summary = ({ id, name, prefix, createdAt, lastUsedAt }: AgentToken): AgentSummary => ({ id, name, prefix, createdAt, lastUsedAt });

/** Agents and their tokens: the token an agent calls with decides its name. */
export class AgentTokenService {
  constructor(
    private readonly repo: AgentTokenRepository,
    private readonly newId: () => string = () => crypto.randomUUID(),
    private readonly now: () => string = () => new Date().toISOString(),
    private readonly randomBytes: RandomBytes = cryptoRandomBytes,
  ) {}

  /** Registers an agent; its token is returned this once and only its hash is kept. */
  register(name: string): { token: string; agent: AgentSummary } {
    const trimmed = name.trim();
    if (!AGENT_NAME_PATTERN.test(trimmed)) {
      fail("validation", "A name is 1 to 40 letters, digits, - or _", "name");
    }
    if (this.repo.findActive(trimmed)) fail("exists", `"${trimmed}" already has a token`, "name");
    const token = TOKEN_PREFIX + this.randomBytes(32).toString("base64url");
    const agent: AgentToken = {
      id: this.newId(),
      name: trimmed,
      tokenHash: hashToken(token),
      prefix: token.slice(0, 8),
      createdAt: this.now(),
      lastUsedAt: null,
      revokedAt: null,
    };
    this.repo.insert(agent);
    return { token, agent: summary(agent) };
  }

  /** Registered agents whose token works, oldest first. */
  list(): AgentSummary[] {
    return this.repo.listActive().map(summary);
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
