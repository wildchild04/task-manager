import { TextField } from "@wildchild/design-system";
import { useFetcher } from "react-router";

import type { ActionResult } from "../lib/forms.server";
import { fieldError, FormDialog, lastValue } from "./form-dialog";

/**
 * Creates a project from anywhere: posts to `/new`, which
 * opens the new project once it's created.
 */
export function NewProjectDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const fetcher = useFetcher<ActionResult>();
  return (
    <FormDialog open={open} title="New project" confirmLabel="Create" fetcher={fetcher} onClose={onClose} action="/new">
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
