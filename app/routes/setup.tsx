import { Button, Stack, TextField } from "@wildchild/design-system";
import { data, Form, redirect, useNavigation } from "react-router";

import { AuthCard } from "../components/auth-card";
import { setupAction } from "../lib/account.server";
import { services } from "../lib/services.server";
import type { Route } from "./+types/setup";

export function meta() {
  return [{ title: "Create your account" }];
}

/** Creates the owner's account and signs in; the root middleware keeps this open only while there's none. */
export async function action({ request }: Route.ActionArgs) {
  const result = setupAction(services, request, await request.formData());
  if ("redirectTo" in result)
    throw redirect(result.redirectTo, {
      headers: { "Set-Cookie": result.setCookie },
    });
  return data(result, { status: 400 });
}

export default function Setup({ actionData }: Route.ComponentProps) {
  const busy = useNavigation().state !== "idle";
  const error = (name: string) => {
    const message = actionData?.fieldErrors[name];
    return message ? { error: true, helperText: message } : {};
  };
  return (
    <AuthCard
      title="Create your account"
      intro="This app has no account yet. The one you create here owns everything in it; you'll sign in with it from now on."
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
            {...error("email")}
          />
          <TextField
            name="password"
            label="Password"
            type="password"
            autoComplete="new-password"
            required
            fullWidth
            helperText="At least 12 characters"
            {...error("password")}
          />
          <TextField
            name="confirm"
            label="Confirm password"
            type="password"
            autoComplete="new-password"
            required
            fullWidth
            {...error("confirm")}
          />
          <Button type="submit" disabled={busy}>
            Create account
          </Button>
        </Stack>
      </Form>
    </AuthCard>
  );
}
