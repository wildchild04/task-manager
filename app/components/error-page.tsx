import { CodeBlock, Container, Link, Stack, Typography } from "@wildchild/design-system";

import { withBase } from "../lib/base-path";

export function ErrorPage({ title, message, details }: { title: string; message: string; details?: string }) {
  return (
    <Container maxWidth="md">
      <Stack spacing={2}>
        <Typography variant="h1">{title}</Typography>
        <Typography>{message}</Typography>
        {details && <CodeBlock code={details} variant="output" />}
        {/* A full page load, under the base path (/task-manager on the homelab): after an error, start clean. */}
        <Link href={withBase("/")}>Back to home</Link>
      </Stack>
    </Container>
  );
}
