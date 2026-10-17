import type { AppServices } from "~/composition";
import type { CreateTaskInput } from "~/domain/tasks/task.service";
import type { TaskKind } from "~/domain/tasks/types";
import type { NewBlock, Operation, RichText } from "~/domain/blocks/types";

/** Fixed IDs make seeding idempotent: if the welcome page exists, there is nothing to do. */
const id = (name: string) => `seed-${name}`;
const text = (value: string): RichText => [{ text: value }];

/** Inserts blocks as consecutive children of a parent, each after the previous one. */
function children(parentId: string, blocks: (NewBlock & { children?: NewBlock[] })[]): Operation[] {
  const ops: Operation[] = [];
  let afterId: string | null = null;
  for (const { children: nested, ...block } of blocks) {
    ops.push({ op: "insert", block, parentId, afterId });
    if (nested) ops.push(...children(block.id, nested));
    afterId = block.id;
  }
  return ops;
}

const welcome: Operation[] = [
  { op: "insert", block: { id: id("welcome"), type: "page", content: text("Welcome") }, parentId: null },
  ...children(id("welcome"), [
    { id: id("welcome-intro"), type: "paragraph", content: text("This workspace is seeded with sample pages.") },
    {
      id: id("welcome-tip"),
      type: "paragraph",
      content: [
        { text: "Open " },
        { text: "Block showcase", marks: ["bold"] },
        { text: " to see every block type rendered." },
      ],
    },
  ]),
];

const showcase: Operation[] = [
  {
    op: "insert",
    block: { id: id("showcase"), type: "page", content: text("Block showcase") },
    parentId: null,
    afterId: id("welcome"),
  },
  ...children(id("showcase"), [
    { id: id("h1"), type: "heading", props: { level: 1 }, content: text("Headings") },
    { id: id("h2"), type: "heading", props: { level: 2 }, content: text("Second level") },
    { id: id("h3"), type: "heading", props: { level: 3 }, content: text("Third level") },
    { id: id("marks-heading"), type: "heading", props: { level: 1 }, content: text("Text and marks") },
    {
      id: id("marks"),
      type: "paragraph",
      content: [
        { text: "Plain, " },
        { text: "bold", marks: ["bold"] },
        { text: ", " },
        { text: "italic", marks: ["italic"] },
        { text: ", " },
        { text: "underline", marks: ["underline"] },
        { text: ", " },
        { text: "strikethrough", marks: ["strikethrough"] },
        { text: ", " },
        { text: "inline code", marks: ["code"] },
        { text: " and a " },
        { text: "link", marks: [{ type: "link", href: "https://github.com/wildchild04" }] },
        { text: "." },
      ],
    },
    { id: id("quote"), type: "quote", content: text("A quote block, for things worth repeating.") },
    { id: id("lists-heading"), type: "heading", props: { level: 1 }, content: text("Lists and todos") },
    { id: id("todo-done"), type: "todo", props: { checked: true }, content: text("A finished todo") },
    { id: id("todo-open"), type: "todo", props: { checked: false }, content: text("An open todo") },
    {
      id: id("bullet-1"),
      type: "bulleted_list_item",
      content: text("A bullet"),
      children: [{ id: id("bullet-1-1"), type: "bulleted_list_item", content: text("A nested bullet") }],
    },
    { id: id("bullet-2"), type: "bulleted_list_item", content: text("Another bullet") },
    { id: id("num-1"), type: "numbered_list_item", content: text("First") },
    { id: id("num-2"), type: "numbered_list_item", content: text("Second") },
    { id: id("num-break"), type: "paragraph", content: text("A paragraph restarts the numbering:") },
    { id: id("num-3"), type: "numbered_list_item", content: text("First again") },
    {
      id: id("toggle"),
      type: "toggle",
      content: text("A toggle with children"),
      children: [
        { id: id("toggle-1"), type: "paragraph", content: text("Toggle content is nested under it.") },
        { id: id("toggle-2"), type: "todo", content: text("Even todos") },
      ],
    },
    { id: id("divider"), type: "divider" },
    { id: id("pages-heading"), type: "heading", props: { level: 1 }, content: text("Pages and references") },
    {
      id: id("subpage"),
      type: "page",
      content: text("A sub-page"),
      children: [{ id: id("subpage-body"), type: "paragraph", content: text("Sub-pages are separate pages.") }],
    },
    { id: id("ref-page"), type: "reference", props: { targetId: id("welcome") } },
    { id: id("ref-block"), type: "reference", props: { targetId: id("welcome-tip") } },
    { id: id("doomed"), type: "paragraph", content: text("This block is deleted below.") },
    { id: id("ref-missing"), type: "reference", props: { targetId: id("doomed") } },
    { id: id("ref-cycle"), type: "reference", props: { targetId: id("showcase") } },
  ]),
  { op: "delete", id: id("doomed") },
];

/** The sample project: tasks of every kind and state, chores, comments and library documents. */
function seedProject(services: AppServices) {
  const projectId = "seed-project";
  const project = services.projects.create({ id: projectId, title: "Notion task manager" });
  const uid = () => crypto.randomUUID();
  const task = (kind: TaskKind, title: string, extra: Partial<CreateTaskInput> = {}) =>
    services.tasks.create({ id: uid(), projectId, kind, title, ...extra });
  const go = (taskId: string, ...names: string[]) => names.forEach((name) => services.tasks.transition(taskId, name));
  const agent = { kind: "agent", name: "builder" } as const;

  // Home page content.
  services.blocks.apply(
    children(project.homePageId, [
      { id: uid(), type: "paragraph", content: text("A Notion-style task manager: projects, tasks with lifecycles, and a knowledge library.") },
      { id: uid(), type: "todo", props: { checked: true }, content: text("Block model and projects") },
      { id: uid(), type: "todo", props: { checked: false }, content: text("Block editor") },
    ]),
  );

  // Knowledge library.
  const architecture = uid();
  services.blocks.apply(
    children(project.libraryRootId, [
      {
        id: architecture,
        type: "page",
        content: text("Architecture"),
        children: [
          { id: uid(), type: "paragraph", content: text("Domain, infrastructure and app layers.") },
          { id: uid(), type: "page", content: text("Persistence") },
          { id: uid(), type: "page", content: text("Unit of work") },
        ],
      },
      { id: uid(), type: "page", content: text("Conventions") },
    ]),
  );

  // Explorations: open, tombstoned, and one promoted to work.
  task("exploration", "Keyboard navigation between blocks");
  go(task("exploration", "Real-time collaboration").id, "tombstone");
  const editor = task("exploration", "Block editor library");
  services.tasks.transition(editor.id, "promote", { input: { workId: uid(), title: "Integrate the block editor" } });

  // Work in each state.
  go(task("work", "Project screens").id, "start");
  const oauth = task("work", "Sign in with OAuth");
  go(oauth.id, "start");
  services.tasks.transition(oauth.id, "return", {
    actor: agent,
    input: { reason: "The OAuth provider hasn't been chosen yet." },
  });
  const done = task("work", "Dashboard");
  go(done.id, "start", "complete");
  go(task("work", "Board view").id, "cancel");
  task("work", "Search");
  services.comments.add({
    id: uid(),
    taskId: oauth.id,
    blocks: [{ id: uid(), type: "paragraph", content: text("Leaning towards GitHub as the first provider.") }],
  });

  // An update iterating on the done work.
  task("update", "Dashboard: show overdue chores first", { iteratesOn: done.id });

  // Chores: recurring, overdue, marked urgent, and unscheduled.
  task("chore", "Update dependencies", {
    attributes: { schedule: { type: "frequency", every: "weekly", weekday: 1, time: "09:00" } },
  });
  task("chore", "Renew the TLS certificate", { attributes: { schedule: { type: "date", date: "2026-01-15", time: "09:00" } } });
  task("chore", "Fix the failing nightly build", { attributes: { urgency: "urgent" } });
  task("chore", "Tidy the knowledge library");
}

/** Seeds the workspace pages and the sample project, each only if missing. Returns what was added. */
export function seed(services: AppServices): { pages: boolean; project: boolean } {
  const pages = !services.blocks.getBlock(id("welcome"));
  if (pages) services.blocks.apply([...welcome, ...showcase]);
  const project = !services.projects.get("seed-project");
  if (project) seedProject(services);
  return { pages, project };
}
