import { Alert, Dialog, Stack } from "@wildchild/design-system";
import { type ReactNode, useEffect, useRef } from "react";
import type { FetcherWithComponents } from "react-router";

import type { ActionResult } from "../lib/forms.server";

/**
 * A dialog whose content is a form posted with a fetcher. The dialog's
 * confirm button submits the form natively, so the action receives ordinary
 * form data. The dialog closes when the action reports success.
 */
export function FormDialog({
  open,
  title,
  confirmLabel,
  fetcher,
  onClose,
  children,
  confirmDisabled,
}: {
  open: boolean;
  title: string;
  confirmLabel: string;
  fetcher: FetcherWithComponents<ActionResult>;
  onClose: () => void;
  children: ReactNode;
  confirmDisabled?: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const submitting = fetcher.state !== "idle";
  const result = fetcher.data;

  useEffect(() => {
    if (fetcher.state === "idle" && result?.ok) onClose();
    // Close once per successful submission.
  }, [fetcher.state, result]);

  return (
    <Dialog
      open={open}
      title={title}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      cancelAction={{ label: "Cancel", onClick: onClose }}
      confirmAction={{
        label: submitting ? "Saving…" : confirmLabel,
        disabled: submitting || confirmDisabled,
        onClick: () => formRef.current?.requestSubmit(),
      }}
    >
      <fetcher.Form method="post" ref={formRef} className="dialog-fields">
        <Stack spacing={2}>
          {result && !result.ok && result.formError && (
            <Alert severity="error" role="alert">
              {result.formError}
            </Alert>
          )}
          {children}
        </Stack>
      </fetcher.Form>
    </Dialog>
  );
}

/** Props that show a field's error, if the last submission had one. */
export function fieldError(result: ActionResult | undefined, field: string) {
  const message = result && !result.ok ? result.fieldErrors[field] : undefined;
  return message ? { error: true, helperText: message } : {};
}

/** The value submitted last time, to keep input after a rejected submission. */
export function lastValue(result: ActionResult | undefined, field: string): string | undefined {
  return result && !result.ok ? result.values[field] : undefined;
}
