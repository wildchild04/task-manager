import { Link, Typography } from "@wildchild/design-system";
import { data, Link as RouterLink } from "react-router";

import { Blocks } from "../blocks/block-view";
import { RichText } from "../blocks/rich-text";
import { plainText } from "../blocks/view-model";
import { NotFound } from "../components/not-found";
import { buildPageView } from "../lib/page-view.server";
import { services } from "../lib/services.server";
import type { Route } from "./+types/page";

export function loader({ params }: Route.LoaderArgs) {
  const page = buildPageView(services.blocks, params.pageId);
  if (!page) return data({ page: null, project: null }, { status: 404 });
  const project = page.projectId ? services.projects.get(page.projectId) : undefined;
  return { page, project: project ? { id: project.id, title: project.title || "Untitled" } : null };
}

export function meta({ data }: Route.MetaArgs) {
  return [{ title: data?.page ? plainText(data.page.title) || "Untitled" : "Not found" }];
}

export default function Page({ loaderData }: Route.ComponentProps) {
  const { page, project } = loaderData;
  if (!page) return <NotFound />;

  return (
    <article>
      {project && (
        <Link component={RouterLink} to={`/projects/${project.id}`} variant="standalone">
          ← {project.title}
        </Link>
      )}
      <Typography variant="h1" gutterBottom>
        {page.title.length > 0 ? <RichText value={page.title} /> : "Untitled"}
      </Typography>
      <Blocks blocks={page.blocks} />
    </article>
  );
}
