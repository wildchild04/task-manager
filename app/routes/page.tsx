import { Breadcrumbs, Stack, Typography } from "@wildchild/design-system";
import { useState } from "react";
import { data, Link as RouterLink, redirect } from "react-router";

import { Blocks } from "../blocks/block-view";
import { MentionTargetsContext } from "../blocks/rich-text";
import { RichText } from "../blocks/rich-text";
import { plainText } from "../blocks/view-model";
import { Backlinks } from "../components/backlinks";
import { DeletePageButton } from "../components/delete-page";
import { NotFound } from "../components/not-found";
import { PageEditor } from "../editor/page-editor";
import { deletePage, editablePage, isWithin, pageDeletion } from "../lib/page-edit.server";
import { buildPageView, pageTrail } from "../lib/page-view.server";
import { pageBacklinks } from "../lib/backlinks.server";
import { services } from "../lib/services.server";
import { useHydrated } from "../lib/use-hydrated";
import type { Route } from "./+types/page";

export function loader({ params }: Route.LoaderArgs) {
  const page = buildPageView(services.blocks, params.pageId);
  if (!page) return data({ page: null, trail: [], editable: null, deletion: null, backlinks: [] }, { status: 404 });
  return {
    page,
    trail: pageTrail(services.blocks, services.projects, page.id),
    editable: editablePage(services, "page", page.id) ?? null,
    deletion: pageDeletion(services, page.id) ?? null,
    backlinks: pageBacklinks(services, page.id),
  };
}

/**
 * Deletes the page (`intent=delete-page`). It goes to the parent afterwards,
 * unless `stay` is set (deleting from the navigation while another page is open).
 */
export async function action({ params, request }: Route.ActionArgs) {
  const form = await request.formData();
  if (form.get("intent") !== "delete-page") throw data(null, { status: 400 });
  // From the navigation, `openPageId` is the page being viewed: it only needs to change if it goes too.
  const openPageId = form.get("openPageId");
  const leaving = typeof openPageId === "string" && openPageId !== "" && isWithin(services, openPageId, params.pageId);
  const deleted = deletePage(services, params.pageId);
  if (!deleted) throw data(null, { status: 404 });
  return form.get("stay") ? { ok: true as const, redirectTo: deleted.redirectTo, leaving } : redirect(deleted.redirectTo);
}

export function meta({ data }: Route.MetaArgs) {
  return [{ title: data?.page ? plainText(data.page.title) || "Untitled" : "Not found" }];
}

export default function Page({ loaderData }: Route.ComponentProps) {
  const { page, trail, editable, deletion, backlinks } = loaderData;
  const hydrated = useHydrated();
  const [statusSlot, setStatusSlot] = useState<HTMLElement | null>(null);
  if (!page) return <NotFound />;
  // The server renders the page read-only; the editor takes over in the browser.
  const editing = hydrated && editable;

  return (
    <article>
      <Stack spacing={1}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
          {trail.length > 0 ? (
            <Breadcrumbs
              items={trail.map((crumb) =>
                crumb.href ? { id: crumb.id, label: crumb.label, to: crumb.href, component: RouterLink } : crumb,
              )}
            />
          ) : (
            <span />
          )}
          <Stack direction="row" alignItems="center" spacing={1}>
            <span ref={setStatusSlot} />
            {deletion && <DeletePageButton key={page.id} pageId={page.id} deletion={deletion} />}
          </Stack>
        </Stack>
        {!(editing && editable.title) && (
          <Typography variant="h1">
            {page.title.length > 0 ? <RichText value={page.title} /> : "Untitled"}
          </Typography>
        )}
      </Stack>
      {editing ? (
        <PageEditor key={editable.id} page={editable} statusSlot={statusSlot} />
      ) : (
        <MentionTargetsContext.Provider value={page.mentions}>
          <Blocks blocks={page.blocks} />
        </MentionTargetsContext.Provider>
      )}
      <div className="page-backlinks">
        <Backlinks backlinks={backlinks} />
      </div>
    </article>
  );
}
