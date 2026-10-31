import {
  Alert,
  Card,
  Container,
  Stack,
  Typography,
} from "@wildchild/design-system";
import type { ReactNode } from "react";

/** The frame of the sign-in screens: a title, an explanation, a form error and the form. */
export function AuthCard({
  title,
  intro,
  error,
  children,
}: {
  title: string;
  intro: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <Container maxWidth="xs">
      <div className="auth-screen">
        <Stack spacing={3}>
          <Typography variant="h1">{title}</Typography>
          <Card variant="outlined">
            <Stack spacing={2}>
              <Typography variant="body2" color="text.secondary">
                {intro}
              </Typography>
              {error && (
                <Alert severity="error" role="alert">
                  {error}
                </Alert>
              )}
              {children}
            </Stack>
          </Card>
        </Stack>
      </div>
    </Container>
  );
}
