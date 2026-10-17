import { Alert, InlineCode, Link, Stack, Typography } from "@wildchild/design-system";
import { Link as RouterLink, useRouteLoaderData } from "react-router";

import type { PageLink } from "../blocks/view-model";

export function meta() {
  return [{ title: "Workspace" }];
}

export default function Home() {
  const shell = useRouteLoaderData<{ pages: PageLink[] }>("routes/shell");
  const pages = shell?.pages ?? [];

  return (
    <Stack spacing={2}>
      <Typography variant="h1">Workspace</Typography>
      {pages.length === 0 ? (
        <Alert severity="info" role="status" title="No pages yet">
          Run <InlineCode>npm run db:seed</InlineCode> to create sample pages, then reload.
        </Alert>
      ) : (
        <Stack spacing={1}>
          {pages.map((page) => (
            <Link key={page.id} component={RouterLink} to={`/pages/${page.id}`} variant="standalone">
              {page.title}
            </Link>
          ))}
        </Stack>
      )}
    </Stack>
  );
}
