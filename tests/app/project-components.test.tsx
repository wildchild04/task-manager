import { DesignSystemProvider } from "@wildchild/design-system";
import type { ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";

import { ChoreFields } from "../../app/components/chore-fields";
import { DashboardCard } from "../../app/components/dashboard-card";

const render = (node: ReactNode) =>
  renderToString(
    <MemoryRouter>
      <DesignSystemProvider mode="light">{node}</DesignSystemProvider>
    </MemoryRouter>,
  );

describe("DashboardCard", () => {
  it("shows the count, linked items, urgency, due time and overflow", () => {
    const html = render(
      <DashboardCard
        card={{
          id: "chores",
          title: "Chores",
          count: 7,
          items: [{ id: "c1", title: "Renew cert", href: "/tasks/c1", urgent: true, due: "15 Jan 2026, 09:00" }],
        }}
      />,
    );
    for (const fragment of ["Chores", ">7<", 'href="/tasks/c1"', "Renew cert", "Urgent", "Due 15 Jan 2026, 09:00", "and 6 more"]) {
      expect(html).toContain(fragment);
    }
  });

  it("says when a section is empty", () => {
    expect(render(<DashboardCard card={{ id: "open-updates", title: "Open updates", count: 0, items: [] }} />)).toContain(
      "Nothing here",
    );
  });
});

describe("ChoreFields", () => {
  it("renders the base fields with no schedule fields by default", () => {
    const html = render(<ChoreFields result={undefined} />);
    expect(html).toContain('name="title"');
    expect(html).toContain('name="urgency"');
    expect(html).toContain('name="scheduleType"');
    expect(html).not.toContain('name="time"');
  });

  it("keeps rejected input and shows the time error", () => {
    const html = render(
      <ChoreFields
        result={{
          ok: false,
          fieldErrors: { time: "Enter a time as HH:MM, e.g. 09:00" },
          values: { title: "Feed cat", scheduleType: "time", time: "25:00" },
        }}
      />,
    );
    expect(html).toContain('value="Feed cat"');
    expect(html).toContain('value="25:00"');
    expect(html).toContain("Enter a time as HH:MM, e.g. 09:00");
  });

  it("shows the weekly fields and posts the date through a hidden ISO input", () => {
    const weekly = render(
      <ChoreFields result={{ ok: false, fieldErrors: {}, values: { scheduleType: "frequency", every: "weekly" } }} />,
    );
    expect(weekly).toContain('name="weekday"');
    const dated = render(
      <ChoreFields result={{ ok: false, fieldErrors: {}, values: { scheduleType: "date", date: "2026-11-03", time: "14:30" } }} />,
    );
    expect(dated).toMatch(/type="hidden" name="date" value="2026-11-03"/);
  });
});
