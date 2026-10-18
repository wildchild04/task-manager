import { Card, Link, List } from "@wildchild/design-system";
import { Link as RouterLink } from "react-router";

import type { Backlink } from "../lib/backlinks.server";

const times = (count: number) => (count === 1 ? "" : ` · ${count} times`);

/** The pages and tasks that mention or reference this page. Nothing is shown when there are none. */
export function Backlinks({ backlinks }: { backlinks: Backlink[] }) {
  if (backlinks.length === 0) return null;
  return (
    <Card variant="outlined" title="Mentioned in">
      <List
        dense
        items={backlinks.map((link) => ({
          id: `${link.kind}:${link.id}`,
          primary: (
            <Link component={RouterLink} to={link.href} variant="standalone">
              {link.title}
            </Link>
          ),
          secondary: `${link.kind === "task" ? `Task · ${link.taskKind}` : "Page"}${times(link.count)}`,
        }))}
      />
    </Card>
  );
}
