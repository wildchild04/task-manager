import { DatePicker, Select, Stack, TextField } from "@wildchild/design-system";
import { useState } from "react";

import type { ActionResult } from "../lib/forms.server";
import { fieldError, lastValue } from "./form-dialog";

const SCHEDULE_TYPES = [
  { value: "none", label: "No schedule" },
  { value: "time", label: "At a time" },
  { value: "date", label: "On a date" },
  { value: "timer", label: "Timer" },
  { value: "frequency", label: "Daily, weekly or monthly" },
  { value: "interval", label: "Every X" },
];

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map((label, i) => ({
  value: String(i + 1),
  label,
}));

/**
 * The fields of the create-chore form. Field names match what
 * `createTaskAction` reads. The time is typed as HH:MM until the design
 * system has a time picker (feature-requests/time-picker.md).
 */
export function ChoreFields({ result }: { result: ActionResult | undefined }) {
  const [scheduleType, setScheduleType] = useState(lastValue(result, "scheduleType") ?? "none");
  const [every, setEvery] = useState(lastValue(result, "every") ?? "daily");
  // DatePicker submits its displayed text under `name`, so the ISO date goes through a hidden input.
  const [date, setDate] = useState(lastValue(result, "date") ?? "");

  const time = (
    <TextField
      name="time"
      label="Time"
      placeholder="09:00"
      defaultValue={lastValue(result, "time")}
      {...fieldError(result, "time")}
    />
  );

  return (
    <Stack spacing={2}>
      <TextField name="title" label="Title" required fullWidth defaultValue={lastValue(result, "title")} {...fieldError(result, "title")} />
      <Select
        name="urgency"
        label="Urgency"
        defaultValue={lastValue(result, "urgency") ?? "normal"}
        options={[
          { value: "normal", label: "Normal" },
          { value: "urgent", label: "Urgent" },
        ]}
      />
      <Select name="scheduleType" label="Schedule" value={scheduleType} onChange={setScheduleType} options={SCHEDULE_TYPES} />

      {scheduleType === "time" && time}
      {scheduleType === "date" && (
        <Stack direction="row" spacing={2}>
          <DatePicker label="Date" value={date} onChange={setDate} {...fieldError(result, "date")} />
          <input type="hidden" name="date" value={date} />
          {time}
        </Stack>
      )}
      {scheduleType === "timer" && (
        <TextField name="minutes" label="Minutes from now" placeholder="30" defaultValue={lastValue(result, "minutes")} {...fieldError(result, "minutes")} />
      )}
      {scheduleType === "frequency" && (
        <Stack direction="row" spacing={2} wrap="wrap">
          <Select
            name="every"
            label="Repeats"
            value={every}
            onChange={setEvery}
            options={[
              { value: "daily", label: "Daily" },
              { value: "weekly", label: "Weekly" },
              { value: "monthly", label: "Monthly" },
            ]}
          />
          {every === "weekly" && (
            <Select name="weekday" label="On" defaultValue={lastValue(result, "weekday") ?? "1"} options={WEEKDAYS} {...fieldError(result, "weekday")} />
          )}
          {every === "monthly" && (
            <TextField name="dayOfMonth" label="Day of month" placeholder="1" defaultValue={lastValue(result, "dayOfMonth")} {...fieldError(result, "dayOfMonth")} />
          )}
          {time}
        </Stack>
      )}
      {scheduleType === "interval" && (
        <Stack direction="row" spacing={2}>
          <TextField name="amount" label="Every" placeholder="6" defaultValue={lastValue(result, "amount")} {...fieldError(result, "amount")} />
          <Select
            name="unit"
            label="Unit"
            defaultValue={lastValue(result, "unit") ?? "hours"}
            options={[
              { value: "minutes", label: "Minutes" },
              { value: "hours", label: "Hours" },
              { value: "days", label: "Days" },
              { value: "weeks", label: "Weeks" },
            ]}
          />
        </Stack>
      )}
    </Stack>
  );
}
