import { DesignSystemProvider } from "@wildchild/design-system";
import type { ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";

import { ChoreFields } from "../../app/components/chore-fields";
import { ancestorIds, PageTree } from "../../app/components/page-tree";

const render = (node: ReactNode) =>
  renderToString(
    <MemoryRouter>
      <DesignSystemProvider mode="light">{node}</DesignSystemProvider>
    </MemoryRouter>,
  );

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
          fieldErrors: { time: "Choose a time" },
          values: { title: "Feed cat", scheduleType: "time", time: "" },
        }}
      />,
    );
    expect(html).toContain('value="Feed cat"');
    expect(html).toContain("Choose a time");
  });

  it("posts the time from the TimePicker as HH:mm", () => {
    const html = render(<ChoreFields result={{ ok: false, fieldErrors: {}, values: { scheduleType: "time", time: "09:30" } }} />);
    expect(html).toMatch(/type="hidden" name="time" value="09:30"/);
  });

  it("shows the weekly fields and posts the date through a hidden ISO input", () => {
    const weekly = render(
      <ChoreFields result={{ ok: false, fieldErrors: {}, values: { scheduleType: "frequency", every: "weekly" } }} />,
    );
    expect(weekly).toContain('name="weekday"');
    const dated = render(
      <ChoreFields
        result={{ ok: false, fieldErrors: {}, values: { scheduleType: "date", date: "2026-11-03", time: "14:30" } }}
      />,
    );
    expect(dated).toMatch(/type="hidden" name="date" value="2026-11-03"/);
  });
});

describe("PageTree", () => {
  const tree = [
    {
      id: "arch",
      title: "Architecture",
      children: [{ id: "auth", title: "Auth design", children: [{ id: "tok", title: "Tokens", children: [] }] }],
    },
    { id: "conv", title: "Conventions", children: [] },
  ];

  it("finds a document's ancestors, outermost first", () => {
    expect(ancestorIds(tree, "tok")).toEqual(["arch", "auth"]);
    expect(ancestorIds(tree, "arch")).toEqual([]);
    expect(ancestorIds(tree, "nope")).toEqual([]);
  });

  it("expands the open document's ancestors and marks it current", () => {
    const html = render(<PageTree ariaLabel="Library" nodes={tree} activePageId="tok" />);
    expect(html).toContain('href="/pages/tok"');
    expect(html).toContain('aria-current="page"');
    expect(html).toContain("Tokens");
  });

  it("keeps collapsed branches collapsed when nothing is open", () => {
    const html = render(<PageTree ariaLabel="Library" nodes={tree} activePageId={null} />);
    expect(html).toContain("Architecture");
    expect(html).not.toContain("Tokens");
  });
});
