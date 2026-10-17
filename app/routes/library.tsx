import { Alert, Button, Link, Select, Stack, TextField, Typography } from "@wildchild/design-system";
import { useState } from "react";
import { data, Link as RouterLink, useFetcher } from "react-router";

import { fieldError, FormDialog, lastValue } from "../components/form-dialog";
import { NotFound } from "../components/not-found";
import type { LibraryNode } from "~/domain/library/library.service";
import type { ActionResult } from "../lib/forms.server";
import { createDocumentAction, libraryView } from "../lib/library.server";
import { services } from "../lib/services.server";
import type { Route } from "./+types/library";

export function loader({ params }: Route.LoaderArgs) {
  const view = libraryView(services, params.projectId);
  return view ? { view } : data({ view: null }, { status: 404 });
}

export async function action({ params, request }: Route.ActionArgs) {
  return createDocumentAction(services, params.projectId, await request.formData());
}

export function meta({ data }: Route.MetaArgs) {
  return [{ title: data?.view ? `Knowledge library · ${data.view.project.title}` : "Not found" }];
}

/** The library tree as nested links, until the design system has a tree component (feature-requests/tree-navigation.md). */
function Tree({ nodes }: { nodes: LibraryNode[] }) {
  return (
    <ul className="block-list library-tree">
      {nodes.map((node) => (
        <li key={node.id}>
          <Link component={RouterLink} to={`/pages/${node.id}`} variant="standalone">
            {node.title || "Untitled"}
          </Link>
          {node.children.length > 0 && <Tree nodes={node.children} />}
        </li>
      ))}
    </ul>
  );
}

export default function Library({ loaderData }: Route.ComponentProps) {
  const { view } = loaderData;
  const [creating, setCreating] = useState(false);
  const fetcher = useFetcher<ActionResult>();
  if (!view) return <NotFound />;

  return (
    <Stack spacing={2}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="h1">Knowledge library</Typography>
        <Button onClick={() => setCreating(true)}>New document</Button>
      </Stack>
      {view.tree.length === 0 ? (
        <Alert severity="info" role="status">
          This library has no documents yet.
        </Alert>
      ) : (
        <Tree nodes={view.tree} />
      )}

      <FormDialog open={creating} title="New document" confirmLabel="Create" fetcher={fetcher} onClose={() => setCreating(false)}>
        <TextField name="title" label="Title" required fullWidth defaultValue={lastValue(fetcher.data, "title")} {...fieldError(fetcher.data, "title")} />
        <Select
          name="parentId"
          label="Inside"
          fullWidth
          defaultValue={lastValue(fetcher.data, "parentId") ?? ""}
          options={[
            { value: "", label: "Top level" },
            ...view.parents.map((p) => ({ value: p.id, label: `${"— ".repeat(p.depth)}${p.title}` })),
          ]}
          {...fieldError(fetcher.data, "parentId")}
        />
      </FormDialog>
    </Stack>
  );
}
