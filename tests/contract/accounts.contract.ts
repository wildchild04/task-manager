import { beforeEach, describe, expect, it } from "vitest";

import type { AppServices } from "~/composition";
import { AccountError } from "~/domain/accounts/errors";

import type { ServicesFactory } from "./project.contract";

function expectError(run: () => unknown, code: AccountError["code"], field?: string) {
  let error: unknown;
  try {
    run();
  } catch (e) {
    error = e;
  }
  expect(error).toBeInstanceOf(AccountError);
  expect((error as AccountError).code).toBe(code);
  if (field) expect((error as AccountError).field).toBe(field);
}

const PASSWORD = "correct horse battery";

export function accountsContract(name: string, factory: ServicesFactory) {
  describe(`${name}: accounts contract`, () => {
    let services: AppServices;
    let clock: string;
    let counter: number;
    const at = (iso: string) => (clock = iso);

    beforeEach(() => {
      clock = "2026-11-01T08:00:00.000Z";
      counter = 0;
      services = factory({
        now: () => clock,
        // Distinct, predictable bytes for every call.
        randomBytes: (size) => Buffer.alloc(size, ++counter),
      });
    });

    describe("the owner account", () => {
      it("is created once, with its email lower-cased, and verified ignoring case", () => {
        expect(services.accounts.hasAccount()).toBe(false);
        expect(services.accounts.createOwner("  Owner@Example.com ", PASSWORD)).toMatchObject({ email: "owner@example.com" });
        expect(services.accounts.hasAccount()).toBe(true);
        expect(services.accounts.verify("OWNER@example.com", PASSWORD)).toBe(true);
        expect(services.accounts.verify("owner@example.com", "wrong password!")).toBe(false);
        expect(services.accounts.verify("other@example.com", PASSWORD)).toBe(false);
        expectError(() => services.accounts.createOwner("second@example.com", PASSWORD), "exists");
      });

      it("refuses a missing email or a short password", () => {
        expectError(() => services.accounts.createOwner("owner", PASSWORD), "validation", "email");
        expectError(() => services.accounts.createOwner("owner@example.com", "short"), "validation", "password");
        expect(services.accounts.hasAccount()).toBe(false);
      });
    });

    describe("sessions", () => {
      beforeEach(() => services.accounts.createOwner("owner@example.com", PASSWORD));

      it("resumes for 30 days after last use, renewing at most daily", () => {
        const { token, expiresAt } = services.accounts.startSession();
        expect(expiresAt).toBe("2026-12-01T08:00:00.000Z");
        at("2026-11-01T20:00:00.000Z");
        expect(services.accounts.resumeSession(token)).toEqual({
          email: "owner@example.com",
          expiresAt: "2026-12-01T08:00:00.000Z",
          renewed: false,
        });
        at("2026-11-20T08:00:00.000Z");
        expect(services.accounts.resumeSession(token)).toMatchObject({ expiresAt: "2026-12-20T08:00:00.000Z", renewed: true });
        at("2026-12-21T08:00:00.000Z");
        expect(services.accounts.resumeSession(token)).toBeUndefined();
        expect(services.accounts.resumeSession("not a token")).toBeUndefined();
      });

      it("ends a session on sign-out", () => {
        const { token } = services.accounts.startSession();
        services.accounts.endSession(token);
        expect(services.accounts.resumeSession(token)).toBeUndefined();
      });

      it("ends the other sessions when the password changes", () => {
        const mine = services.accounts.startSession().token;
        const other = services.accounts.startSession().token;
        expectError(() => services.accounts.changePassword("not the password", "a new long password"), "wrong_password", "current");
        expectError(() => services.accounts.changePassword(PASSWORD, "short"), "validation", "password");
        services.accounts.changePassword(PASSWORD, "a new long password", mine);
        expect(services.accounts.resumeSession(mine)).toBeDefined();
        expect(services.accounts.resumeSession(other)).toBeUndefined();
        expect(services.accounts.verify("owner@example.com", "a new long password")).toBe(true);
        expect(services.accounts.verify("owner@example.com", PASSWORD)).toBe(false);
      });

      it("sets a password from the command line, ending every session", () => {
        const token = services.accounts.startSession().token;
        services.accounts.setPassword("recovered password!");
        expect(services.accounts.resumeSession(token)).toBeUndefined();
        expect(services.accounts.verify("owner@example.com", "recovered password!")).toBe(true);
      });
    });

    it("creates the account from the command line when there is none", () => {
      expectError(() => services.accounts.setPassword("recovered password!"), "validation", "email");
      services.accounts.setPassword("recovered password!", "owner@example.com");
      expect(services.accounts.account()).toMatchObject({ email: "owner@example.com" });
    });

    describe("agent tokens", () => {
      it("registers an agent with a token shown once, and authenticates it by name", () => {
        const { token, agent } = services.agentTokens.register(" claude ");
        expect(token).toMatch(/^ntm_[A-Za-z0-9_-]{43}$/);
        expect(agent).toMatchObject({ name: "claude", prefix: token.slice(0, 8), lastUsedAt: null });
        expect(services.agentTokens.authenticate(token)).toBe("claude");
        expect(services.agentTokens.list()).toEqual([expect.objectContaining({ name: "claude", lastUsedAt: clock })]);
        expect(services.agentTokens.authenticate("ntm_unknown")).toBeUndefined();
        expect(services.agentTokens.authenticate("secret-token")).toBeUndefined();
      });

      it("refuses a bad or taken name", () => {
        services.agentTokens.register("claude");
        expectError(() => services.agentTokens.register("claude"), "exists", "name");
        expectError(() => services.agentTokens.register("two words"), "validation", "name");
        expectError(() => services.agentTokens.register(""), "validation", "name");
      });

      it("records use at most once a minute", () => {
        const { token } = services.agentTokens.register("claude");
        services.agentTokens.authenticate(token);
        at("2026-11-01T08:00:30.000Z");
        services.agentTokens.authenticate(token);
        expect(services.agentTokens.list()[0]!.lastUsedAt).toBe("2026-11-01T08:00:00.000Z");
        at("2026-11-01T08:01:00.000Z");
        services.agentTokens.authenticate(token);
        expect(services.agentTokens.list()[0]!.lastUsedAt).toBe("2026-11-01T08:01:00.000Z");
      });

      it("keeps no copy of a token without a SECRET_KEY", () => {
        const { agent } = services.agentTokens.register("claude");
        expect(agent.kept).toBe(false);
        expectError(() => services.agentTokens.reveal(agent.id), "unavailable");
      });

      it("revokes at once, freeing the name", () => {
        const first = services.agentTokens.register("builder");
        services.agentTokens.revoke(first.agent.id);
        expect(services.agentTokens.authenticate(first.token)).toBeUndefined();
        expect(services.agentTokens.list()).toEqual([]);
        const second = services.agentTokens.register("builder");
        expect(services.agentTokens.authenticate(second.token)).toBe("builder");
        services.agentTokens.revokeByName("builder");
        expect(services.agentTokens.authenticate(second.token)).toBeUndefined();
        expectError(() => services.agentTokens.revoke(first.agent.id), "not_found");
      });
    });
  });

  describe(`${name}: agent tokens kept under SECRET_KEY`, () => {
    const KEY = "k".repeat(32);

    it("keeps the token encrypted, shows it again, and only with the same key", () => {
      const db = factory({ secretKey: KEY });
      const { token, agent } = db.agentTokens.register("claude");
      expect(agent.kept).toBe(true);
      expect(db.agentTokens.list()[0]!.kept).toBe(true);
      expect(db.agentTokens.reveal(agent.id)).toBe(token);
      expect(db.agentTokens.revealByName("claude")).toBe(token);
      db.agentTokens.revoke(agent.id);
      expectError(() => db.agentTokens.reveal(agent.id), "not_found");
    });

    it("refuses a short key", () => {
      expect(() => factory({ secretKey: "too short" })).toThrow(/SECRET_KEY must be at least 32 characters/);
    });
  });
}
