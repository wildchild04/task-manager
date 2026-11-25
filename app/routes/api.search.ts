import { globalSearch } from "../lib/page-search.server";
import { services } from "../lib/services.server";
import type { Route } from "./+types/api.search";

export function loader({ request }: Route.LoaderArgs) {
  return Response.json({ results: globalSearch(services, new URL(request.url).searchParams.get("q") ?? "") });
}
