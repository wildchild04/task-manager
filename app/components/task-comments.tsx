import { Alert, Button, Divider, Stack, TextField, Typography } from "@wildchild/design-system";
import { useEffect, useState } from "react";
import { useFetcher } from "react-router";

import { Blocks } from "../blocks/block-view";
import type { ActionResult } from "../lib/forms.server";
import type { CommentView } from "../lib/task-overview.server";
import { fieldError, FormDialog, lastValue } from "./form-dialog";
import { Hidden, StartDialog } from "./task-actions";

const PARAGRAPH_HINT = "Separate paragraphs with a blank line.";

function EditCommentDialog({ comment, onClose }: { comment: CommentView; onClose: () => void }) {
  const fetcher = useFetcher<ActionResult>();
  return (
    <FormDialog open title="Edit comment" confirmLabel="Save" fetcher={fetcher} onClose={onClose}>
      <Hidden name="intent" value="comment-edit" />
      <Hidden name="commentId" value={comment.id} />
      {!comment.onlyParagraphs && (
        <Alert severity="warning" role="status">
          This comment has formatting that plain text can't keep. Saving turns every block into a paragraph.
        </Alert>
      )}
      <TextField
        name="text"
        label="Comment"
        fullWidth
        multiline
        minRows={3}
        defaultValue={lastValue(fetcher.data, "text") ?? comment.text}
        {...fieldError(fetcher.data, "text")}
      />
    </FormDialog>
  );
}

function DeleteCommentDialog({ comment, onClose }: { comment: CommentView; onClose: () => void }) {
  const fetcher = useFetcher<ActionResult>();
  return (
    <FormDialog open title="Delete comment?" confirmLabel="Delete" fetcher={fetcher} onClose={onClose}>
      <Hidden name="intent" value="comment-delete" />
      <Hidden name="commentId" value={comment.id} />
      <Typography variant="body2">The comment is removed for good. References to it will show as missing.</Typography>
    </FormDialog>
  );
}

type CommentDialog = {
  kind: "edit" | "delete" | "start";
  comment: CommentView;
} | null;

function Comment({ comment, onOpen }: { comment: CommentView; onOpen: (dialog: CommentDialog) => void }) {
  return (
    <div id={`comment-${comment.id}`}>
      <Stack spacing={0.5}>
        <Stack direction="row" spacing={1} alignItems="baseline" useFlexGap wrap="wrap">
          <Typography variant="body2">
            <strong>{comment.author}</strong>
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {comment.edited ? `${comment.at} · Edited` : comment.at}
          </Typography>
        </Stack>
        <div>
          <Blocks blocks={comment.blocks} />
        </div>
        <Stack direction="row" spacing={1}>
          <Button size="small" variant="text" onClick={() => onOpen({ kind: "edit", comment })}>
            Edit
          </Button>
          <Button size="small" variant="text" color="error" onClick={() => onOpen({ kind: "delete", comment })}>
            Delete
          </Button>
          <Button size="small" variant="text" onClick={() => onOpen({ kind: "start", comment })}>
            Start exploration…
          </Button>
        </Stack>
      </Stack>
    </div>
  );
}

/** A plain-text comment box that clears itself after each comment is added. */
function AddComment() {
  const fetcher = useFetcher<ActionResult>();
  const [key, setKey] = useState(0);
  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data?.ok) setKey((k) => k + 1);
  }, [fetcher.state, fetcher.data]);

  return (
    <fetcher.Form method="post" key={key}>
      <Hidden name="intent" value="comment-add" />
      <Stack spacing={1} alignItems="flex-start">
        <TextField
          name="text"
          label="Add a comment"
          fullWidth
          multiline
          minRows={2}
          helperText={fieldError(fetcher.data, "text").helperText ?? PARAGRAPH_HINT}
          error={fieldError(fetcher.data, "text").error}
        />
        <Button type="submit" disabled={fetcher.state !== "idle"}>
          Comment
        </Button>
      </Stack>
    </fetcher.Form>
  );
}

/** The task's comments, oldest first, with adding, editing, deleting and starting an exploration from one. */
export function TaskComments({ comments }: { comments: CommentView[] }) {
  const [dialog, setDialog] = useState<CommentDialog>(null);
  const close = () => setDialog(null);

  return (
    <Stack spacing={2}>
      {comments.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No comments yet.
        </Typography>
      ) : (
        <Stack spacing={2} divider={<Divider />}>
          {comments.map((comment) => (
            <Comment key={comment.id} comment={comment} onOpen={setDialog} />
          ))}
        </Stack>
      )}
      <AddComment />

      {dialog?.kind === "edit" && <EditCommentDialog comment={dialog.comment} onClose={close} />}
      {dialog?.kind === "delete" && <DeleteCommentDialog comment={dialog.comment} onClose={close} />}
      {dialog?.kind === "start" && (
        <StartDialog
          open
          onClose={close}
          intent="start-exploration"
          commentId={dialog.comment.id}
          title="Start exploration from this comment"
          description="Creates an exploration that references this comment, and opens it."
        />
      )}
    </Stack>
  );
}
