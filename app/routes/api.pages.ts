import { searchPages } from "../lib/page-search.server";
import { services } from "../lib/services.server";
import type { Route } from "./+types/api.pages";

/** Pages matching `?q=`, for linking: `{ pages: [{ id, title, place }] }`. */
export function loader({ request }: Route.LoaderArgs) {
  const query = new URL(request.url).searchParams.get("q") ?? "";
  return Response.json({ pages: searchPages(services, query) });
}
