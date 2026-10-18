import {
  Alert,
  Button,
  Chip,
  Link,
  Select,
  Stack,
  Table,
  TableAddRow,
  type TableColumn,
  Tabs,
  TextField,
  Typography,
} from "@wildchild/design-system";
import { useEffect, useState } from "react";
import { data, Link as RouterLink, useFetcher, useNavigate } from "react-router";

import { ChoreFields } from "../components/chore-fields";
import { fieldError, FormDialog, lastValue } from "../components/form-dialog";
import { NotFound } from "../components/not-found";
import { isTaskListSlug } from "../lib/format";
import type { ActionResult } from "../lib/forms.server";
import { services } from "../lib/services.server";
import { createTaskAction, type TaskListView, type TaskRowView, taskListView } from "../lib/task-lists.server";
import type { Route } from "./+types/task-list";

export function loader({ params, request }: Route.LoaderArgs) {
  const state = new URL(request.url).searchParams.get("state");
  const view = isTaskListSlug(params.list) ? taskListView(services, params.projectId, params.list, state) : undefined;
  return view ? { view } : data({ view: null }, { status: 404 });
}

export async function action({ params, request }: Route.ActionArgs) {
  if (!isTaskListSlug(params.list)) throw data(null, { status: 404 });
  return createTaskAction(services, params.projectId, params.list, await request.formData());
}

export function meta({ data }: Route.MetaArgs) {
  return [{ title: data?.view ? `${data.view.list.title} · ${data.view.project.title}` : "Not found" }];
}

function columnsFor(view: TaskListView): TableColumn<TaskRowView>[] {
  const columns: TableColumn<TaskRowView>[] = [
    {
      id: "title",
      header: "Title",
      cell: (row) => (
        <Link component={RouterLink} to={`/tasks/${row.id}`} variant="standalone">
          {row.title}
        </Link>
      ),
    },
    {
      id: "state",
      header: "State",
      cell: (row) => <Chip label={row.stateLabel} color={row.stateColor} size="small" variant="outlined" />,
    },
  ];
  if (view.list.kind === "chore") {
    columns.push(
      {
        id: "urgent",
        header: "Urgency",
        cell: (row) => (row.urgent ? <Chip label="Urgent" color="error" size="small" /> : "Normal"),
      },
      { id: "due", header: "Due", cell: (row) => row.due ?? "—" },
    );
  }
  columns.push({ id: "updated", header: "Updated", cell: (row) => row.updated });
  return columns;
}

/**
 * Quick add by title, for explorations and work. What's typed also filters the
 * list (held by the list); it clears after each task is created.
 */
function QuickAdd({ singular, value, onChange }: { singular: string; value: string; onChange: (value: string) => void }) {
  const fetcher = useFetcher<ActionResult>();
  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data?.ok) onChange("");
  }, [fetcher.state, fetcher.data, onChange]);
  const error = fetcher.data && !fetcher.data.ok ? fetcher.data.fieldErrors.title : undefined;

  return (
    <fetcher.Form method="post">
      <TableAddRow
        name="title"
        value={value}
        onChange={onChange}
        ariaLabel={`New ${singular} title`}
        placeholder={`Add ${singular === "work" ? "work" : `an ${singular}`}…`}
        submitting={fetcher.state !== "idle"}
        helperText={error}
      />
    </fetcher.Form>
  );
}

function UpdateDialog({ view, open, onClose }: { view: TaskListView; open: boolean; onClose: () => void }) {
  const fetcher = useFetcher<ActionResult>();
  const none = view.doneWork.length === 0;
  return (
    <FormDialog open={open} title="New update" confirmLabel="Create" fetcher={fetcher} onClose={onClose} confirmDisabled={none}>
      {none ? (
        <Alert severity="info" role="status">
          An update iterates on work that is done. This project has no done work yet.
        </Alert>
      ) : (
        <>
          <TextField
            name="title"
            label="Title"
            required
            fullWidth
            defaultValue={lastValue(fetcher.data, "title")}
            {...fieldError(fetcher.data, "title")}
          />
          <Select
            name="iteratesOn"
            label="Iterates on"
            required
            fullWidth
            defaultValue={lastValue(fetcher.data, "iteratesOn") ?? view.doneWork[0]!.id}
            options={view.doneWork.map((w) => ({ value: w.id, label: w.title }))}
            {...fieldError(fetcher.data, "iteratesOn")}
          />
        </>
      )}
    </FormDialog>
  );
}

function ChoreDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const fetcher = useFetcher<ActionResult>();
  return (
    <FormDialog open={open} title="New chore" confirmLabel="Create" fetcher={fetcher} onClose={onClose}>
      <ChoreFields result={fetcher.data} />
    </FormDialog>
  );
}

export default function TaskList({ loaderData }: Route.ComponentProps) {
  const { view } = loaderData;
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [typed, setTyped] = useState("");
  if (!view) return <NotFound />;

  const usesDialog = view.list.kind === "update" || view.list.kind === "chore";
  const filter = usesDialog ? "" : typed.trim().toLowerCase();
  const rows = filter ? view.rows.filter((row) => row.title.toLowerCase().includes(filter)) : view.rows;

  return (
    <Stack spacing={2}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="h1">{view.list.title}</Typography>
        {usesDialog && <Button onClick={() => setDialogOpen(true)}>New {view.list.singular}</Button>}
      </Stack>
      <Tabs
        ariaLabel="Filter by state"
        value={view.filter}
        options={view.filters}
        onChange={(value) => void navigate(`?state=${value}`)}
      />
      <Table
        rows={rows}
        columns={columnsFor(view)}
        getRowId={(row) => row.id}
        emptyState={
          filter ? `Nothing matches "${typed.trim()}". Press Enter to add it.` : `No ${view.list.title.toLowerCase()} here.`
        }
        addRow={usesDialog ? undefined : <QuickAdd singular={view.list.singular} value={typed} onChange={setTyped} />}
        addRowPosition="top"
      />
      {view.list.kind === "update" && <UpdateDialog view={view} open={dialogOpen} onClose={() => setDialogOpen(false)} />}
      {view.list.kind === "chore" && <ChoreDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />}
    </Stack>
  );
}
