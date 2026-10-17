import { Alert, Button, Card, InlineCode, ResponsivePanelGrid, Stack, TextField, Typography } from "@wildchild/design-system";
import { useState } from "react";
import { redirect, useFetcher, useNavigate } from "react-router";

import { fieldError, FormDialog, lastValue } from "../components/form-dialog";
import type { ActionResult } from "../lib/forms.server";
import { createProjectAction, projectsHomeView } from "../lib/projects.server";
import { services } from "../lib/services.server";
import type { Route } from "./+types/home";

export function meta() {
  return [{ title: "Projects" }];
}

export function loader() {
  return projectsHomeView(services);
}

export async function action({ request }: Route.ActionArgs) {
  const result = createProjectAction(services, await request.formData());
  return result.ok ? redirect(`/projects/${result.id}`) : result;
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const [creating, setCreating] = useState(false);
  const fetcher = useFetcher<ActionResult>();
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

      <FormDialog open={creating} title="New project" confirmLabel="Create" fetcher={fetcher} onClose={() => setCreating(false)}>
        <TextField
          name="title"
          label="Title"
          required
          fullWidth
          defaultValue={lastValue(fetcher.data, "title")}
          {...fieldError(fetcher.data, "title")}
        />
      </FormDialog>
    </Stack>
  );
}
