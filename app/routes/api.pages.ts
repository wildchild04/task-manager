import { pageDeletion } from "../lib/page-edit.server";
import { allPages, allTasks, searchPages } from "../lib/page-search.server";
import { services } from "../lib/services.server";
import type { Route } from "./+types/api.pages";

/**
 * Pages and tasks matching `?q=`, or the one with link `?href=` (or page `?id=`), for mentions and links:
 * `{ pages: [{ id, title, place, href }] }`.
 * `?deletion=` describes deleting a page instead: `{ deletion: { title, nestedPages, … } | null }`.
 */
export function loader({ request }: Route.LoaderArgs) {
  const params = new URL(request.url).searchParams;
  const deletion = params.get("deletion");
  if (deletion) return Response.json({ deletion: pageDeletion(services, deletion) ?? null });
  const href = params.get("href");
  if (href) return Response.json({ pages: [...allPages(services), ...allTasks(services)].filter((page) => page.href === href) });
  const id = params.get("id");
  if (id) return Response.json({ pages: allPages(services).filter((page) => page.id === id) });
  return Response.json({ pages: searchPages(services, params.get("q") ?? "") });
}
