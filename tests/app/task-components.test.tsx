import { DesignSystemProvider } from "@wildchild/design-system";
import type { ComponentType } from "react";
import { renderToString } from "react-dom/server";
import { createRoutesStub } from "react-router";
import { describe, expect, it } from "vitest";

import { TransitionBar } from "../../app/components/task-actions";
import { TaskComments } from "../../app/components/task-comments";
import { History, Lineage, References } from "../../app/components/task-relations";
import type { TaskOverviewView } from "../../app/lib/task-overview.server";

/** Fetcher forms need a data router, so components render inside a route stub. */
const render = (Component: ComponentType) => {
  const Stub = createRoutesStub([{ path: "/", Component }]);
  return renderToString(
    <DesignSystemProvider mode="light">
      <Stub />
    </DesignSystemProvider>,
  );
};

const base: TaskOverviewView = {
  task: { id: "W", title: "Add login", kind: "work", kindLabel: "work", state: "in_progress", stateLabel: "In progress", stateColor: "primary" },
  project: { id: "P", title: "Taskhub", listSlug: "work", listTitle: "Work" },
  body: undefined,
  transitions: [
    { name: "pause", label: "Pause", form: "direct" },
    { name: "return", label: "Return", form: "return" },
    { name: "complete", label: "Complete", form: "direct" },
  ],
  canStartUpdate: false,
  history: [],
  comments: [],
  references: [],
  referencedBy: [],
  referenceCandidates: [],
};

describe("TransitionBar", () => {
  it("posts direct transitions and opens dialogs for the rest", () => {
    const html = render(() => <TransitionBar view={base} />);
    expect(html).toMatch(/name="transition" value="pause"/);
    expect(html).toMatch(/name="transition" value="complete"/);
    expect(html).not.toMatch(/name="transition" value="return"/);
    expect(html).toContain("Return…");
    expect(html).toContain("Start exploration…");
    expect(html).not.toContain("Start update…");
  });

  it("offers the urgency switch and starting an update when they apply", () => {
    const html = render(() => (
      <TransitionBar
        view={{
          ...base,
          canStartUpdate: true,
          chore: { urgent: false, urgency: "normal", urgencyAction: { urgency: "urgent", label: "Mark urgent" }, follower: { offered: true, default: true } },
        }}
      />
    ));
    expect(html).toMatch(/name="urgency" value="urgent"/);
    expect(html).toContain("Mark urgent");
    expect(html).toContain("Start update…");
  });
});

describe("TaskComments", () => {
  it("renders each comment with its anchor, author, edited marker and content", () => {
    const html = render(() => (
      <TaskComments
        comments={[
          {
            id: "c1",
            author: "builder",
            at: "14 Oct 2026, 08:00",
            edited: true,
            blocks: [{ kind: "content", id: "p1", type: "paragraph", props: {}, content: [{ text: "Tests fail on CI" }], children: [] }],
            text: "Tests fail on CI",
            onlyParagraphs: true,
          },
        ]}
      />
    ));
    for (const fragment of ['id="comment-c1"', "builder", "14 Oct 2026, 08:00 · Edited", "Tests fail on CI", 'name="intent" value="comment-add"']) {
      expect(html).toContain(fragment);
    }
  });

  it("says when there are no comments", () => {
    expect(render(() => <TaskComments comments={[]} />)).toContain("No comments yet.");
  });
});

describe("relations", () => {
  it("links lineage entries except the current one", () => {
    const html = render(() => (
      <Lineage
        lineage={{
          id: "E",
          label: "Exploration · Passkeys · Promoted",
          current: false,
          children: [{ id: "W", label: "Work · Add passkeys · Done", current: true, children: [] }],
        }}
      />
    ));
    expect(html).toContain('href="/tasks/E"');
    expect(html).not.toContain('href="/tasks/W"');
    expect(html).toContain('aria-current="page"');
  });

  it("lists references with links, missing targets and referencing tasks", () => {
    const html = render(() => (
      <References
        view={{
          ...base,
          references: [
            { relationId: "r1", target: { status: "ok", kind: "comment", title: "An idea", href: "/tasks/W#comment-c1" } },
            { relationId: "r2", target: { status: "missing", kind: "block" } },
          ],
          referencedBy: [{ id: "E", title: "Passkeys", kindLabel: "exploration" }],
          referenceCandidates: [{ id: "T", label: "Work: Other" }],
        }}
      />
    ));
    for (const fragment of ['href="/tasks/W#comment-c1"', "Missing block: it was deleted", 'name="relationId" value="r1"', "Referenced by", 'href="/tasks/E"', "Reference a task"]) {
      expect(html).toContain(fragment);
    }
  });

  it("shows history entries with actor and note", () => {
    const html = render(() => (
      <History entries={[{ id: "h1", label: "Return", from: "In progress", to: "To do", actor: "builder", note: "Tests fail", at: "14 Oct 2026, 08:00" }]} />
    ));
    expect(html).toContain("Return: In progress → To do");
    expect(html).toContain("builder · 14 Oct 2026, 08:00 · Tests fail");
  });
});
