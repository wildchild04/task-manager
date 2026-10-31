import { Button, Stack, TextField } from "@wildchild/design-system";
import { data, Form, redirect, useNavigation } from "react-router";

import { AuthCard } from "../components/auth-card";
import { loginAction } from "../lib/account.server";
import { safeNext, signInThrottle } from "../lib/auth.server";
import { services } from "../lib/services.server";
import { signedInContext } from "../root";
import type { Route } from "./+types/login";

export function meta() {
  return [{ title: "Sign in" }];
}

/** Already signed in: go where sign-in would have gone. */
export function loader({ request, context }: Route.LoaderArgs) {
  if (context.get(signedInContext))
    throw redirect(safeNext(new URL(request.url).searchParams.get("next")));
  return null;
}

export async function action({ request }: Route.ActionArgs) {
  const result = await loginAction(
    services,
    request,
    await request.formData(),
    signInThrottle,
  );
  if ("redirectTo" in result)
    throw redirect(result.redirectTo, {
      headers: { "Set-Cookie": result.setCookie },
    });
  return data(result, { status: 400 });
}

export default function Login({ actionData }: Route.ComponentProps) {
  const busy = useNavigation().state !== "idle";
  return (
    <AuthCard
      title="Sign in"
      intro="Sign in to the task manager."
      error={actionData?.formError}
    >
      <Form method="post">
        <Stack spacing={2}>
          <TextField
            name="email"
            label="Email"
            type="email"
            autoComplete="username"
            required
            fullWidth
            defaultValue={actionData?.values.email}
          />
          <TextField
            name="password"
            label="Password"
            type="password"
            autoComplete="current-password"
            required
            fullWidth
          />
          <Button type="submit" disabled={busy}>
            Sign in
          </Button>
        </Stack>
      </Form>
    </AuthCard>
  );
}
