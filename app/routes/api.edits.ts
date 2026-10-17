import { applyEdit } from "../lib/page-edit.server";
import { services } from "../lib/services.server";
import type { Route } from "./+types/api.edits";

/**
 * Saves an editor batch: `{ surface, id, batch }` as JSON. A resource route,
 * so saving never reloads the page being edited. Refusals come back as
 * `{ ok: false, message }` with status 422.
 */
export async function action({ request }: Route.ActionArgs) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, message: "The edit couldn't be read" }, { status: 400 });
  }
  const result = applyEdit(services, body);
  return Response.json(result, { status: result.ok ? 200 : 422 });
}
