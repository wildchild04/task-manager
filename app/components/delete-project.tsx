import { Dialog, IconButton, Stack, Typography } from "@wildchild/design-system";
import { useState } from "react";
import { useFetcher } from "react-router";

import type { ProjectDeletion } from "../lib/projects.server";

const plural = (count: number, one: string) => `${count} ${one}${count === 1 ? "" : "s"}`;

type DialogProps = { busy: boolean; onClose: () => void; onConfirm: () => void };

/** The confirmation for deleting a project, saying what goes with it. */
export function DeleteProjectDialog({ deletion, busy, onClose, onConfirm }: { deletion: ProjectDeletion } & DialogProps) {
  const contents = [
    deletion.tasks > 0 && plural(deletion.tasks, "task"),
    deletion.documents > 0 && plural(deletion.documents, "document"),
  ]
    .filter(Boolean)
    .join(" and ");
  return (
    <Dialog
      open
      title={`Delete "${deletion.title}"?`}
      onClose={onClose}
      cancelAction={{ label: "Cancel", onClick: onClose }}
      confirmAction={{ label: busy ? "Deleting…" : "Delete project", color: "error", disabled: busy, onClick: onConfirm }}
    >
      <Stack spacing={1.5}>
        <Typography>
          {contents
            ? `The project and its ${contents} will be deleted for good, with their comments and history.`
            : "The project will be deleted for good."}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          References and mentions elsewhere that point into it will show as missing.
        </Typography>
      </Stack>
    </Dialog>
  );
}

/** The project's delete button, with a confirmation saying what goes with it. Deleting goes to the home route. */
export function DeleteProjectButton({ deletion }: { deletion: ProjectDeletion }) {
  const fetcher = useFetcher();
  const [open, setOpen] = useState(false);

  return (
    <>
      <IconButton ariaLabel={`Delete ${deletion.title}`} icon="delete" onClick={() => setOpen(true)} />
      {open && (
        <DeleteProjectDialog
          deletion={deletion}
          busy={fetcher.state !== "idle"}
          onClose={() => setOpen(false)}
          onConfirm={() => void fetcher.submit({ intent: "delete-project" }, { method: "post" })}
        />
      )}
    </>
  );
}
