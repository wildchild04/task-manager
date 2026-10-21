import { uploadContent } from "../lib/content.server";
import { services } from "../lib/services.server";
import type { Route } from "./+types/api.content";

/** Uploads one image: the body is the file's bytes. Answers `201 { id, url, type, size }`, or `413`/`415` with a message. */
export function action({ request }: Route.ActionArgs) {
  return uploadContent(services, request);
}
