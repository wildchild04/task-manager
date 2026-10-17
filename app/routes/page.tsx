import { Breadcrumbs, Stack, Typography } from "@wildchild/design-system";
import { data, Link as RouterLink, redirect } from "react-router";

import { Blocks } from "../blocks/block-view";
import { RichText } from "../blocks/rich-text";
import { plainText } from "../blocks/view-model";
import { NotFound } from "../components/not-found";
import { PageEditor } from "../editor/page-editor";
import { deletePage, editablePage, pageDeletion } from "../lib/page-edit.server";
import { buildPageView, pageTrail } from "../lib/page-view.server";
import { services } from "../lib/services.server";
import { useHydrated } from "../lib/use-hydrated";
import type { Route } from "./+types/page";

export function loader({ params }: Route.LoaderArgs) {
  const page = buildPageView(services.blocks, params.pageId);
  if (!page) return data({ page: null, trail: [], editable: null, deletion: null }, { status: 404 });
  return {
    page,
    trail: pageTrail(services.blocks, services.projects, page.id),
    editable: editablePage(services, "page", page.id) ?? null,
    deletion: pageDeletion(services, page.id) ?? null,
  };
}

/**
 * Deletes the page (`intent=delete-page`). It goes to the parent afterwards,
 * unless `stay` is set (deleting from the navigation while another page is open).
 */
export async function action({ params, request }: Route.ActionArgs) {
  const form = await request.formData();
  if (form.get("intent") !== "delete-page") throw data(null, { status: 400 });
  const deleted = deletePage(services, params.pageId);
  if (!deleted) throw data(null, { status: 404 });
  return form.get("stay") ? { ok: true as const, redirectTo: deleted.redirectTo } : redirect(deleted.redirectTo);
}

export function meta({ data }: Route.MetaArgs) {
  return [{ title: data?.page ? plainText(data.page.title) || "Untitled" : "Not found" }];
}

export default function Page({ loaderData }: Route.ComponentProps) {
  const { page, trail, editable } = loaderData;
  const hydrated = useHydrated();
  if (!page) return <NotFound />;
  // The server renders the page read-only; the editor takes over in the browser.
  const editing = hydrated && editable;

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
        {!(editing && editable.title) && (
          <Typography variant="h1" gutterBottom>
            {page.title.length > 0 ? <RichText value={page.title} /> : "Untitled"}
          </Typography>
        )}
      </Stack>
      {editing ? <PageEditor key={editable.id} page={editable} /> : <Blocks blocks={page.blocks} />}
    </article>
  );
}
