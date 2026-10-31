import { beforeEach, describe, expect, it } from "vitest";

import {
  loginAction,
  logoutAction,
  settingsAction,
  settingsView,
  setupAction,
} from "../../app/lib/account.server";
import { gate, SignInThrottle } from "../../app/lib/auth.server";
import { type AppServices, createInMemoryServices } from "~/composition";

const PASSWORD = "correct horse battery";
const form = (values: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
};
const cookieOf = (setCookie: string) => setCookie.split(";")[0]!;

describe("account screens", () => {
  let services: AppServices;

  beforeEach(() => {
    services = createInMemoryServices({
      now: () => "2026-11-01T08:00:00.000Z",
      timeZone: "UTC",
    });
  });

  it("creates the account from setup, signing in, and never echoes passwords", () => {
    const mismatch = setupAction(
      services,
      new Request("http://app/setup"),
      form({ email: "o@example.com", password: PASSWORD, confirm: "x" }),
    );
    expect(mismatch).toEqual({
      ok: false,
      fieldErrors: { confirm: "The passwords don't match" },
      values: { email: "o@example.com" },
    });
    const short = setupAction(
      services,
      new Request("http://app/setup"),
      form({ email: "o@example.com", password: "short", confirm: "short" }),
    );
    expect(short).toMatchObject({
      fieldErrors: { password: "The password needs at least 12 characters" },
    });

    const done = setupAction(
      services,
      new Request("http://app/setup"),
      form({ email: "O@Example.com", password: PASSWORD, confirm: PASSWORD }),
    );
    expect(done).toMatchObject({
      redirectTo: "/",
      setCookie: expect.stringMatching(
        /^ntm_session=.+; Path=\/; Max-Age=2592000; HttpOnly; SameSite=Lax$/,
      ),
    });
    const cookie = cookieOf((done as { setCookie: string }).setCookie);
    expect(
      gate(services, new Request("http://app/", { headers: { cookie } })),
    ).toMatchObject({ pass: true, signedIn: { email: "o@example.com" } });
  });

  describe("signed up", () => {
    beforeEach(() =>
      services.accounts.createOwner("owner@example.com", PASSWORD),
    );
    const noWait = async () => {};

    it("signs in, going back where it was sent from", async () => {
      const throttle = new SignInThrottle();
      const wrong = await loginAction(
        services,
        new Request("http://app/login"),
        form({ email: "owner@example.com", password: "nope" }),
        throttle,
        noWait,
      );
      expect(wrong).toEqual({
        ok: false,
        fieldErrors: {},
        formError: "Wrong email or password",
        values: { email: "owner@example.com" },
      });
      const right = await loginAction(
        services,
        new Request("http://app/login?next=%2Ftasks%2F7a4ba67a"),
        form({ email: "OWNER@example.com", password: PASSWORD }),
        throttle,
        noWait,
      );
      expect(right).toMatchObject({ redirectTo: "/tasks/7a4ba67a" });
      const elsewhere = await loginAction(
        services,
        new Request("http://app/login?next=https%3A%2F%2Fexample.com%2F"),
        form({ email: "owner@example.com", password: PASSWORD }),
        throttle,
        noWait,
      );
      expect(elsewhere).toMatchObject({ redirectTo: "/" });
    });

    it("waits before checking once the wrong passwords pile up", async () => {
      const throttle = new SignInThrottle(() => 0);
      const waited: number[] = [];
      const wait = async (ms: number) => void waited.push(ms);
      for (let i = 0; i < 6; i++) {
        await loginAction(
          services,
          new Request("http://app/login"),
          form({ email: "owner@example.com", password: "nope" }),
          throttle,
          wait,
        );
      }
      expect(waited).toEqual([1000]);
    });

    it("signs out, so the cookie no longer works", async () => {
      const { setCookie } = (await loginAction(
        services,
        new Request("http://app/login"),
        form({ email: "owner@example.com", password: PASSWORD }),
        new SignInThrottle(),
        noWait,
      )) as { setCookie: string };
      const cookie = cookieOf(setCookie);
      expect(
        logoutAction(
          services,
          new Request("http://app/logout", {
            method: "POST",
            headers: { cookie },
          }),
        ).setCookie,
      ).toContain("Max-Age=0");
      expect(
        gate(services, new Request("http://app/", { headers: { cookie } }))
          .pass,
      ).toBe(false);
    });

    it("changes the password, signing out the other browsers", () => {
      const mine = `ntm_session=${services.accounts.startSession().token}`;
      const other = `ntm_session=${services.accounts.startSession().token}`;
      const request = new Request("http://app/settings", {
        method: "POST",
        headers: { cookie: mine },
      });
      expect(
        settingsAction(
          services,
          request,
          form({
            intent: "change-password",
            current: "nope",
            password: "a new long password",
            confirm: "a new long password",
          }),
        ),
      ).toMatchObject({
        ok: false,
        intent: "change-password",
        fieldErrors: { current: "That isn't the current password" },
      });
      expect(
        settingsAction(
          services,
          request,
          form({
            intent: "change-password",
            current: PASSWORD,
            password: "a new long password",
            confirm: "a new long password",
          }),
        ),
      ).toMatchObject({
        ok: true,
        message: "Password changed; other browsers were signed out",
      });
      expect(
        gate(
          services,
          new Request("http://app/", { headers: { cookie: mine } }),
        ).pass,
      ).toBe(true);
      expect(
        gate(
          services,
          new Request("http://app/", { headers: { cookie: other } }),
        ).pass,
      ).toBe(false);
    });

    it("registers an agent, showing its token once, lists it and revokes it", () => {
      const request = new Request("http://app/settings", { method: "POST" });
      const registered = settingsAction(
        services,
        request,
        form({ intent: "register-agent", name: "claude" }),
      );
      expect(registered).toMatchObject({
        ok: true,
        name: "claude",
        token: expect.stringMatching(/^ntm_/),
      });
      expect(
        settingsAction(
          services,
          request,
          form({ intent: "register-agent", name: "claude" }),
        ),
      ).toMatchObject({
        ok: false,
        fieldErrors: { name: '"claude" already has a token' },
      });
      const view = settingsView(services, "2026-11-01T08:00:00.000Z");
      expect(view).toEqual({
        email: "owner@example.com",
        agents: [
          {
            id: expect.any(String),
            name: "claude",
            prefix: (registered as { token: string }).token.slice(0, 8),
            registered: "1 Nov 2026, 08:00",
            lastUsed: "never used",
          },
        ],
      });
      expect(
        settingsAction(
          services,
          request,
          form({ intent: "revoke-agent", id: view.agents[0]!.id }),
        ),
      ).toMatchObject({
        ok: true,
        message: "Revoked claude's token",
      });
      expect(
        services.agentTokens.authenticate(
          (registered as { token: string }).token,
        ),
      ).toBeUndefined();
    });
  });
});
