import { ResponsivePanelGrid, Stack, Typography } from "@wildchild/design-system";
import { useState } from "react";
import { data } from "react-router";

import { Blocks } from "../blocks/block-view";
import { MentionTargetsContext } from "../blocks/rich-text";
import { DashboardCard } from "../components/dashboard-card";
import { NotFound } from "../components/not-found";
import { PageEditor } from "../editor/page-editor";
import { editablePage } from "../lib/page-edit.server";
import { useHydrated } from "../lib/use-hydrated";
import { projectHomeView } from "../lib/projects.server";
import { services } from "../lib/services.server";
import type { Route } from "./+types/project-home";

export function loader({ params }: Route.LoaderArgs) {
  const view = projectHomeView(services, params.projectId);
  return view
    ? { view, editable: editablePage(services, "project", params.projectId) ?? null }
    : data({ view: null, editable: null }, { status: 404 });
}

export function meta({ data }: Route.MetaArgs) {
  return [{ title: data?.view?.project.title ?? "Not found" }];
}

export default function ProjectHome({ loaderData }: Route.ComponentProps) {
  const { view, editable } = loaderData;
  const hydrated = useHydrated();
  const [statusSlot, setStatusSlot] = useState<HTMLElement | null>(null);
  if (!view) return <NotFound />;

  return (
    <Stack spacing={3}>
      <Stack direction="row" justifyContent="space-between" alignItems="baseline">
        <Typography variant="h1">{view.project.title}</Typography>
        <span ref={setStatusSlot} />
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
