import { ResponsivePanelGrid, Stack, Typography } from "@wildchild/design-system";
import { useState } from "react";
import { data, redirect } from "react-router";

import { Blocks } from "../blocks/block-view";
import { MentionTargetsContext } from "../blocks/rich-text";
import { DashboardCard } from "../components/dashboard-card";
import { DeleteProjectButton } from "../components/delete-project";
import { NotFound } from "../components/not-found";
import { PageEditor } from "../editor/page-editor";
import { editablePage } from "../lib/page-edit.server";
import { useHydrated } from "../lib/use-hydrated";
import { projectDeletion, projectHomeView } from "../lib/projects.server";
import { services } from "../lib/services.server";
import type { Route } from "./+types/project-home";

export function loader({ params }: Route.LoaderArgs) {
  const view = projectHomeView(services, params.projectId);
  return view
    ? {
        view,
        editable: editablePage(services, "project", params.projectId) ?? null,
        deletion: projectDeletion(services, params.projectId)!,
      }
    : data({ view: null, editable: null, deletion: null }, { status: 404 });
}

/** Deletes the project (`intent=delete-project`) with everything in it, and goes home. */
export async function action({ params, request }: Route.ActionArgs) {
  const form = await request.formData();
  if (form.get("intent") !== "delete-project" || !services.projects.get(params.projectId)) throw data(null, { status: 404 });
  services.projects.delete(params.projectId);
  return redirect("/");
}

export function meta({ data }: Route.MetaArgs) {
  return [{ title: data?.view?.project.title ?? "Not found" }];
}

export default function ProjectHome({ loaderData }: Route.ComponentProps) {
  const { view, editable, deletion } = loaderData;
  const hydrated = useHydrated();
  const [statusSlot, setStatusSlot] = useState<HTMLElement | null>(null);
  if (!view) return <NotFound />;

  return (
    <Stack spacing={3}>
      <Stack direction="row" justifyContent="space-between" alignItems="baseline">
        <Typography variant="h1">{view.project.title}</Typography>
        <Stack direction="row" alignItems="center" spacing={1}>
          <span ref={setStatusSlot} />
          {deletion && <DeleteProjectButton deletion={deletion} />}
        </Stack>
      </Stack>
      {/* The home page's content is edited in place; the server renders it read-only. */}
      {hydrated && editable ? (
        <PageEditor key={editable.id} page={editable} statusSlot={statusSlot} />
      ) : (
        view.home &&
        view.home.blocks.length > 0 && (
          <article>
            <MentionTargetsContext.Provider value={view.home.mentions}>
              <Blocks blocks={view.home.blocks} />
            </MentionTargetsContext.Provider>
          </article>
        )
      )}
      <ResponsivePanelGrid columns={{ xs: 1, md: 2, xl: 3 }}>
        {view.dashboard.map((card) => (
          <DashboardCard key={card.id} card={card} />
        ))}
      </ResponsivePanelGrid>
    </Stack>
  );
}
