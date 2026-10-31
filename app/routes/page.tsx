import { Breadcrumbs, Stack, Typography } from "@wildchild/design-system";
import { useState } from "react";
import { data, Link as RouterLink, redirect } from "react-router";

import { Blocks } from "../blocks/block-view";
import { MentionTargetsContext } from "../blocks/rich-text";
import { RichText } from "../blocks/rich-text";
import { plainText } from "../blocks/view-model";
import { Backlinks } from "../components/backlinks";
import { ActionSuggestionBars } from "../components/action-suggestion-bar";
import { DeletePageButton, DeletePageDialog } from "../components/delete-page";
import { NotFound } from "../components/not-found";
import { PageEditor } from "../editor/page-editor";
import { deletePage, editablePage, pageDeletion } from "../lib/page-edit.server";
import { buildPageView, pageTrail } from "../lib/page-view.server";
import { actionSuggestionItems } from "../lib/action-suggestions.server";
import { pageBacklinks } from "../lib/backlinks.server";
import { services } from "../lib/services.server";
import { useHydrated } from "../lib/use-hydrated";
import type { Route } from "./+types/page";

export function loader({ params }: Route.LoaderArgs) {
  const page = buildPageView(services.blocks, params.pageId, services.suggestions, services.content);
  if (!page) return data({ page: null, trail: [], editable: null, deletion: null, backlinks: [], actions: [] }, { status: 404 });
  return {
    page,
    trail: pageTrail(services.blocks, services.projects, page.id),
    editable: editablePage(services, "page", page.id) ?? null,
    deletion: pageDeletion(services, page.id) ?? null,
    backlinks: pageBacklinks(services, page.id),
    actions: actionSuggestionItems(services, page.id),
  };
}

/** Deletes the page (`intent=delete-page`), with the pages inside it, and goes to its parent. */
export async function action({ params, request }: Route.ActionArgs) {
  const form = await request.formData();
  if (form.get("intent") !== "delete-page") throw data(null, { status: 400 });
  const deleted = deletePage(services, params.pageId);
  if (!deleted) throw data(null, { status: 404 });
  return redirect(deleted.redirectTo);
}

export function meta({ data }: Route.MetaArgs) {
  return [{ title: data?.page ? plainText(data.page.title) || "Untitled" : "Not found" }];
}

export default function Page({ loaderData }: Route.ComponentProps) {
  const { page, trail, editable, deletion, backlinks, actions } = loaderData;
  const hydrated = useHydrated();
  const [statusSlot, setStatusSlot] = useState<HTMLElement | null>(null);
  if (!page) return <NotFound />;
  // The server renders the page read-only; the editor takes over in the browser.
  const editing = hydrated && editable;
  // An agent's suggested rename shows under the title; a suggested deletion by the delete button.
  const renames = <ActionSuggestionBars items={actions} actions={["rename"]} />;

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
        <ActionSuggestionBars
          items={actions}
          actions={["delete"]}
          confirmDelete={(props) => deletion && <DeletePageDialog deletion={deletion} {...props} />}
        />
        {!(editing && editable.title) && (
          <>
            <Typography variant="h1">{page.title.length > 0 ? <RichText value={page.title} /> : "Untitled"}</Typography>
            {renames}
          </>
        )}
      </Stack>
      {editing ? (
        <PageEditor key={editable.id} page={editable} statusSlot={statusSlot} afterTitle={editable.title ? renames : undefined} />
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
