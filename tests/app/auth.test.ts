import { beforeEach, describe, expect, it } from "vitest";

import { appPath, gate, routeAccess, safeNext, sessionCookie, sessionToken, SignInThrottle } from "../../app/lib/auth.server";
import { type AppServices, createInMemoryServices } from "~/composition";

describe("signing in is required", () => {
  let services: AppServices;
  let clock: string;
  const request = (path: string, init: RequestInit & { cookie?: string } = {}) =>
    new Request(`http://app${path}`, {
      ...init,
      headers: { ...(init.cookie ? { cookie: init.cookie } : {}), ...(init.headers as Record<string, string>) },
    });

  beforeEach(() => {
    clock = "2026-11-01T08:00:00.000Z";
    services = createInMemoryServices({ now: () => clock });
  });

  it("classifies paths, without the single-fetch suffix", () => {
    expect(appPath(new URL("http://app/tasks/abc.data"))).toBe("/tasks/abc");
    expect(appPath(new URL("http://app/_root.data"))).toBe("/");
    expect(routeAccess("/setup")).toBe("setup");
    expect(routeAccess("/login")).toBe("login");
    expect(routeAccess("/api/agent/projects")).toBe("agent");
    expect(routeAccess("/api/edits")).toBe("api");
    expect(routeAccess("/content/abc")).toBe("api");
    expect(routeAccess("/projects/p")).toBe("screen");
  });

  it("sends everything to setup while there's no account, and closes setup afterwards", () => {
    expect(gate(services, request("/projects/p"))).toEqual({ pass: false, redirect: "/setup" });
    expect(gate(services, request("/setup"))).toEqual({ pass: true });
    services.accounts.createOwner("owner@example.com", "correct horse battery");
    expect(gate(services, request("/setup"))).toEqual({ pass: false, redirect: "/login" });
  });

  it("sends screens to sign in, remembering where, and answers APIs and content with 401", async () => {
    services.accounts.createOwner("owner@example.com", "correct horse battery");
    expect(gate(services, request("/tasks/7a4ba67a?tab=findings"))).toEqual({
      pass: false,
      redirect: "/login?next=%2Ftasks%2F7a4ba67a%3Ftab%3Dfindings",
    });
    expect(gate(services, request("/tasks/7a4ba67a.data?_routes=root"))).toEqual({
      pass: false,
      redirect: "/login?next=%2Ftasks%2F7a4ba67a",
    });
    for (const path of ["/api/edits", "/content/abc"]) {
      const decision = gate(services, request(path, { method: "POST" }));
      expect(decision.pass).toBe(false);
      expect("response" in decision && decision.response.status).toBe(401);
    }
    expect(gate(services, request("/login"))).toEqual({ pass: true });
    expect(gate(services, request("/api/agent/projects"))).toEqual({ pass: true });
  });

  it("lets a session through, sending its cookie again when renewed", () => {
    services.accounts.createOwner("owner@example.com", "correct horse battery");
    const { token } = services.accounts.startSession();
    const cookie = `theme=dark; ntm_session=${token}`;
    expect(gate(services, request("/", { cookie }))).toEqual({ pass: true, signedIn: { email: "owner@example.com" } });
    clock = "2026-11-03T08:00:00.000Z";
    const renewed = gate(services, request("/", { cookie }));
    expect(renewed).toMatchObject({ pass: true, setCookie: expect.stringContaining("Max-Age=2592000") });
    expect(gate(services, request("/projects/p", { cookie: "ntm_session=stolen" }))).toMatchObject({ pass: false });
  });

  it("refuses a cross-site POST to the app's API", () => {
    services.accounts.createOwner("owner@example.com", "correct horse battery");
    const cookie = `ntm_session=${services.accounts.startSession().token}`;
    const cross = gate(services, request("/api/edits", { method: "POST", cookie, headers: { origin: "https://evil.example" } }));
    expect("response" in cross && cross.response.status).toBe(403);
    expect(gate(services, request("/api/edits", { method: "POST", cookie, headers: { origin: "http://app" } }))).toMatchObject({
      pass: true,
    });
  });

  it("writes and reads the cookie", () => {
    const set = sessionCookie(new Request("https://app/login"), "abc");
    expect(set).toBe("ntm_session=abc; Path=/; Max-Age=2592000; HttpOnly; SameSite=Lax; Secure");
    expect(sessionCookie(new Request("http://app/login"), "abc")).not.toContain("Secure");
    expect(sessionToken("a=1; ntm_session=xyz; b=2")).toBe("xyz");
    expect(sessionToken(null)).toBeUndefined();
  });

  it("only goes back to paths within the app", () => {
    expect(safeNext("/tasks/x?tab=findings")).toBe("/tasks/x?tab=findings");
    for (const bad of ["https://example.com/", "//example.com", "/\\example.com", "", null, "/login", "/logout?x"]) {
      expect(safeNext(bad)).toBe("/");
    }
  });

  it("slows down from the fifth wrong password in 15 minutes", () => {
    let now = 0;
    const throttle = new SignInThrottle(() => now);
    for (let i = 0; i < 4; i++) throttle.failed();
    expect(throttle.delay()).toBe(0);
    throttle.failed();
    expect(throttle.delay()).toBe(1000);
    throttle.failed();
    expect(throttle.delay()).toBe(2000);
    for (let i = 0; i < 10; i++) throttle.failed();
    expect(throttle.delay()).toBe(60_000);
    now = 16 * 60 * 1000;
    expect(throttle.delay()).toBe(0);
    throttle.failed();
    throttle.succeeded();
    expect(throttle.delay()).toBe(0);
  });
});
