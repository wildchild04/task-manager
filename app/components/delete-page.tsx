import { Alert, Dialog, IconButton, Stack, Typography } from "@wildchild/design-system";
import { useEffect, useState } from "react";
import { useFetcher, useNavigate } from "react-router";

import type { PageDeletion } from "../lib/page-edit.server";

type DeleteResult = { ok: true; redirectTo: string; leaving: boolean };

/** Deletions from the navigation share one fetcher, so the result outlives the deleted page's row. */
const NAVIGATION_DELETE = "delete-page-from-navigation";

/**
 * Leaves the open page when it was deleted from the navigation (itself or a
 * page containing it). Rendered once by the shell, which never unmounts.
 */
export function NavigationDeleteWatcher() {
  const fetcher = useFetcher<DeleteResult>({ key: NAVIGATION_DELETE });
  const navigate = useNavigate();
  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data?.ok && fetcher.data.leaving) void navigate(fetcher.data.redirectTo);
  }, [fetcher.state, fetcher.data, navigate]);
  return null;
}

const insideText = (count: number) =>
  count === 0 ? "" : count === 1 ? " and the page inside it" : ` and the ${count} pages inside it`;

/**
 * A delete button for a page, with a confirmation dialog saying what goes with
 * it. On the page itself, deleting goes to the page's parent. From the
 * navigation (`openPageId` = the page being viewed), the shell's
 * `NavigationDeleteWatcher` navigates, and only when the open page is deleted too.
 */
export function DeletePageButton({
  pageId,
  deletion: known,
  openPageId,
  size = "medium",
}: {
  pageId: string;
  /** What deleting involves, when already loaded; fetched on click otherwise. */
  deletion?: PageDeletion | null;
  openPageId?: string | null;
  size?: "small" | "medium";
}) {
  const fromNavigation = openPageId !== undefined;
  const fetcher = useFetcher<DeleteResult>(fromNavigation ? { key: NAVIGATION_DELETE } : undefined);
  const [deletion, setDeletion] = useState<PageDeletion | null>(known ?? null);
  const [open, setOpen] = useState(false);
  const busy = fetcher.state !== "idle";

  // Close once our own submission is done (the shared fetcher's earlier result doesn't count).
  const [submitted, setSubmitted] = useState(false);
  useEffect(() => {
    if (submitted && fetcher.state === "idle" && fetcher.data?.ok) setOpen(false);
  }, [submitted, fetcher.state, fetcher.data]);

  const ask = async () => {
    if (!deletion) {
      const response = await fetch(`/api/pages?deletion=${encodeURIComponent(pageId)}`);
      const body = (await response.json()) as { deletion: PageDeletion | null };
      if (!body.deletion) return;
      setDeletion(body.deletion);
    }
    setOpen(true);
  };

  const confirm = () => {
    const form: Record<string, string> = { intent: "delete-page" };
    if (fromNavigation) Object.assign(form, { stay: "yes", openPageId: openPageId ?? "" });
    setSubmitted(true);
    void fetcher.submit(form, { method: "post", action: `/pages/${pageId}` });
  };

  return (
    <>
      <IconButton ariaLabel={`Delete ${deletion?.title ?? "page"}`} icon="delete" size={size} onClick={() => void ask()} />
      {open && deletion && (
        <Dialog
          open
          title={`Delete "${deletion.title}"?`}
          onClose={() => setOpen(false)}
          cancelAction={{ label: "Cancel", onClick: () => setOpen(false) }}
          confirmAction={{ label: busy ? "Deleting…" : "Delete", color: "error", disabled: busy, onClick: confirm }}
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
