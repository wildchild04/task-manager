import { Alert, Button, Checkbox, Radio, Stack, TextField, Typography } from "@wildchild/design-system";
import { useState } from "react";
import { useFetcher } from "react-router";

import type { ActionResult } from "../lib/forms.server";
import type { TaskOverviewView, TransitionView } from "../lib/task-overview.server";
import { fieldError, FormDialog, lastValue } from "./form-dialog";

/** A hidden form field. */
export const Hidden = ({ name, value }: { name: string; value: string }) => <input type="hidden" name={name} value={value} />;

/** Transitions that move the task forward get the filled button; the rest are outlined. */
const PRIMARY = new Set(["start", "complete", "promote", "reopen", "revive"]);

type DialogProps = { open: boolean; onClose: () => void };

function PromoteDialog({ open, onClose, title }: DialogProps & { title: string }) {
  const fetcher = useFetcher<ActionResult>();
  return (
    <FormDialog open={open} title="Promote to work" confirmLabel="Promote" fetcher={fetcher} onClose={onClose}>
      <Hidden name="intent" value="transition" />
      <Hidden name="transition" value="promote" />
      <Typography variant="body2" color="text.secondary">
        Creates a work task born from this idea and opens it.
      </Typography>
      <TextField
        name="title"
        label="Work title"
        required
        fullWidth
        defaultValue={lastValue(fetcher.data, "title") ?? title}
        {...fieldError(fetcher.data, "title")}
      />
    </FormDialog>
  );
}

function ReturnDialog({ open, onClose }: DialogProps) {
  const fetcher = useFetcher<ActionResult>();
  return (
    <FormDialog open={open} title="Return work" confirmLabel="Return" fetcher={fetcher} onClose={onClose}>
      <Hidden name="intent" value="transition" />
      <Hidden name="transition" value="return" />
      <Typography variant="body2" color="text.secondary">
        The work goes back to to do. The reason is posted as a comment.
      </Typography>
      <TextField
        name="reason"
        label="Reason"
        required
        fullWidth
        multiline
        minRows={2}
        defaultValue={lastValue(fetcher.data, "reason")}
        {...fieldError(fetcher.data, "reason")}
      />
      <TextField
        name="description"
        label="Add to the description (optional)"
        fullWidth
        multiline
        minRows={2}
        defaultValue={lastValue(fetcher.data, "description")}
        helperText="Appended to the end of the task's page. Separate paragraphs with a blank line."
      />
    </FormDialog>
  );
}

function CompleteChoreDialog({ open, onClose, follower }: DialogProps & { follower: { offered: boolean; default: boolean } }) {
  const fetcher = useFetcher<ActionResult>();
  const [next, setNext] = useState(follower.default);
  return (
    <FormDialog open={open} title="Complete chore" confirmLabel="Complete" fetcher={fetcher} onClose={onClose}>
      <Hidden name="intent" value="transition" />
      <Hidden name="transition" value="complete" />
      <Hidden name="next" value={follower.offered && next ? "yes" : "no"} />
      {follower.offered ? (
        <Checkbox label="Create the following chore with the same configuration" checked={next} onChange={setNext} />
      ) : (
        <Typography variant="body2">This chore is due on a specific date, so it doesn't repeat.</Typography>
      )}
    </FormDialog>
  );
}

function CancelChoreDialog({ open, onClose }: DialogProps) {
  const fetcher = useFetcher<ActionResult>();
  return (
    <FormDialog open={open} title="Cancel chore" confirmLabel="Cancel chore" fetcher={fetcher} onClose={onClose}>
      <Hidden name="intent" value="transition" />
      <Hidden name="transition" value="cancel" />
      <Radio
        label="What to cancel"
        name="scope"
        defaultValue="occurrence"
        options={[
          {
            value: "occurrence",
            label: "This occurrence (the next one is still created)",
          },
          { value: "series", label: "The whole series" },
        ]}
      />
    </FormDialog>
  );
}

/** Asks for a title and creates a task from this one (or from one of its comments). */
export function StartDialog({
  open,
  onClose,
  intent,
  title,
  description,
  commentId,
}: DialogProps & {
  intent: "start-exploration" | "start-update";
  title: string;
  description: string;
  commentId?: string;
}) {
  const fetcher = useFetcher<ActionResult>();
  return (
    <FormDialog open={open} title={title} confirmLabel="Create" fetcher={fetcher} onClose={onClose}>
      <Hidden name="intent" value={intent} />
      {commentId && <Hidden name="commentId" value={commentId} />}
      <Typography variant="body2" color="text.secondary">
        {description}
      </Typography>
      <TextField
        name="title"
        label="Title"
        required
        fullWidth
        defaultValue={lastValue(fetcher.data, "title")}
        {...fieldError(fetcher.data, "title")}
      />
    </FormDialog>
  );
}

type OpenDialog = "promote" | "return" | "complete-chore" | "cancel-chore" | "start-exploration" | "start-update" | null;

/**
 * The task's actions: its allowed transitions, the chore urgency switch, and
 * starting an exploration or update from it. Transitions without input post
 * directly; the others open a dialog.
 */
/** The task's actions; `extra` (a chore's urgency and schedule) ends the row. */
export function TransitionBar({ view, extra }: { view: TaskOverviewView; extra?: React.ReactNode }) {
  const fetcher = useFetcher<ActionResult>();
  const [dialog, setDialog] = useState<OpenDialog>(null);
  const close = () => setDialog(null);
  const busy = fetcher.state !== "idle";
  const error = fetcher.data && !fetcher.data.ok ? fetcher.data.formError : undefined;

  const button = (transition: TransitionView) => {
    const variant = PRIMARY.has(transition.name) ? "contained" : "outlined";
    if (transition.form === "direct") {
      return (
        <fetcher.Form method="post" key={transition.name}>
          <Hidden name="intent" value="transition" />
          <Hidden name="transition" value={transition.name} />
          <Button type="submit" variant={variant} disabled={busy}>
            {transition.label}
          </Button>
        </fetcher.Form>
      );
    }
    const form = transition.form;
    return (
      <Button key={transition.name} variant={variant} onClick={() => setDialog(form)}>
        {`${transition.label}…`}
      </Button>
    );
  };

  return (
    <Stack spacing={1}>
      <Stack direction="row" spacing={1} useFlexGap wrap="wrap" alignItems="center">
        {view.transitions.map(button)}
        {view.canStartUpdate && (
          <Button variant="text" onClick={() => setDialog("start-update")}>
            Start update…
          </Button>
        )}
        <Button variant="text" onClick={() => setDialog("start-exploration")}>
          Start exploration…
        </Button>
        {extra}
      </Stack>
      {error && (
        <Alert severity="error" role="alert">
          {error}
        </Alert>
      )}

      {/* Dialogs mount only while open, so each starts from a clean form. */}
      {dialog === "promote" && <PromoteDialog open onClose={close} title={view.task.title} />}
      {dialog === "return" && <ReturnDialog open onClose={close} />}
      {dialog === "complete-chore" && view.chore && <CompleteChoreDialog open onClose={close} follower={view.chore.follower} />}
      {dialog === "cancel-chore" && <CancelChoreDialog open onClose={close} />}
      {dialog === "start-exploration" && (
        <StartDialog
          open
          onClose={close}
          intent="start-exploration"
          title="Start exploration"
          description={`Creates an exploration that references this ${view.task.kindLabel}, and opens it.`}
        />
      )}
      {dialog === "start-update" && (
        <StartDialog
          open
          onClose={close}
          intent="start-update"
          title="Start update"
          description="Creates an update that iterates on this work, and opens it."
        />
      )}
    </Stack>
  );
}
