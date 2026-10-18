import { redirect } from "react-router";

import { createProjectAction } from "../lib/projects.server";
import { services } from "../lib/services.server";
import { createWorkspacePageAction } from "../lib/workspace-pages.server";
import type { Route } from "./+types/create";

/**
 * Creates a project, or (`intent=create-page`) a workspace page, and opens it.
 * The new-project and new-page dialogs post here from anywhere in the app.
 */
export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  if (form.get("intent") === "create-page") {
    const result = createWorkspacePageAction(services, form);
    return result.ok ? redirect(`/pages/${result.id}`) : result;
  }
  const result = createProjectAction(services, form);
  return result.ok ? redirect(`/projects/${result.id}`) : result;
}
