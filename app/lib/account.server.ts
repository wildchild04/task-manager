import type { AppServices } from "~/composition";
import { AccountError } from "~/domain/accounts/errors";

import {
  clearedSessionCookie,
  safeNext,
  sessionCookie,
  sessionToken,
  type SignInThrottle,
} from "./auth.server";
import { formatDateTime } from "./format";
import { type FieldErrors, formValues } from "./forms.server";
import { relativeTime } from "./home.server";

/** A form's outcome: errors next to fields (or for the whole form), and the values to show again (never passwords). */
export type FormResult = {
  ok: false;
  fieldErrors: FieldErrors;
  formError?: string;
  values: Record<string, string>;
};

const PASSWORD_FIELDS = ["password", "confirm", "current"];
const keep = (values: Record<string, string>) =>
  Object.fromEntries(
    Object.entries(values).filter(([key]) => !PASSWORD_FIELDS.includes(key)),
  );
const invalid = (
  values: Record<string, string>,
  fieldErrors: FieldErrors,
  formError?: string,
): FormResult => ({
  ok: false,
  fieldErrors,
  values: keep(values),
  ...(formError ? { formError } : {}),
});

/** An `AccountError` as a form error on its field. */
function accountError(
  error: unknown,
  values: Record<string, string>,
): FormResult {
  if (!(error instanceof AccountError)) throw error;
  return error.field
    ? invalid(values, { [error.field]: error.message })
    : invalid(values, {}, error.message);
}

/** Passwords are read untrimmed: spaces are part of them. */
const raw = (form: FormData, name: string) => {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
};

/** Where to go, with the session cookie set. */
export type SignedInResult = { redirectTo: string; setCookie: string };

/** Creates the owner's account from `/setup` and signs in. */
export function setupAction(
  services: AppServices,
  request: Request,
  form: FormData,
): FormResult | SignedInResult {
  const values = formValues(form);
  const password = raw(form, "password");
  if (password !== raw(form, "confirm"))
    return invalid(values, { confirm: "The passwords don't match" });
  try {
    services.accounts.createOwner(values.email ?? "", password);
  } catch (error) {
    return accountError(error, values);
  }
  const { token } = services.accounts.startSession();
  return { redirectTo: "/", setCookie: sessionCookie(request, token) };
}

/** Signs in from `/login`, after the throttle's delay, going back to `next`. */
export async function loginAction(
  services: AppServices,
  request: Request,
  form: FormData,
  throttle: SignInThrottle,
  wait: (ms: number) => Promise<void> = (ms) =>
    new Promise((resolve) => setTimeout(resolve, ms)),
): Promise<FormResult | SignedInResult> {
  const values = formValues(form);
  const delay = throttle.delay();
  if (delay > 0) await wait(delay);
  if (!services.accounts.verify(values.email ?? "", raw(form, "password"))) {
    throttle.failed();
    return invalid(values, {}, "Wrong email or password");
  }
  throttle.succeeded();
  const { token } = services.accounts.startSession();
  return {
    redirectTo: safeNext(new URL(request.url).searchParams.get("next")),
    setCookie: sessionCookie(request, token),
  };
}

/** Ends this browser's session. */
export function logoutAction(
  services: AppServices,
  request: Request,
): { setCookie: string } {
  const token = sessionToken(request.headers.get("cookie"));
  if (token) services.accounts.endSession(token);
  return { setCookie: clearedSessionCookie(request) };
}

// ----- Settings -----

/** A registered agent as Settings lists it: when it was registered and last used, in words. */
export type AgentRow = {
  id: string;
  name: string;
  prefix: string;
  registered: string;
  lastUsed: string;
  /** Whether its token was kept, so it can be shown again. */
  kept: boolean;
};

/** `keepsTokens`: whether newly registered tokens are kept (encrypted), so they can be shown again. */
export type SettingsView = { email: string; agents: AgentRow[]; keepsTokens: boolean };

export function settingsView(
  services: AppServices,
  now: string = new Date().toISOString(),
): SettingsView {
  const { timeZone } = services.tasks;
  return {
    email: services.accounts.account()?.email ?? "",
    keepsTokens: services.agentTokens.keepsTokens,
    agents: services.agentTokens.list().map((agent) => ({
      id: agent.id,
      name: agent.name,
      prefix: agent.prefix,
      registered: formatDateTime(agent.createdAt, timeZone),
      lastUsed: agent.lastUsedAt
        ? `used ${relativeTime(agent.lastUsedAt, now, timeZone)}`
        : "never used",
      kept: agent.kept,
    })),
  };
}

/** What a settings form did: a message, an agent's token (just registered, or shown again), or errors. */
export type SettingsResult =
  | { ok: true; intent: string; message: string; token?: string; name?: string }
  | (FormResult & { intent: string });

/** Changes the password, registers an agent or revokes one: what the settings page's forms send. */
export function settingsAction(
  services: AppServices,
  request: Request,
  form: FormData,
): SettingsResult {
  const values = formValues(form);
  const intent = values.intent ?? "";
  const failed = (result: FormResult) => ({ ...result, intent });
  try {
    switch (intent) {
      case "change-password": {
        const password = raw(form, "password");
        if (password !== raw(form, "confirm"))
          return failed(
            invalid(values, { confirm: "The passwords don't match" }),
          );
        services.accounts.changePassword(
          raw(form, "current"),
          password,
          sessionToken(request.headers.get("cookie")),
        );
        return {
          ok: true,
          intent,
          message: "Password changed; other browsers were signed out",
        };
      }
      case "register-agent": {
        const { token, agent } = services.agentTokens.register(
          values.name ?? "",
        );
        return {
          ok: true,
          intent,
          message: `Registered ${agent.name}`,
          token,
          name: agent.name,
        };
      }
      case "revoke-agent": {
        const agent = services.agentTokens
          .list()
          .find((a) => a.id === values.id);
        services.agentTokens.revoke(values.id ?? "");
        return {
          ok: true,
          intent,
          message: `Revoked ${agent?.name ?? "the agent"}'s token`,
        };
      }
      default:
        return failed(invalid(values, {}, "Unknown action"));
    }
  } catch (error) {
    return failed(accountError(error, values));
  }
}

/**
 * Shows a registered agent's token again, once the owner's password is given. Wrong passwords count
 * toward the sign-in throttle, and wait as sign-in does.
 */
export async function revealAgentAction(
  services: AppServices,
  form: FormData,
  throttle: SignInThrottle,
  wait: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
): Promise<SettingsResult> {
  const intent = "reveal-agent";
  const values = formValues(form);
  const delay = throttle.delay();
  if (delay > 0) await wait(delay);
  const email = services.accounts.account()?.email ?? "";
  if (!services.accounts.verify(email, raw(form, "password"))) {
    throttle.failed();
    return { ...invalid(values, { password: "Wrong password" }), intent };
  }
  throttle.succeeded();
  try {
    const agent = services.agentTokens.list().find((a) => a.id === values.id);
    const token = services.agentTokens.reveal(values.id ?? "");
    return { ok: true, intent, message: `${agent?.name ?? "The agent"}'s token`, token, name: agent?.name ?? "" };
  } catch (error) {
    return { ...accountError(error, values), intent };
  }
}
