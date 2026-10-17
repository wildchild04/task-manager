import { Breadcrumbs, Card, Chip, Stack, Typography } from "@wildchild/design-system";
import { data, Link as RouterLink, redirect } from "react-router";

import { Blocks } from "../blocks/block-view";
import { NotFound } from "../components/not-found";
import { TransitionBar } from "../components/task-actions";
import { TaskComments } from "../components/task-comments";
import { History, Lineage, References } from "../components/task-relations";
import { services } from "../lib/services.server";
import { taskAction } from "../lib/task-actions.server";
import { taskOverviewView } from "../lib/task-overview.server";
import type { Route } from "./+types/task";

export function loader({ params }: Route.LoaderArgs) {
  const view = taskOverviewView(services, params.taskId);
  return view ? { view } : data({ view: null }, { status: 404 });
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

export default function Task({ loaderData }: Route.ComponentProps) {
  const { view } = loaderData;
  if (!view) return <NotFound />;
  const { task, project, chore, body } = view;

  return (
    <Stack spacing={2}>
      <Breadcrumbs
        items={[
          {
            id: "project",
            label: project.title,
            to: `/projects/${project.id}`,
            component: RouterLink,
          },
          {
            id: "list",
            label: project.listTitle,
            to: `/projects/${project.id}/${project.listSlug}`,
            component: RouterLink,
          },
          { id: "task", label: task.title },
        ]}
      />
      <Typography variant="h1">{task.title}</Typography>
      <Stack direction="row" spacing={1}>
        <Chip label={task.kindLabel} size="small" variant="outlined" />
        <Chip label={task.stateLabel} color={task.stateColor} size="small" />
        {chore?.urgent && <Chip label="Urgent" color="error" size="small" />}
      </Stack>
      {/* Keyed by state so dialogs and errors reset after each transition. */}
      <TransitionBar key={`${task.id}-${task.state}`} view={view} />
      {chore && (
        <Section title="Schedule">
          <Stack spacing={0.5}>
            <Typography variant="body2">{chore.schedule ?? "No schedule"}</Typography>
            {chore.due && <Typography variant="body2">Due {chore.due}</Typography>}
            <Typography variant="body2" color="text.secondary">
              Urgency: {chore.urgency}
            </Typography>
          </Stack>
        </Section>
      )}
      {body && body.blocks.length > 0 ? (
        <article>
          <Blocks blocks={body.blocks} />
        </article>
      ) : (
        <Typography variant="body2" color="text.secondary">
          This task's page is empty.
        </Typography>
      )}
      {view.comments && (
        <Section title="Comments">
          <TaskComments key={task.id} comments={view.comments} />
        </Section>
      )}
      {view.lineage && (
        <Section title="Lineage">
          <Lineage lineage={view.lineage} />
        </Section>
      )}
      <Section title="References">
        <References key={task.id} view={view} />
      </Section>
      <Section title="History">
        <History entries={view.history} />
      </Section>
    </Stack>
  );
}
