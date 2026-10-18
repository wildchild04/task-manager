import { Chip, Link, List, Stack, Tabs, Typography } from "@wildchild/design-system";
import { useState } from "react";
import { data, Link as RouterLink, redirect, useSearchParams } from "react-router";

import { Blocks } from "../blocks/block-view";
import { MentionTargetsContext } from "../blocks/rich-text";
import { DeleteProjectButton } from "../components/delete-project";
import { NotFound } from "../components/not-found";
import { allIds, PageTree } from "../components/page-tree";
import { PageEditor } from "../editor/page-editor";
import { editablePage } from "../lib/page-edit.server";
import { useHydrated } from "../lib/use-hydrated";
import { projectDeletion, projectHomeView, type ProjectTabId, type ProjectTabView } from "../lib/projects.server";
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

type TabId = "description" | ProjectTabId | "library";

/** A task tab: its items with their marker and detail, and a link to the full list. */
function TaskTab({ tab }: { tab: ProjectTabView }) {
  return (
    <Stack spacing={1}>
      {tab.items.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          {`No ${tab.title.toLowerCase()} here.`}
        </Typography>
      ) : (
        <List
          dense
          items={tab.items.map((item) => ({
            id: item.id,
            primary: (
              <Link component={RouterLink} to={item.href} variant="standalone">
                {item.title}
              </Link>
            ),
            secondary: item.detail,
            ...(item.chip
              ? { action: <Chip label={item.chip.label} color={item.chip.color} size="small" variant="outlined" /> }
              : {}),
          }))}
        />
      )}
      <Link component={RouterLink} to={tab.listHref} variant="standalone">
        {`All ${tab.title.toLowerCase()} →`}
      </Link>
    </Stack>
  );
}

export default function ProjectHome({ loaderData }: Route.ComponentProps) {
  const { view, editable, deletion } = loaderData;
  const hydrated = useHydrated();
  const [statusSlot, setStatusSlot] = useState<HTMLElement | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  if (!view) return <NotFound />;

  const documents = allIds(view.library).length;
  const label = (title: string, count: number) => (count ? `${title} (${count})` : title);
  const options: { value: TabId; label: string }[] = [
    { value: "description", label: "Description" },
    ...view.tabs.map((tab) => ({ value: tab.id, label: label(tab.title, tab.items.length) })),
    { value: "library", label: label("Library", documents) },
  ];
  const requested = searchParams.get("tab");
  const tab: TabId = options.some((o) => o.value === requested) ? (requested as TabId) : "description";
  const openTab = (value: string) =>
    setSearchParams(
      (params) => {
        if (value === "description") params.delete("tab");
        else params.set("tab", value);
        return params;
      },
      { replace: true, preventScrollReset: true },
    );
  const taskTab = view.tabs.find((t) => t.id === tab);

  return (
    <Stack spacing={2}>
      <Stack direction="row" justifyContent="space-between" alignItems="baseline">
        <Typography variant="h1">{view.project.title}</Typography>
        <Stack direction="row" alignItems="center" spacing={1}>
          <span ref={setStatusSlot} />
          {deletion && <DeleteProjectButton deletion={deletion} />}
        </Stack>
      </Stack>
      {/* Quick glance: what's to do, in progress, open and due. */}
      <Stack direction="row" spacing={1} useFlexGap wrap="wrap">
        {view.glance.map((chip) => (
          <Chip
            key={chip.label}
            label={chip.label}
            size="small"
            variant="outlined"
            {...(chip.color ? { color: chip.color } : {})}
          />
        ))}
      </Stack>
      <Tabs ariaLabel="Project sections" variant="scrollable" value={tab} options={options} onChange={openTab} />
      {/* The description is edited in place; the editor stays mounted while other tabs are open. */}
      {hydrated && editable ? (
        <PageEditor key={editable.id} page={editable} statusSlot={statusSlot} hideBody={tab !== "description"} />
      ) : (
        tab === "description" &&
        (view.home && view.home.blocks.length > 0 ? (
          <article>
            <MentionTargetsContext.Provider value={view.home.mentions}>
              <Blocks blocks={view.home.blocks} />
            </MentionTargetsContext.Provider>
          </article>
        ) : (
          <Typography variant="body2" color="text.secondary">
            No description yet.
          </Typography>
        ))
      )}
      {taskTab && <TaskTab tab={taskTab} />}
      {tab === "library" && (
        <Stack spacing={1}>
          {view.library.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              The knowledge library is empty.
            </Typography>
          ) : (
            <PageTree ariaLabel="Knowledge library" nodes={view.library} activePageId={null} />
          )}
          <Link component={RouterLink} to={`/projects/${view.project.id}/library`} variant="standalone">
            Open the library →
          </Link>
        </Stack>
      )}
    </Stack>
  );
}
