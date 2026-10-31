import { Alert, Button, Stack, Typography } from "@wildchild/design-system";
import { type ReactNode, useState } from "react";
import { useNavigate, useRevalidator } from "react-router";

import type { ActionKind } from "~/domain/suggestions/types";

import type { ActionSuggestionItem } from "../lib/action-suggestions.server";
import { withBase } from "../lib/base-path";
import type { DecisionResult } from "../lib/suggestions.server";

/** The confirmation a delete suggestion opens before approving: the same dialog as the delete button's. */
export type ConfirmDelete = (props: { busy: boolean; onClose: () => void; onConfirm: () => void }) => ReactNode;

/**
 * One pending action suggestion, shown next to the control it would use:
 * "<agent> suggests <words>", its note, and Approve (not when outdated) and
 * Reject. Approving a deletion first asks, as the delete button does.
 */
export function ActionSuggestionBar({ item, confirmDelete }: { item: ActionSuggestionItem; confirmDelete?: ConfirmDelete }) {
  const navigate = useNavigate();
  const revalidator = useRevalidator();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  // Not a fetcher: an approved deletion removes this screen's subject, and the reload that follows would
  // unmount the bar before it could go where the delete button would have gone.
  const decide = async (intent: "approve" | "reject") => {
    setBusy(true);
    let result: DecisionResult;
    try {
      const response = await fetch(withBase("/api/suggestions"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ intent, id: item.id }),
      });
      result = (await response.json()) as DecisionResult;
    } catch {
      result = { ok: false, message: "The server couldn't be reached; try again" };
    }
    if (result.ok && result.redirectTo) {
      await navigate(result.redirectTo);
      return;
    }
    setFailure(result.ok ? null : result.message);
    setConfirming(false);
    await revalidator.revalidate();
    setBusy(false);
  };
  const approve = () => (item.action === "delete" && confirmDelete ? setConfirming(true) : void decide("approve"));

  return (
    <>
      <Alert
        severity="warning"
        role="status"
        title={`${item.author} suggests ${item.words}`}
        actions={
          <Stack direction="row" spacing={1}>
            {!item.outdated && (
              <Button size="small" disabled={busy} onClick={approve}>
                Approve
              </Button>
            )}
            <Button size="small" variant="outlined" disabled={busy} onClick={() => void decide("reject")}>
              Reject
            </Button>
          </Stack>
        }
      >
        <Stack spacing={0.5}>
          {item.note && <Typography variant="body2">{item.note}</Typography>}
          {item.outdated && (
            <Typography variant="body2" color="text.secondary">
              Outdated: this changed since it was suggested.
            </Typography>
          )}
          {failure && (
            <Typography variant="body2" color="error">
              {failure}
            </Typography>
          )}
        </Stack>
      </Alert>
      {confirming &&
        confirmDelete?.({
          busy,
          onClose: () => setConfirming(false),
          onConfirm: () => void decide("approve"),
        })}
    </>
  );
}

/** The bars of the given actions, oldest first; nothing when there are none. */
export function ActionSuggestionBars({
  items,
  actions,
  confirmDelete,
}: {
  items: readonly ActionSuggestionItem[];
  actions: readonly ActionKind[];
  confirmDelete?: ConfirmDelete;
}) {
  const shown = items.filter((item) => actions.includes(item.action));
  if (shown.length === 0) return null;
  return (
    <Stack spacing={1}>
      {shown.map((item) => (
        <ActionSuggestionBar key={item.id} item={item} confirmDelete={confirmDelete} />
      ))}
    </Stack>
  );
}
