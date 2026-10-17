import { Container, PageNavigation, PageShell, Stack, ThemeToggle, Typography } from "@wildchild/design-system";
import type { MouseEvent } from "react";
import { Outlet, type ShouldRevalidateFunctionArgs, useNavigate } from "react-router";

import { LibraryTree } from "../components/library-tree";
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

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Stack spacing={0.5}>
      <Typography variant="overline" color="text.secondary">
        {label}
      </Typography>
      {children}
    </Stack>
  );
}

export default function Shell({ loaderData }: Route.ComponentProps) {
  const { projects, current, pages } = loaderData;
  const { mode, setMode } = useThemeMode();
  const navigate = useNavigate();
  const go = (href: string) => (event: MouseEvent) => {
    event.preventDefault();
    void navigate(href);
  };
  const item = (label: string, href: string, active: boolean) => ({ label, href, active, onClick: go(href) });

  const navigation = (
    <Stack spacing={2}>
      <Group label="Projects">
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
            <LibraryTree
              key={current.id}
              ariaLabel={`${current.title} knowledge library`}
              nodes={current.library}
              activePageId={current.activePageId}
            />
          )}
        </Group>
      )}
      {pages.length > 0 && (
        <Group label="Pages">
          <PageNavigation ariaLabel="Workspace pages" items={pages.map((p) => item(p.title, `/pages/${p.id}`, false))} />
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
      <Container maxWidth="lg">
        <Outlet />
      </Container>
    </PageShell>
  );
}
