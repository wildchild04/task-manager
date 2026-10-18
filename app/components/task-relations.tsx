import {
  Alert,
  Button,
  Link,
  List,
  SearchSelect,
  Stack,
  TreeNavigation,
  type TreeNavigationItem,
  Typography,
} from "@wildchild/design-system";
import { useEffect, useState } from "react";
import { Link as RouterLink, useFetcher } from "react-router";

import type { ActionResult } from "../lib/forms.server";
import type { HistoryEntryView, LineageView, TaskOverviewView } from "../lib/task-overview.server";
import { fieldError } from "./form-dialog";
import { Hidden } from "./task-actions";

function lineageItems(node: LineageView): TreeNavigationItem {
  return {
    id: node.id,
    label: node.label,
    active: node.current,
    ...(node.current ? {} : { component: RouterLink, to: `/tasks/${node.id}` }),
    ...(node.children.length > 0 ? { children: node.children.map(lineageItems) } : {}),
  };
}

const lineageIds = (node: LineageView): string[] => [node.id, ...node.children.flatMap(lineageIds)];

/** The feature's lineage, fully expanded, with the current task active. */
/** The task's lineage as a tree, fully expanded at first; branches can be collapsed. */
export function Lineage({ lineage }: { lineage: LineageView }) {
  const [expanded, setExpanded] = useState(() => lineageIds(lineage));
  return (
    <TreeNavigation
      ariaLabel="Lineage"
      dense
      items={[lineageItems(lineage)]}
      expandedIds={expanded}
      onExpandedIdsChange={setExpanded}
    />
  );
}

const KIND_LABELS: Record<string, string> = {
  task: "Task",
  comment: "Comment",
  block: "Block",
};

function RemoveReference({ relationId }: { relationId: string }) {
  const fetcher = useFetcher<ActionResult>();
  return (
    <fetcher.Form method="post">
      <Hidden name="intent" value="reference-remove" />
      <Hidden name="relationId" value={relationId} />
      <Button type="submit" size="small" variant="text" disabled={fetcher.state !== "idle"}>
        Remove
      </Button>
    </fetcher.Form>
  );
}

function AddReference({ candidates }: { candidates: TaskOverviewView["referenceCandidates"] }) {
  const fetcher = useFetcher<ActionResult>();
  const [targetId, setTargetId] = useState<string | null>(null);
  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data?.ok) setTargetId(null);
  }, [fetcher.state, fetcher.data]);
  if (candidates.length === 0) return null;

  return (
    <fetcher.Form method="post">
      <Hidden name="intent" value="reference-add" />
      <Hidden name="targetId" value={targetId ?? ""} />
      <Stack direction="row" spacing={1} alignItems="flex-start">
        <SearchSelect
          label="Reference a task"
          size="small"
          fullWidth
          options={candidates.map((c) => ({
            value: c.id,
            label: c.label,
            keywords: [c.label],
          }))}
          value={targetId ?? ""}
          onChange={setTargetId}
          {...fieldError(fetcher.data, "targetId")}
        />
        <Button type="submit" variant="outlined" disabled={!targetId || fetcher.state !== "idle"}>
          Add
        </Button>
      </Stack>
      {fetcher.data && !fetcher.data.ok && fetcher.data.formError && (
        <Alert severity="error" role="alert">
          {fetcher.data.formError}
        </Alert>
      )}
    </fetcher.Form>
  );
}

/** What the task references (with adding and removing), and the tasks that reference it. */
export function References({ view }: { view: TaskOverviewView }) {
  return (
    <Stack spacing={2}>
      {view.references.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          This task references nothing yet.
        </Typography>
      ) : (
        <List
          dense
          items={view.references.map(({ relationId, target }) => ({
            id: relationId,
            primary:
              target.status === "missing" ? (
                <Typography color="text.secondary">{`Missing ${target.kind}: it was deleted`}</Typography>
              ) : target.href ? (
                <Link component={RouterLink} to={target.href} variant="standalone">
                  {target.title}
                </Link>
              ) : (
                target.title
              ),
            secondary: KIND_LABELS[target.kind] ?? target.kind,
            action: <RemoveReference relationId={relationId} />,
          }))}
        />
      )}
      <AddReference candidates={view.referenceCandidates} />
      {view.referencedBy.length > 0 && (
        <Stack spacing={1}>
          <Typography variant="overline" color="text.secondary">
            Referenced by
          </Typography>
          <List
            dense
            items={view.referencedBy.map((from) => ({
              id: from.id,
              primary: (
                <Link component={RouterLink} to={`/tasks/${from.id}`} variant="standalone">
                  {from.title}
                </Link>
              ),
              secondary: from.kindLabel,
            }))}
          />
        </Stack>
      )}
    </Stack>
  );
}

/** The task's transitions, newest first. */
export function History({ entries }: { entries: HistoryEntryView[] }) {
  if (entries.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        Nothing has happened to this task yet.
      </Typography>
    );
  }
  return (
    <List
      dense
      items={entries.map((entry) => ({
        id: entry.id,
        primary: `${entry.label}: ${entry.from} → ${entry.to}`,
        secondary: [entry.actor, entry.at, entry.note].filter(Boolean).join(" · "),
      }))}
    />
  );
}
