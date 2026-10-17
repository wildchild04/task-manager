import { Breadcrumbs, Stack, Typography } from "@wildchild/design-system";
import { data, Link as RouterLink } from "react-router";

import { Blocks } from "../blocks/block-view";
import { RichText } from "../blocks/rich-text";
import { plainText } from "../blocks/view-model";
import { NotFound } from "../components/not-found";
import { buildPageView, pageTrail } from "../lib/page-view.server";
import { services } from "../lib/services.server";
import type { Route } from "./+types/page";

export function loader({ params }: Route.LoaderArgs) {
  const page = buildPageView(services.blocks, params.pageId);
  if (!page) return data({ page: null, trail: [] }, { status: 404 });
  return { page, trail: pageTrail(services.blocks, services.projects, page.id) };
}

export function meta({ data }: Route.MetaArgs) {
  return [{ title: data?.page ? plainText(data.page.title) || "Untitled" : "Not found" }];
}

export default function Page({ loaderData }: Route.ComponentProps) {
  const { page, trail } = loaderData;
  if (!page) return <NotFound />;

  return (
    <article>
      <Stack spacing={1}>
        {trail.length > 0 && (
          <Breadcrumbs
            items={trail.map((crumb) =>
              crumb.href ? { id: crumb.id, label: crumb.label, to: crumb.href, component: RouterLink } : crumb,
            )}
          />
        )}
        <Typography variant="h1" gutterBottom>
          {page.title.length > 0 ? <RichText value={page.title} /> : "Untitled"}
        </Typography>
      </Stack>
      <Blocks blocks={page.blocks} />
    </article>
  );
}
