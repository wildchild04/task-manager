import { CodeBlock, Container, Link, Stack, Typography } from "@wildchild/design-system";

export function ErrorPage({ title, message, details }: { title: string; message: string; details?: string }) {
  return (
    <Container maxWidth="md">
      <Stack spacing={2}>
        <Typography variant="h1">{title}</Typography>
        <Typography>{message}</Typography>
        {details && <CodeBlock code={details} variant="output" />}
        <Link href="/">Back to home</Link>
      </Stack>
    </Container>
  );
}
