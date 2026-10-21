import { serveContent } from "../lib/content.server";
import { services } from "../lib/services.server";
import type { Route } from "./+types/content";

/** A stored image, served with its type and cached for good. */
export function loader({ params }: Route.LoaderArgs) {
  return serveContent(services, params.id);
}
