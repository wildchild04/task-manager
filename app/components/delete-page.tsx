import { Alert, Dialog, IconButton, Stack, Typography } from "@wildchild/design-system";
import { useState } from "react";
import { useFetcher } from "react-router";

import type { PageDeletion } from "../lib/page-edit.server";

const insideText = (count: number) =>
  count === 0 ? "" : count === 1 ? " and the page inside it" : ` and the ${count} pages inside it`;

/**
 * The page's delete button, with a confirmation dialog saying what goes with
 * it. Deleting goes to the page's parent (or the library, or home).
 */
export function DeletePageButton({ pageId, deletion }: { pageId: string; deletion: PageDeletion }) {
  const fetcher = useFetcher();
  const [open, setOpen] = useState(false);
  const busy = fetcher.state !== "idle";

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
            label: busy ? "Deleting…" : "Delete",
            color: "error",
            disabled: busy,
            onClick: () => void fetcher.submit({ intent: "delete-page" }, { method: "post", action: `/pages/${pageId}` }),
          }}
        >
          <Stack spacing={1.5}>
            <Typography>{`"${deletion.title}"${insideText(deletion.nestedPages)} will be deleted for good.`}</Typography>
            {deletion.nestedPages > 0 && (
              <Alert severity="warning" role="status">
                {`${deletion.nestedPages === 1 ? "1 page" : `${deletion.nestedPages} pages`} inside it will be deleted too.`}
              </Alert>
            )}
            <Typography variant="body2" color="text.secondary">
              Links and references to these pages will show them as missing.
            </Typography>
          </Stack>
        </Dialog>
      )}
    </>
  );
}
