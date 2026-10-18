import { Alert, Button, Card, InlineCode, ResponsivePanelGrid, Stack, Typography } from "@wildchild/design-system";
import { useState } from "react";
import { redirect, useNavigate } from "react-router";

import { NewProjectDialog } from "../components/new-project-dialog";
import { createProjectAction, projectsHomeView } from "../lib/projects.server";
import { services } from "../lib/services.server";
import { createWorkspacePageAction } from "../lib/workspace-pages.server";
import type { Route } from "./+types/home";

export function meta() {
  return [{ title: "Projects" }];
}

export function loader() {
  return projectsHomeView(services);
}

/** Creates a project, or (`intent=create-page`) a workspace page, and opens it. */
export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  if (form.get("intent") === "create-page") {
    const result = createWorkspacePageAction(services, form);
    return result.ok ? redirect(`/pages/${result.id}`) : result;
  }
  const result = createProjectAction(services, form);
  return result.ok ? redirect(`/projects/${result.id}`) : result;
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();

  return (
    <Stack spacing={3}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="h1">Projects</Typography>
        <Button onClick={() => setCreating(true)}>New project</Button>
      </Stack>

      {loaderData.projects.length === 0 ? (
        <Alert severity="info" role="status" title="No projects yet">
          Create a project to start, or run <InlineCode>npm run db:seed</InlineCode> for a sample project.
        </Alert>
      ) : (
        <ResponsivePanelGrid columns={{ xs: 1, sm: 2, lg: 3 }}>
          {loaderData.projects.map((project) => (
            <Card
              key={project.id}
              title={project.title}
              variant="outlined"
              interactive
              hoverFeedback="tint"
              onClick={() => void navigate(`/projects/${project.id}`)}
            />
          ))}
        </ResponsivePanelGrid>
      )}

      <NewProjectDialog open={creating} onClose={() => setCreating(false)} />
    </Stack>
  );
}
