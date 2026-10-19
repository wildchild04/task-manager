import {
  Alert,
  Button,
  Card,
  Chip,
  InlineCode,
  Link,
  List,
  ResponsivePanelGrid,
  Stack,
  Typography,
} from "@wildchild/design-system";
import { useState } from "react";
import { Link as RouterLink, useNavigate } from "react-router";

import { NewPageDialog } from "../components/new-page-dialog";
import { NewProjectDialog } from "../components/new-project-dialog";
import { PageTree } from "../components/page-tree";
import { type AttentionItem, homeView, type ProjectCard, type RecentItem, type ReviewItem } from "../lib/home.server";
import { services } from "../lib/services.server";
import type { Route } from "./+types/home";

export function meta() {
  return [{ title: "Home" }];
}

export function loader() {
  return homeView(services);
}

const titleLink = (title: string, href: string) => (
  <Link component={RouterLink} to={href} variant="standalone">
    {title}
  </Link>
);

function NeedsAttention({ items, more }: { items: AttentionItem[]; more: number }) {
  return (
    <Card variant="outlined" title="Needs attention">
      {items.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          Nothing urgent, returned or in progress.
        </Typography>
      ) : (
        <Stack spacing={1}>
          <List
            dense
            items={items.map((item) => ({
              id: item.id,
              primary: titleLink(item.title, item.href),
              secondary: item.project,
              action: <Chip label={item.reason} color={item.tone} size="small" variant="outlined" />,
            }))}
          />
          {more > 0 && (
            <Typography variant="body2" color="text.secondary">
              {`and ${more} more`}
            </Typography>
          )}
        </Stack>
      )}
    </Card>
  );
}

const count = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Pages and tasks where agents' suggestions wait for a decision; shown only when there are some. */
function WaitingForReview({ items }: { items: ReviewItem[] }) {
  if (items.length === 0) return null;
  return (
    <Card variant="outlined" title="Waiting for review">
      <List
        dense
        items={items.map((item) => ({
          id: item.id,
          primary: titleLink(item.title, item.href),
          secondary: `${item.place} · ${item.agents.join(", ")}`,
          action: <Chip label={count(item.count, "suggestion")} color="warning" size="small" variant="outlined" />,
        }))}
      />
    </Card>
  );
}

function Projects({ projects, onNew }: { projects: ProjectCard[]; onNew: () => void }) {
  const navigate = useNavigate();
  if (projects.length === 0) {
    return (
      <Alert severity="info" role="status" title="No projects yet">
        <Stack spacing={1} alignItems="flex-start">
          <span>
            Create a project to start, or run <InlineCode>npm run db:seed</InlineCode> for a sample project.
          </span>
          <Button size="small" onClick={onNew}>
            New project
          </Button>
        </Stack>
      </Alert>
    );
  }
  return (
    <ResponsivePanelGrid columns={{ xs: 1, sm: 2 }}>
      {projects.map((project) => (
        <Card
          key={project.id}
          title={project.title}
          variant="outlined"
          interactive
          hoverFeedback="tint"
          onClick={() => void navigate(`/projects/${project.id}`)}
        >
          <Stack direction="row" spacing={1} useFlexGap wrap="wrap">
            <Chip label={`${count(project.activeWork, "active work", "active work")}`} size="small" variant="outlined" />
            <Chip label={count(project.openIdeas, "open idea")} size="small" variant="outlined" color="info" />
            {project.urgentChores > 0 && <Chip label={count(project.urgentChores, "urgent chore")} size="small" color="error" />}
          </Stack>
        </Card>
      ))}
    </ResponsivePanelGrid>
  );
}

function RecentlyEdited({ items }: { items: RecentItem[] }) {
  return (
    <Card variant="outlined" title="Recently edited">
      {items.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          Nothing yet.
        </Typography>
      ) : (
        <List
          dense
          items={items.map((item) => ({
            id: item.id,
            primary: titleLink(item.title, item.href),
            secondary: `${item.place} · ${item.edited}`,
          }))}
        />
      )}
    </Card>
  );
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { review, attention, projects, pages, recent } = loaderData;
  const [creating, setCreating] = useState<"page" | "project" | null>(null);

  return (
    <Stack spacing={3}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
        <Typography variant="h1">Home</Typography>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" onClick={() => setCreating("page")}>
            New page
          </Button>
          <Button onClick={() => setCreating("project")}>New project</Button>
        </Stack>
      </Stack>

      <ResponsivePanelGrid columns={{ xs: 1, md: 2 }}>
        <Stack spacing={3}>
          <WaitingForReview items={review} />
          <NeedsAttention items={attention.items} more={attention.more} />
          <Stack spacing={1}>
            <Typography variant="h5">Projects</Typography>
            <Projects projects={projects} onNew={() => setCreating("project")} />
          </Stack>
        </Stack>
        <Stack spacing={3}>
          <Card variant="outlined" title="Pages">
            {pages.length === 0 ? (
              <Stack spacing={1} alignItems="flex-start">
                <Typography variant="body2" color="text.secondary">
                  No pages yet.
                </Typography>
                <Button size="small" variant="outlined" onClick={() => setCreating("page")}>
                  New page
                </Button>
              </Stack>
            ) : (
              <PageTree ariaLabel="Pages" nodes={pages} activePageId={null} />
            )}
          </Card>
          <RecentlyEdited items={recent} />
        </Stack>
      </ResponsivePanelGrid>

      <NewProjectDialog open={creating === "project"} onClose={() => setCreating(null)} />
      <NewPageDialog open={creating === "page"} onClose={() => setCreating(null)} />
    </Stack>
  );
}
