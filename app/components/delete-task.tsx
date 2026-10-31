import { Dialog, IconButton, Stack, Typography } from "@wildchild/design-system";
import { useState } from "react";
import { useFetcher } from "react-router";

/** "comment", "3 comments", or nothing for none. */
const count = (n: number, noun: string) => (n === 0 ? "" : n === 1 ? noun : `${n} ${noun}s`);

/** The task's delete button, with a confirmation. Deleting goes to the project's list for the task's kind. */
export function DeleteTaskButton({
  title,
  kindLabel,
  comments,
  findings = 0,
}: {
  title: string;
  kindLabel: string;
  comments: number;
  findings?: number;
}) {
  const fetcher = useFetcher();
  const [open, setOpen] = useState(false);
  const busy = fetcher.state !== "idle";

  return (
    <>
      <IconButton ariaLabel={`Delete ${title}`} icon="delete" onClick={() => setOpen(true)} />
      {open && (
        <Dialog
          open
          title={`Delete "${title}"?`}
          onClose={() => setOpen(false)}
          cancelAction={{ label: "Cancel", onClick: () => setOpen(false) }}
          confirmAction={{
            label: busy ? "Deleting…" : `Delete ${kindLabel}`,
            color: "error",
            disabled: busy,
            onClick: () => void fetcher.submit({ intent: "delete" }, { method: "post" }),
          }}
        >
          <Stack spacing={1.5}>
            <Typography>
              {`The ${kindLabel} will be deleted for good, with its ${[
                count(comments, "comment"),
                count(findings, "finding"),
              ]
                .filter(Boolean)
                .map((items) => `${items} and `)
                .join("")}history.`}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              References, mentions and lineage elsewhere that point to it will show it as missing.
            </Typography>
          </Stack>
        </Dialog>
      )}
    </>
  );
}
