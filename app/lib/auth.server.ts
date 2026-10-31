import type { AppServices } from "~/composition";
import { SESSION_DAYS } from "~/domain/accounts/account.service";

import { BASE_PATH, withoutBase } from "./base-path";

export const SESSION_COOKIE = "ntm_session";

/** Who is signed in, for the shell's account menu. */
export type SignedIn = { email: string };

/**
 * What a request needs: `open` for the sign-in screens, `agent` for the agent
 * API (it checks its own tokens), `api` for other resource routes and stored
 * content (answered 401), `screen` for everything else (sent to sign in).
 */
export type RouteAccess = "setup" | "login" | "agent" | "api" | "screen";

/** An app path without the base and a single-fetch `.data` suffix: `/tasks/x.data` → `/tasks/x`. */
export function appPath(url: URL): string {
  const path = withoutBase(url.pathname).replace(/\.data$/, "");
  return path === "/_root" ? "/" : path || "/";
}

export function routeAccess(path: string): RouteAccess {
  if (path === "/setup") return "setup";
  if (path === "/login") return "login";
  if (path === "/api/agent" || path.startsWith("/api/agent/")) return "agent";
  if (path.startsWith("/api/") || path.startsWith("/content/")) return "api";
  return "screen";
}

/** The session token from a `Cookie` header. */
export function sessionToken(cookieHeader: string | null): string | undefined {
  for (const part of (cookieHeader ?? "").split(";")) {
    const [name, ...value] = part.trim().split("=");
    if (name === SESSION_COOKIE) return decodeURIComponent(value.join("=")) || undefined;
  }
  return undefined;
}

const cookiePath = () => `${BASE_PATH}/`;
const secure = (request: Request) => (new URL(request.url).protocol === "https:" ? "; Secure" : "");

/** Sets the session cookie for as long as a session lasts: it starts or is renewed for that long. */
export function sessionCookie(request: Request, token: string): string {
  const maxAge = SESSION_DAYS * 24 * 60 * 60;
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=${cookiePath()}; Max-Age=${maxAge}; HttpOnly; SameSite=Lax${secure(request)}`;
}

/** Clears the session cookie. */
export function clearedSessionCookie(request: Request): string {
  return `${SESSION_COOKIE}=; Path=${cookiePath()}; Max-Age=0; HttpOnly; SameSite=Lax${secure(request)}`;
}

/** Where to go after signing in: a path within the app, never another site; home otherwise. */
export function safeNext(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/";
  const path = next.split(/[?#]/)[0]!;
  return path === "/login" || path === "/setup" || path === "/logout" ? "/" : next;
}

/**
 * What the gate decided: let it through (with who is signed in, and a renewed cookie to send), send the
 * browser to an app path (`redirect`, which the router turns into a redirect for pages and their data), or
 * answer now.
 */
export type GateDecision =
  | { pass: true; signedIn?: SignedIn; setCookie?: string }
  | { pass: false; redirect: string }
  | { pass: false; response: Response };

const redirectTo = (redirect: string) => ({ pass: false as const, redirect });
const unauthorized = () =>
  Response.json({ ok: false, error: { code: "unauthorized", message: "Sign in first" } }, { status: 401 });

/**
 * Decides whether a request may go on: everything needs a session except the
 * sign-in screens and the agent API; while there's no account, everything
 * goes to `/setup`. A POST from another site to the app's own API is refused.
 */
export function gate(services: AppServices, request: Request): GateDecision {
  const url = new URL(request.url);
  const path = appPath(url);
  const access = routeAccess(path);
  if (access === "agent") return { pass: true };

  const hasAccount = services.accounts.hasAccount();
  if (access === "setup") return hasAccount ? redirectTo("/login") : { pass: true };
  if (!hasAccount) return access === "api" ? { pass: false, response: unauthorized() } : redirectTo("/setup");

  const token = sessionToken(request.headers.get("cookie"));
  const session = token ? services.accounts.resumeSession(token) : undefined;
  if (access === "login") return { pass: true, ...(session ? { signedIn: { email: session.email } } : {}) };
  if (!session) {
    if (access === "api") return { pass: false, response: unauthorized() };
    const next = path + url.search.replace(/[?&]_routes=[^&]*/, "").replace(/^&/, "?");
    return redirectTo(`/login?next=${encodeURIComponent(next)}`);
  }

  const origin = request.headers.get("origin");
  if (access === "api" && request.method !== "GET" && origin && origin !== url.origin) {
    return { pass: false, response: Response.json({ ok: false, message: "Cross-site request refused" }, { status: 403 }) };
  }
  return {
    pass: true,
    signedIn: { email: session.email },
    ...(session.renewed ? { setCookie: sessionCookie(request, token!) } : {}),
  };
}

/**
 * Slows down guessing: from the fifth wrong password within 15 minutes, each
 * further attempt waits twice as long as the one before (1 s, 2 s … 60 s at
 * most) before it's checked. One account, so one count for the whole app.
 */
export class SignInThrottle {
  private failures: number[] = [];

  constructor(private readonly now: () => number = Date.now) {}

  /** How long to wait before checking this attempt, in milliseconds. */
  delay(): number {
    const since = this.now() - 15 * 60 * 1000;
    this.failures = this.failures.filter((at) => at > since);
    const extra = this.failures.length - 4;
    return extra <= 0 ? 0 : Math.min(60_000, 1000 * 2 ** (extra - 1));
  }

  failed(): void {
    this.failures.push(this.now());
  }

  succeeded(): void {
    this.failures = [];
  }
}

export const signInThrottle = new SignInThrottle();
