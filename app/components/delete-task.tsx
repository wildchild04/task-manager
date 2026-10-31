import { Dialog, IconButton, Stack, Typography } from "@wildchild/design-system";
import { useState } from "react";
import { useFetcher } from "react-router";

/** "comment", "3 comments", or nothing for none. */
const count = (n: number, noun: string) => (n === 0 ? "" : n === 1 ? noun : `${n} ${noun}s`);

export type TaskDeletion = { title: string; kindLabel: string; comments: number; findings?: number };
type DialogProps = { busy: boolean; onClose: () => void; onConfirm: () => void };

/** The confirmation for deleting a task, saying what goes with it. */
export function DeleteTaskDialog({ deletion, busy, onClose, onConfirm }: { deletion: TaskDeletion } & DialogProps) {
  const { title, kindLabel, comments, findings = 0 } = deletion;
  return (
    <Dialog
      open
      title={`Delete "${title}"?`}
      onClose={onClose}
      cancelAction={{ label: "Cancel", onClick: onClose }}
      confirmAction={{ label: busy ? "Deleting…" : `Delete ${kindLabel}`, color: "error", disabled: busy, onClick: onConfirm }}
    >
      <Stack spacing={1.5}>
        <Typography>
          {`The ${kindLabel} will be deleted for good, with its ${[count(comments, "comment"), count(findings, "finding")]
            .filter(Boolean)
            .map((items) => `${items} and `)
            .join("")}history.`}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          References, mentions and lineage elsewhere that point to it will show it as missing.
        </Typography>
      </Stack>
    </Dialog>
  );
}

/** The task's delete button, with a confirmation. Deleting goes to the project's list for the task's kind. */
export function DeleteTaskButton(deletion: TaskDeletion) {
  const fetcher = useFetcher();
  const [open, setOpen] = useState(false);

  return (
    <>
      <IconButton ariaLabel={`Delete ${deletion.title}`} icon="delete" onClick={() => setOpen(true)} />
      {open && (
        <DeleteTaskDialog
          deletion={deletion}
          busy={fetcher.state !== "idle"}
          onClose={() => setOpen(false)}
          onConfirm={() => void fetcher.submit({ intent: "delete" }, { method: "post" })}
        />
      )}
    </>
  );
}
