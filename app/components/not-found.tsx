import { Link, Stack, Typography } from "@wildchild/design-system";
import { Link as RouterLink } from "react-router";

export function NotFound() {
  return (
    <Stack spacing={2}>
      <Typography variant="h1">Not found</Typography>
      <Typography>This page does not exist.</Typography>
      <Link component={RouterLink} to="/">
        Back to the workspace
      </Link>
    </Stack>
  );
}
