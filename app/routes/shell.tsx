import { Container, IconButton, Link, PageNavigation, PageShell, Stack, ThemeToggle, Typography } from "@wildchild/design-system";
import { type MouseEvent, useEffect, useState } from "react";
import { Link as RouterLink, Outlet, type ShouldRevalidateFunctionArgs, useLocation, useNavigate } from "react-router";

import { DeletePageButton, NavigationDeleteWatcher } from "../components/delete-page";
import { NewProjectDialog } from "../components/new-project-dialog";
import { PageTree } from "../components/page-tree";
import { services } from "../lib/services.server";
import { type ProjectSection, shellView } from "../lib/shell.server";
import { useThemeMode } from "../theme-mode";
import type { Route } from "./+types/shell";

export function loader({ request }: Route.LoaderArgs) {
  return shellView(services, new URL(request.url).pathname);
}

/** The current project and section come from the URL, so recompute on every navigation. */
export function shouldRevalidate({ currentUrl, nextUrl, defaultShouldRevalidate }: ShouldRevalidateFunctionArgs) {
  return currentUrl.pathname !== nextUrl.pathname || defaultShouldRevalidate;
}

const SECTIONS: { section: ProjectSection; label: string; path: string }[] = [
  { section: "home", label: "Home", path: "" },
  { section: "explorations", label: "Explorations", path: "/explorations" },
  { section: "updates", label: "Updates", path: "/updates" },
  { section: "work", label: "Work", path: "/work" },
  { section: "chores", label: "Chores", path: "/chores" },
  { section: "library", label: "Knowledge library", path: "/library" },
];

/** A navigation group: its heading (a link when `href` is given), an optional action beside it, and its items. */
function Group({
  label,
  href,
  action,
  children,
}: {
  label: string;
  href?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  const heading = (
    <Typography variant="overline" color="text.secondary">
      {label}
    </Typography>
  );
  return (
    <Stack spacing={0.5}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        {href ? (
          <Link component={RouterLink} to={href} underline="hover" color="inherit">
            {heading}
          </Link>
        ) : (
          heading
        )}
        {action}
      </Stack>
      {children}
    </Stack>
  );
}

export default function Shell({ loaderData }: Route.ComponentProps) {
  const { projects, current, pages } = loaderData;
  const { mode, setMode } = useThemeMode();
  const navigate = useNavigate();
  const [creatingProject, setCreatingProject] = useState(false);
  // Creating a project redirects to it; the dialog lives in the shell, so close it once the page changes.
  const { pathname } = useLocation();
  useEffect(() => setCreatingProject(false), [pathname]);
  // The page being viewed, if any: deleting it (or a page containing it) from here leaves it.
  const openPageId = /^\/pages\/([^/]+)/.exec(pathname)?.[1] ?? null;
  const go = (href: string) => (event: MouseEvent) => {
    event.preventDefault();
    void navigate(href);
  };
  const item = (label: string, href: string, active: boolean) => ({ label, href, active, onClick: go(href) });

  const navigation = (
    <Stack spacing={2}>
      <Group
        label="Projects"
        href="/"
        action={<IconButton ariaLabel="New project" icon="add" size="small" onClick={() => setCreatingProject(true)} />}
      >
        {projects.length > 0 ? (
          <PageNavigation
            ariaLabel="Projects"
            items={projects.map((p) => item(p.title, `/projects/${p.id}`, p.id === current?.id))}
          />
        ) : (
          <Typography variant="body2" color="text.secondary">
            No projects yet
          </Typography>
        )}
      </Group>
      {current && (
        <Group label={current.title}>
          <PageNavigation
            ariaLabel={`${current.title} sections`}
            items={SECTIONS.map((s) => item(s.label, `/projects/${current.id}${s.path}`, s.section === current.section))}
          />
          {current.library.length > 0 && (
            <PageTree
              key={current.id}
              ariaLabel={`${current.title} knowledge library`}
              nodes={current.library}
              activePageId={current.activePageId}
              action={(node) => <DeletePageButton key={node.id} pageId={node.id} openPageId={openPageId} size="small" />}
            />
          )}
        </Group>
      )}
      {pages.length > 0 && (
        <Group label="Pages">
          <PageTree
            ariaLabel="Workspace pages"
            nodes={pages}
            activePageId={openPageId}
            action={(node) => <DeletePageButton key={node.id} pageId={node.id} openPageId={openPageId} size="small" />}
          />
        </Group>
      )}
    </Stack>
  );

  return (
    <PageShell
      title="Workspace"
      navigation={navigation}
      navigationLabel="Workspace navigation"
      actions={<ThemeToggle mode={mode} onModeChange={setMode} ariaLabel="Toggle dark mode" />}
    >
      <NavigationDeleteWatcher />
      {/* Rendered once, outside the navigation (which is drawn twice: sidebar and mobile drawer). */}
      <NewProjectDialog open={creatingProject} onClose={() => setCreatingProject(false)} />
      <Container maxWidth="lg">
        <Outlet />
      </Container>
    </PageShell>
  );
}
