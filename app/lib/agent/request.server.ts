import { timingSafeEqual } from "node:crypto";

import type { AppServices } from "~/composition";

import * as api from "./functions.server";
import type { AgentActor } from "./functions.server";
import { AgentError } from "./support.server";

type Handler = (services: AppServices, actor: AgentActor, params: Record<string, string>, input: unknown) => unknown;

/** Every agent function, by method and path pattern (`:id` is a segment). */
const ROUTES: { method: "GET" | "POST"; path: string; handler: Handler }[] = [
  { method: "GET", path: "projects", handler: (s) => api.listProjects(s) },
  { method: "GET", path: "tasks", handler: (s, _a, _p, input) => api.listTasks(s, input) },
  { method: "POST", path: "tasks", handler: (s, _a, _p, input) => api.createTask(s, input) },
  { method: "GET", path: "task/:id", handler: (s, a, p) => api.getTask(s, a, p.id!) },
  { method: "GET", path: "task/:id/description", handler: (s, _a, p, input) => api.readDescription(s, p.id!, input) },
  { method: "GET", path: "task/:id/comments", handler: (s, _a, p, input) => api.listComments(s, p.id!, input) },
  { method: "GET", path: "task/:id/references", handler: (s, _a, p, input) => api.listReferences(s, p.id!, input) },
  { method: "POST", path: "task/:id/transition", handler: (s, a, p, input) => api.transition(s, a, p.id!, input) },
  { method: "POST", path: "task/:id/comment", handler: (s, a, p, input) => api.comment(s, a, p.id!, input) },
  { method: "POST", path: "task/:id/description", handler: (s, a, p, input) => api.appendDescription(s, a, p.id!, input) },
  { method: "GET", path: "pages", handler: (s, _a, _p, input) => api.searchPages(s, input) },
  { method: "POST", path: "pages", handler: (s, _a, _p, input) => api.createPage(s, input) },
  { method: "GET", path: "page/:id", handler: (s, _a, p, input) => api.readPage(s, p.id!, input) },
  { method: "POST", path: "suggest", handler: (s, a, _p, input) => api.suggest(s, a, input) },
  { method: "GET", path: "suggestion/:id", handler: (s, _a, p) => api.getSuggestion(s, p.id!) },
  { method: "POST", path: "suggestion/:id/withdraw", handler: (s, a, p) => api.withdrawSuggestion(s, a, p.id!) },
  { method: "POST", path: "suggestion/:id/approve", handler: () => api.resolveSuggestion() },
  { method: "POST", path: "suggestion/:id/reject", handler: () => api.resolveSuggestion() },
];

function match(method: string, path: string) {
  const segments = path.split("/").filter(Boolean);
  for (const route of ROUTES) {
    const pattern = route.path.split("/");
    if (route.method !== method || pattern.length !== segments.length) continue;
    const params: Record<string, string> = {};
    if (
      pattern.every((part, i) =>
        part.startsWith(":") ? ((params[part.slice(1)] = decodeURIComponent(segments[i]!)), true) : part === segments[i],
      )
    ) {
      return { route, params };
    }
  }
  return undefined;
}

const sameSecret = (a: string, b: string) => {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
};

const json = (status: number, body: unknown) => Response.json(body, { status });
const refuse = (status: number, code: string, message: string) => json(status, { error: { code, message } });

/**
 * Answers one agent request: checks the token and the agent's name, then runs
 * the function for `path` (the part after `/api/agent/`) as that agent.
 */
export async function handleAgentRequest(
  services: AppServices,
  request: Request,
  path: string,
  /** The app's `AGENT_TOKEN`; the API is off without one. */
  token: string | undefined,
): Promise<Response> {
  if (!token) return refuse(403, "disabled", "The agent API is off: set AGENT_TOKEN in the app's environment");
  const auth = request.headers.get("authorization") ?? "";
  if (!auth.startsWith("Bearer ") || !sameSecret(auth.slice(7), token))
    return refuse(401, "unauthorized", "Missing or wrong token");
  const name = request.headers.get("x-agent-name")?.trim();
  if (!name) return refuse(400, "bad_request", "Name the agent in the X-Agent-Name header");

  const found = match(request.method, path);
  if (!found) return refuse(404, "not_found", `No agent function ${request.method} ${path}`);

  let input: unknown = Object.fromEntries(new URL(request.url).searchParams);
  if (request.method === "POST") {
    try {
      input = await request.json();
    } catch {
      return refuse(400, "bad_request", "The body must be JSON");
    }
  }
  try {
    return json(200, found.route.handler(services, { kind: "agent", name }, found.params, input));
  } catch (error) {
    if (error instanceof AgentError) return refuse(error.status, error.code, error.message);
    console.error("Agent API error", error);
    return refuse(500, "internal", "Something went wrong");
  }
}
