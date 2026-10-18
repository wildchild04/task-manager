import { Breadcrumbs, Card, Chip, Stack, Tabs, Typography } from "@wildchild/design-system";
import { useEffect, useState } from "react";
import { data, Link as RouterLink, redirect, useLocation, useSearchParams } from "react-router";

import { Blocks } from "../blocks/block-view";
import { MentionTargetsContext } from "../blocks/rich-text";
import { Backlinks } from "../components/backlinks";
import { ChoreControls } from "../components/chore-controls";
import { NotFound } from "../components/not-found";
import { PageEditor } from "../editor/page-editor";
import { editablePage } from "../lib/page-edit.server";
import { useHydrated } from "../lib/use-hydrated";
import { TransitionBar } from "../components/task-actions";
import { TaskComments } from "../components/task-comments";
import { History, Lineage, References } from "../components/task-relations";
import { services } from "../lib/services.server";
import { taskAction } from "../lib/task-actions.server";
import { type TaskOverviewView, taskOverviewView } from "../lib/task-overview.server";
import type { Route } from "./+types/task";

export function loader({ params }: Route.LoaderArgs) {
  const view = taskOverviewView(services, params.taskId);
  return view
    ? { view, editable: editablePage(services, "task", params.taskId) ?? null }
    : data({ view: null, editable: null }, { status: 404 });
}

export async function action({ params, request }: Route.ActionArgs) {
  const result = taskAction(services, params.taskId, await request.formData());
  if ("status" in result) throw data(null, { status: result.status === "not_found" ? 404 : 400 });
  return result.ok && result.redirectTo ? redirect(result.redirectTo) : result;
}

export function meta({ data }: Route.MetaArgs) {
  return [{ title: data?.view?.task.title ?? "Not found" }];
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card variant="outlined" title={title}>
      {children}
    </Card>
  );
}

type TabId = "description" | "comments" | "lineage" | "references" | "history";

/** The tabs of a task's page, by kind. */
function tabsFor(view: TaskOverviewView): { value: TabId; label: string }[] {
  const references = view.references.length + view.mentionedIn.length;
  const tabs: { value: TabId; label: string }[] = [{ value: "description", label: "Description" }];
  if (view.comments)
    tabs.push({ value: "comments", label: view.comments.length ? `Comments (${view.comments.length})` : "Comments" });
  if (view.task.kind !== "chore") tabs.push({ value: "lineage", label: "Lineage" });
  tabs.push({ value: "references", label: references ? `References (${references})` : "References" });
  tabs.push({ value: "history", label: "History" });
  return tabs;
}

export default function Task({ loaderData }: Route.ComponentProps) {
  const { view, editable } = loaderData;
  const hydrated = useHydrated();
  const [statusSlot, setStatusSlot] = useState<HTMLElement | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const { hash } = useLocation();

  // A link to a comment opens the Comments tab and shows the comment.
  useEffect(() => {
    if (!hash.startsWith("#comment-")) return;
    if (searchParams.get("tab") !== "comments") {
      setSearchParams((params) => (params.set("tab", "comments"), params), { replace: true, preventScrollReset: true });
      return;
    }
    document.getElementById(hash.slice(1))?.scrollIntoView({ block: "center" });
  }, [hash, searchParams, setSearchParams]);

  if (!view) return <NotFound />;
  const { task, project, chore, body } = view;
  const tabs = tabsFor(view);
  const requested = searchParams.get("tab");
  const tab: TabId = tabs.some((t) => t.value === requested) ? (requested as TabId) : "description";
  const openTab = (value: string) =>
    setSearchParams(
      (params) => {
        if (value === "description") params.delete("tab");
        else params.set("tab", value);
        return params;
      },
      { replace: true, preventScrollReset: true },
    );

  // Between the title and the description: kind and state, a chore's urgency and schedule, the actions, the tabs.
  const header = (
    <Stack spacing={2}>
      <Stack direction="row" spacing={1} alignItems="center" useFlexGap wrap="wrap">
        <Chip label={task.kindLabel} size="small" variant="outlined" />
        <Chip label={task.stateLabel} color={task.stateColor} size="small" />
        {/* The urgency dropdown already says "Urgent"; the chip remains for overdue and closed chores. */}
        {chore?.urgent && !(chore.editable && chore.urgency === "urgent") && <Chip label="Urgent" color="error" size="small" />}
      </Stack>
      {/* Keyed by state so dialogs and errors reset after each transition. */}
      <TransitionBar key={`${task.id}-${task.state}`} view={view} extra={chore && <ChoreControls chore={chore} />} />
      <Tabs ariaLabel="Task sections" value={tab} options={tabs} onChange={openTab} />
    </Stack>
  );

  const description =
    body && body.blocks.length > 0 ? (
      <article>
        <MentionTargetsContext.Provider value={body.mentions}>
          <Blocks blocks={body.blocks} />
        </MentionTargetsContext.Provider>
      </article>
    ) : (
      <Typography variant="body2" color="text.secondary">
        This task's page is empty.
      </Typography>
    );

  return (
    <Stack spacing={2}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Breadcrumbs
          items={[
            { id: "project", label: project.title, to: `/projects/${project.id}`, component: RouterLink },
            { id: "list", label: project.listTitle, to: `/projects/${project.id}/${project.listSlug}`, component: RouterLink },
            { id: "task", label: task.title },
          ]}
        />
        <span ref={setStatusSlot} />
      </Stack>
      {/* The title and description are edited in place; the editor stays mounted while other tabs are open. */}
      {hydrated && editable ? (
        <PageEditor
          key={editable.id}
          page={editable}
          afterTitle={header}
          statusSlot={statusSlot}
          hideBody={tab !== "description"}
        />
      ) : (
        <>
          <Typography variant="h1">{task.title}</Typography>
          {header}
          {tab === "description" && description}
        </>
      )}
      {tab === "comments" && view.comments && <TaskComments key={`comments-${task.id}`} comments={view.comments} />}
      {tab === "lineage" &&
        (view.lineage ? (
          <Lineage lineage={view.lineage} />
        ) : (
          <Typography variant="body2" color="text.secondary">
            This task isn't part of a lineage yet: promote an idea to work, or start an update from done work.
          </Typography>
        ))}
      {tab === "references" && (
        <Stack spacing={2}>
          <Section title="References">
            <References key={`references-${task.id}`} view={view} />
          </Section>
          {view.mentionedIn.length > 0 ? (
            <Backlinks backlinks={view.mentionedIn} />
          ) : (
            <Typography variant="body2" color="text.secondary">
              Nothing mentions this task yet.
            </Typography>
          )}
        </Stack>
      )}
      {tab === "history" && <History entries={view.history} />}
    </Stack>
  );
}
