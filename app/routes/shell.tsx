import { Container, PageNavigation, PageShell, ThemeToggle } from "@wildchild/design-system";
import { Outlet, useNavigate, useParams } from "react-router";

import { plainText } from "../blocks/view-model";
import { services } from "../lib/services.server";
import { useThemeMode } from "../theme-mode";
import type { Route } from "./+types/shell";

export async function loader() {
  const pages = await services.blocks.listRootPages();
  return { pages: pages.map((page) => ({ id: page.id, title: plainText(page.content) || "Untitled" })) };
}

export default function Shell({ loaderData }: Route.ComponentProps) {
  const { mode, setMode } = useThemeMode();
  const navigate = useNavigate();
  const { pageId } = useParams();

  const navigation = (
    <PageNavigation
      ariaLabel="Workspace pages"
      items={loaderData.pages.map((page) => ({
        label: page.title,
        href: `/pages/${page.id}`,
        active: page.id === pageId,
        onClick: (event) => {
          event.preventDefault();
          void navigate(`/pages/${page.id}`);
        },
      }))}
    />
  );

  return (
    <PageShell
      title="Workspace"
      navigation={navigation}
      navigationLabel="Workspace pages"
      actions={<ThemeToggle mode={mode} onModeChange={setMode} ariaLabel="Toggle dark mode" />}
    >
      <Container maxWidth="md">
        <Outlet />
      </Container>
    </PageShell>
  );
}
