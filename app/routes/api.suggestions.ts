import { decideSuggestion } from "../lib/suggestions.server";
import { services } from "../lib/services.server";
import type { Route } from "./+types/api.suggestions";

/**
 * Approves or rejects suggestions: `{ intent, id }` or `{ intent: "approve-all" | "reject-all", pageId }` as JSON.
 * A resource route, so the editor keeps its state and reloads the page itself.
 */
export async function action({ request }: Route.ActionArgs) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, message: "The decision couldn't be read" }, { status: 400 });
  }
  const result = decideSuggestion(services, body);
  return Response.json(result, { status: result.ok ? 200 : 422 });
}
