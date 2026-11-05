import { Dialog, Stack, TextField, Typography } from "@wildchild/design-system";
import { useState } from "react";

import { withBase } from "../lib/base-path";
import type { DecisionResult } from "../lib/suggestions.server";

/** Sends a decision to `/api/suggestions`, as the review buttons do; a network failure comes back as a refusal. */
export async function postSuggestionDecision(body: Record<string, string>): Promise<DecisionResult> {
  try {
    const response = await fetch(withBase("/api/suggestions"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    return (await response.json()) as DecisionResult;
  } catch {
    return { ok: false, message: "The server couldn't be reached; try again" };
  }
}

/** Sends the feedback; resolves to the decision's result. */
export type SendFeedback = (text: string) => Promise<DecisionResult>;

/**
 * Asks a suggestion's agent for changes: what should change, sent with
 * Send. A refusal stays in the dialog; once sent, it closes.
 */
export function RequestChangesDialog({ author, send, onClose }: { author: string; send: SendFeedback; onClose: () => void }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    const result = await send(text);
    if (result.ok) {
      onClose();
      return;
    }
    setFailure(result.message);
    setBusy(false);
  };

  return (
    <Dialog
      open
      title="Request changes"
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      cancelAction={{ label: "Cancel", onClick: onClose }}
      confirmAction={{ label: busy ? "Sending…" : "Send", disabled: busy || !text.trim(), onClick: () => void submit() }}
    >
      <Stack spacing={2}>
        <Typography variant="body2" color="text.secondary">
          {author} will see this and can revise the suggestion.
        </Typography>
        <TextField
          label="What should change?"
          multiline
          minRows={3}
          maxRows={10}
          fullWidth
          value={text}
          disabled={busy}
          error={failure !== null}
          helperText={failure ?? undefined}
          onChange={(event) => {
            setText(event.target.value);
            setFailure(null);
          }}
        />
      </Stack>
    </Dialog>
  );
}
