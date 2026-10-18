import { Dialog, IconButton, Stack, Typography } from "@wildchild/design-system";
import { useState } from "react";
import { useFetcher } from "react-router";

import type { ProjectDeletion } from "../lib/projects.server";

const plural = (count: number, one: string) => `${count} ${one}${count === 1 ? "" : "s"}`;

/** The project's delete button, with a confirmation saying what goes with it. Deleting goes to the home route. */
export function DeleteProjectButton({ deletion }: { deletion: ProjectDeletion }) {
  const fetcher = useFetcher();
  const [open, setOpen] = useState(false);
  const busy = fetcher.state !== "idle";
  const contents = [
    deletion.tasks > 0 && plural(deletion.tasks, "task"),
    deletion.documents > 0 && plural(deletion.documents, "document"),
  ]
    .filter(Boolean)
    .join(" and ");

  return (
    <>
      <IconButton ariaLabel={`Delete ${deletion.title}`} icon="delete" onClick={() => setOpen(true)} />
      {open && (
        <Dialog
          open
          title={`Delete "${deletion.title}"?`}
          onClose={() => setOpen(false)}
          cancelAction={{ label: "Cancel", onClick: () => setOpen(false) }}
          confirmAction={{
            label: busy ? "Deleting…" : "Delete project",
            color: "error",
            disabled: busy,
            onClick: () => void fetcher.submit({ intent: "delete-project" }, { method: "post" }),
          }}
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
      )}
    </>
  );
}
