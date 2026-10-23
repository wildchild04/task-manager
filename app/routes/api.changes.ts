import { changeStream } from "../lib/changes.server";
import { services } from "../lib/services.server";
import type { Route } from "./+types/api.changes";

/** The change event stream that open tabs refresh from (see `live-refresh.ts`). */
export function loader({ request }: Route.LoaderArgs) {
  return changeStream(services.changes, request.signal);
}
