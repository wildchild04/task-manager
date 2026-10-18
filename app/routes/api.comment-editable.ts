import { data } from "react-router";

import { editablePage } from "../lib/page-edit.server";
import { services } from "../lib/services.server";
import type { Route } from "./+types/api.comment-editable";

/** A comment's content as the editor starts from it, loaded when the comment is opened for editing. */
export function loader({ params }: Route.LoaderArgs) {
  const editable = editablePage(services, "comment", params.commentId);
  if (!editable) throw data(null, { status: 404 });
  return Response.json(editable);
}
