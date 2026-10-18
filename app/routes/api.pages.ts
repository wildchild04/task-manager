import { allPages, searchPages } from "../lib/page-search.server";
import { services } from "../lib/services.server";
import type { Route } from "./+types/api.pages";

/** Pages matching `?q=`, or the page with `?id=`, for linking: `{ pages: [{ id, title, place }] }`. */
export function loader({ request }: Route.LoaderArgs) {
  const params = new URL(request.url).searchParams;
  const id = params.get("id");
  if (id) return Response.json({ pages: allPages(services).filter((page) => page.id === id) });
  return Response.json({ pages: searchPages(services, params.get("q") ?? "") });
}
