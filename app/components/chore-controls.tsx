import { Button, Select, Stack, Typography } from "@wildchild/design-system";
import { useState } from "react";
import { useFetcher } from "react-router";

import type { ActionResult } from "../lib/forms.server";
import type { TaskOverviewView } from "../lib/task-overview.server";
import { ScheduleFields } from "./chore-fields";
import { FormDialog } from "./form-dialog";
import { Hidden } from "./task-actions";

type Chore = NonNullable<TaskOverviewView["chore"]>;

/** Changes a chore's schedule, starting from the current one. */
function ScheduleDialog({ chore, onClose }: { chore: Chore; onClose: () => void }) {
  const fetcher = useFetcher<ActionResult>();
  return (
    <FormDialog open title="Schedule" confirmLabel="Save" fetcher={fetcher} onClose={onClose}>
      <Hidden name="intent" value="schedule" />
      <ScheduleFields result={fetcher.data} initial={chore.scheduleValues} />
    </FormDialog>
  );
}

/**
 * A chore's urgency and schedule in the task header: urgency as a dropdown
 * (this occurrence only), the schedule as a button that opens its editor.
 */
export function ChoreControls({ chore }: { chore: Chore }) {
  const fetcher = useFetcher<ActionResult>();
  const [editing, setEditing] = useState(false);
  const schedule = `${chore.schedule ?? "No schedule"}${chore.due ? ` · due ${chore.due}` : ""}`;

  return (
    // Pushed to the end of the action row.
    <div className="chore-controls">
      <Stack direction="row" spacing={1} alignItems="center" useFlexGap wrap="wrap">
        {chore.editable ? (
          <Select
            label="Urgency"
            size="small"
            value={chore.urgency}
            onChange={(urgency) => void fetcher.submit({ intent: "urgency", urgency }, { method: "post" })}
            options={[
              { value: "normal", label: "Normal" },
              { value: "urgent", label: "Urgent" },
            ]}
          />
        ) : (
          <Typography variant="body2" color="text.secondary">
            {`Urgency: ${chore.urgency}`}
          </Typography>
        )}
        {chore.editable ? (
          <Button variant="outlined" size="small" onClick={() => setEditing(true)}>
            {schedule}
          </Button>
        ) : (
          <Typography variant="body2" color="text.secondary">
            {schedule}
          </Typography>
        )}
        {editing && <ScheduleDialog chore={chore} onClose={() => setEditing(false)} />}
      </Stack>
    </div>
  );
}
