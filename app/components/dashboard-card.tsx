import { Card, Chip, Link, Stack, Typography } from "@wildchild/design-system";
import { Link as RouterLink } from "react-router";

import type { DashboardCardView } from "../lib/projects.server";

/** One dashboard section: its count, and its items linking to tasks or pages. */
export function DashboardCard({ card }: { card: DashboardCardView }) {
  return (
    <Card
      title={card.title}
      variant="outlined"
      fullHeight
      headerAction={<Chip label={card.count} size="small" variant="outlined" color={card.count > 0 ? "primary" : "secondary"} />}
    >
      {card.items.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          Nothing here
        </Typography>
      ) : (
        <Stack spacing={1}>
          {card.items.map((item) => (
            <Stack key={item.id} spacing={0.25}>
              <Stack direction="row" spacing={1} alignItems="center" wrap="wrap">
                <Link component={RouterLink} to={item.href} variant="standalone">
                  {item.title}
                </Link>
                {item.urgent && <Chip label="Urgent" size="small" color="error" />}
              </Stack>
              {item.due && (
                <Typography variant="caption" color="text.secondary">
                  {`Due ${item.due}`}
                </Typography>
              )}
            </Stack>
          ))}
          {card.count > card.items.length && (
            <Typography variant="caption" color="text.secondary">
              {`and ${card.count - card.items.length} more`}
            </Typography>
          )}
        </Stack>
      )}
    </Card>
  );
}
