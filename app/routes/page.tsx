import { Typography } from "@wildchild/design-system";
import { data } from "react-router";

import { Blocks } from "../blocks/block-view";
import { RichText } from "../blocks/rich-text";
import { plainText } from "../blocks/view-model";
import { NotFound } from "../components/not-found";
import { buildPageView } from "../lib/page-view.server";
import { services } from "../lib/services.server";
import type { Route } from "./+types/page";

export async function loader({ params }: Route.LoaderArgs) {
  const page = await buildPageView(services.blocks, params.pageId);
  return page ? { page } : data({ page: null }, { status: 404 });
}

export function meta({ data }: Route.MetaArgs) {
  return [{ title: data?.page ? plainText(data.page.title) || "Untitled" : "Not found" }];
}

export default function Page({ loaderData }: Route.ComponentProps) {
  const { page } = loaderData;
  if (!page) return <NotFound />;

  return (
    <article>
      <Typography variant="h1" gutterBottom>
        {page.title.length > 0 ? <RichText value={page.title} /> : "Untitled"}
      </Typography>
      <Blocks blocks={page.blocks} />
    </article>
  );
}
