import { DatePicker, Select, Stack, TextField, TimePicker } from "@wildchild/design-system";
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

/** The fields of the create-chore form. Field names match what `createTaskAction` reads. */
export function ChoreFields({ result }: { result: ActionResult | undefined }) {
  return (
    <Stack spacing={2}>
      <TextField
        name="title"
        label="Title"
        required
        fullWidth
        defaultValue={lastValue(result, "title")}
        {...fieldError(result, "title")}
      />
      <Select
        name="urgency"
        label="Urgency"
        defaultValue={lastValue(result, "urgency") ?? "normal"}
        options={[
          { value: "normal", label: "Normal" },
          { value: "urgent", label: "Urgent" },
        ]}
      />
      <ScheduleFields result={result} />
    </Stack>
  );
}

/**
 * A chore's schedule fields: the type, then that type's fields. Field names
 * match what `scheduleFromForm` reads. `initial` prefills them (an existing
 * chore's schedule); a rejected submission's values win over it.
 */
export function ScheduleFields({ result, initial = {} }: { result: ActionResult | undefined; initial?: Record<string, string> }) {
  const value = (field: string) => lastValue(result, field) ?? initial[field];
  const [scheduleType, setScheduleType] = useState(value("scheduleType") ?? "none");
  const [every, setEvery] = useState(value("every") ?? "daily");
  // DatePicker submits its displayed text under `name`, so the ISO date goes through a hidden input.
  const [date, setDate] = useState(value("date") ?? "");

  // TimePicker submits a hidden HH:mm input under `name`.
  const time = (
    <TimePicker name="time" label="Time" minutesStep={5} defaultValue={value("time")} {...fieldError(result, "time")} />
  );

  return (
    <Stack spacing={2}>
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
        <TextField
          name="minutes"
          label="Minutes from now"
          placeholder="30"
          defaultValue={value("minutes")}
          {...fieldError(result, "minutes")}
        />
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
            <Select
              name="weekday"
              label="On"
              defaultValue={value("weekday") ?? "1"}
              options={WEEKDAYS}
              {...fieldError(result, "weekday")}
            />
          )}
          {every === "monthly" && (
            <TextField
              name="dayOfMonth"
              label="Day of month"
              placeholder="1"
              defaultValue={value("dayOfMonth")}
              {...fieldError(result, "dayOfMonth")}
            />
          )}
          {time}
        </Stack>
      )}
      {scheduleType === "interval" && (
        <Stack direction="row" spacing={2}>
          <TextField
            name="amount"
            label="Every"
            placeholder="6"
            defaultValue={value("amount")}
            {...fieldError(result, "amount")}
          />
          <Select
            name="unit"
            label="Unit"
            defaultValue={value("unit") ?? "hours"}
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
