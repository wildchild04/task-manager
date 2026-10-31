import { Breadcrumbs, Card, Chip, Stack, Tabs, Typography } from "@wildchild/design-system";
import { useEffect, useState } from "react";
import { data, Link as RouterLink, redirect, useLocation, useNavigate, useSearchParams } from "react-router";

import { Blocks } from "../blocks/block-view";
import { MentionTargetsContext } from "../blocks/rich-text";
import { Backlinks } from "../components/backlinks";
import { ChoreControls } from "../components/chore-controls";
import { ActionSuggestionBars } from "../components/action-suggestion-bar";
import { DeleteTaskButton, DeleteTaskDialog } from "../components/delete-task";
import { NotFound } from "../components/not-found";
import { PageEditor } from "../editor/page-editor";
import { actionSuggestionItems } from "../lib/action-suggestions.server";
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
  const bodyPageId = services.tasks.get(params.taskId)?.bodyPageId;
  return view && bodyPageId
    ? {
        view,
        editable: editablePage(services, "task", params.taskId) ?? null,
        actions: actionSuggestionItems(services, bodyPageId),
      }
    : data({ view: null, editable: null, actions: [] }, { status: 404 });
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

type TabId = "description" | "comments" | "findings" | "lineage" | "references" | "history";

/** The tabs of a task's page, by kind. */
function tabsFor(view: TaskOverviewView): { value: TabId; label: string }[] {
  const references = view.references.length + view.mentionedIn.length;
  const tabs: { value: TabId; label: string }[] = [{ value: "description", label: "Description" }];
  if (view.comments)
    tabs.push({ value: "comments", label: view.comments.length ? `Comments (${view.comments.length})` : "Comments" });
  if (view.findings)
    tabs.push({ value: "findings", label: view.findings.length ? `Findings (${view.findings.length})` : "Findings" });
  if (view.task.kind !== "chore") tabs.push({ value: "lineage", label: "Lineage" });
  tabs.push({ value: "references", label: references ? `References (${references})` : "References" });
  tabs.push({ value: "history", label: "History" });
  return tabs;
}

export default function Task({ loaderData }: Route.ComponentProps) {
  const { view, editable, actions } = loaderData;
  const hydrated = useHydrated();
  const [statusSlot, setStatusSlot] = useState<HTMLElement | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const { hash } = useLocation();
  const navigate = useNavigate();

  // A link to a comment or finding opens its tab and shows it.
  useEffect(() => {
    const linked = hash.startsWith("#comment-") ? "comments" : hash.startsWith("#finding-") ? "findings" : undefined;
    if (!linked) return;
    if (searchParams.get("tab") !== linked) {
      // Keep the hash, so the item is shown once its tab is open.
      const params = new URLSearchParams(searchParams);
      params.set("tab", linked);
      navigate({ search: `?${params}`, hash }, { replace: true, preventScrollReset: true });
      return;
    }
    document.getElementById(hash.slice(1))?.scrollIntoView({ block: "center" });
  }, [hash, searchParams, navigate]);

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
  const deletion = {
    title: task.title,
    kindLabel: task.kindLabel,
    comments: view.comments?.length ?? 0,
    findings: view.findings?.length ?? 0,
  };
  // Agents' suggested actions show by the control they'd use: a rename under the title, a schedule and
  // an ending transition under the actions row, a deletion by the delete button.
  const header = (
    <Stack spacing={2}>
      <ActionSuggestionBars items={actions} actions={["rename"]} />
      <Stack direction="row" spacing={1} alignItems="center" useFlexGap wrap="wrap">
        <Chip label={task.kindLabel} size="small" variant="outlined" />
        <Chip label={task.stateLabel} color={task.stateColor} size="small" />
        {/* The urgency dropdown already says "Urgent"; the chip remains for overdue and closed chores. */}
        {chore?.urgent && !(chore.editable && chore.urgency === "urgent") && <Chip label="Urgent" color="error" size="small" />}
      </Stack>
      {/* Keyed by state so dialogs and errors reset after each transition. */}
      <TransitionBar key={`${task.id}-${task.state}`} view={view} extra={chore && <ChoreControls chore={chore} />} />
      <ActionSuggestionBars items={actions} actions={["schedule", "transition"]} />
      <Tabs ariaLabel="Task sections" variant="scrollable" value={tab} options={tabs} onChange={openTab} />
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
        <Stack direction="row" spacing={1} alignItems="center">
          <span ref={setStatusSlot} />
          <DeleteTaskButton key={task.id} {...deletion} />
        </Stack>
      </Stack>
      <ActionSuggestionBars
        items={actions}
        actions={["delete"]}
        confirmDelete={(props) => <DeleteTaskDialog deletion={deletion} {...props} />}
      />
      {/* The title and description are edited in place; the editor stays mounted while other tabs are open. */}
      {hydrated && editable ? (
        <PageEditor
          key={editable.id}
          page={editable}
          afterTitle={header}
          titleGutterBottom
          statusSlot={statusSlot}
          hideBody={tab !== "description"}
        />
      ) : (
        <>
          <Typography variant="h1" gutterBottom>
            {task.title}
          </Typography>
          {header}
          {tab === "description" && description}
        </>
      )}
      {tab === "comments" && view.comments && <TaskComments key={`comments-${task.id}`} comments={view.comments} />}
      {tab === "findings" && view.findings && (
        <TaskComments key={`findings-${task.id}`} kind="finding" comments={view.findings} />
      )}
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
