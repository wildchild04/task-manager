import { TextField } from "@wildchild/design-system";
import { useFetcher } from "react-router";

import type { ActionResult } from "../lib/forms.server";
import { fieldError, FormDialog, lastValue } from "./form-dialog";
import { Hidden } from "./task-actions";

/**
 * Creates a top-level workspace page from anywhere: posts to the home route's
 * action, which opens the new page once it's created.
 */
export function NewPageDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const fetcher = useFetcher<ActionResult>();
  return (
    <FormDialog open={open} title="New page" confirmLabel="Create" fetcher={fetcher} onClose={onClose} action="/?index">
      <Hidden name="intent" value="create-page" />
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
