import { ResponsivePanelGrid, Stack, Typography } from "@wildchild/design-system";
import { data } from "react-router";

import { Blocks } from "../blocks/block-view";
import { DashboardCard } from "../components/dashboard-card";
import { NotFound } from "../components/not-found";
import { projectHomeView } from "../lib/projects.server";
import { services } from "../lib/services.server";
import type { Route } from "./+types/project-home";

export function loader({ params }: Route.LoaderArgs) {
  const view = projectHomeView(services, params.projectId);
  return view ? { view } : data({ view: null }, { status: 404 });
}

export function meta({ data }: Route.MetaArgs) {
  return [{ title: data?.view?.project.title ?? "Not found" }];
}

export default function ProjectHome({ loaderData }: Route.ComponentProps) {
  const { view } = loaderData;
  if (!view) return <NotFound />;

  return (
    <Stack spacing={3}>
      <Typography variant="h1">{view.project.title}</Typography>
      {view.home && view.home.blocks.length > 0 && (
        <article>
          <Blocks blocks={view.home.blocks} />
        </article>
      )}
      <ResponsivePanelGrid columns={{ xs: 1, md: 2, xl: 3 }}>
        {view.dashboard.map((card) => (
          <DashboardCard key={card.id} card={card} />
        ))}
      </ResponsivePanelGrid>
    </Stack>
  );
}
