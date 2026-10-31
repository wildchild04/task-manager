import {
  Alert,
  Button,
  Card,
  Dialog,
  List,
  Stack,
  TextField,
  Typography,
} from "@wildchild/design-system";
import { useEffect, useRef, useState } from "react";
import { useFetcher } from "react-router";

import {
  type AgentRow,
  settingsAction,
  type SettingsResult,
  settingsView,
} from "../lib/account.server";
import { services } from "../lib/services.server";
import type { Route } from "./+types/settings";

export function meta() {
  return [{ title: "Settings" }];
}

export function loader() {
  return settingsView(services);
}

export async function action({ request }: Route.ActionArgs) {
  return settingsAction(services, request, await request.formData());
}

/** A field's error from a settings form, when it's the one that was sent. */
function fieldError(
  result: SettingsResult | undefined,
  intent: string,
  name: string,
) {
  if (!result || result.ok || result.intent !== intent) return {};
  const message = result.fieldErrors[name];
  return message ? { error: true, helperText: message } : {};
}

function ChangePassword() {
  const fetcher = useFetcher<SettingsResult>();
  const form = useRef<HTMLFormElement>(null);
  const result = fetcher.state === "idle" ? fetcher.data : undefined;
  useEffect(() => {
    if (result?.ok) form.current?.reset();
  }, [result]);
  return (
    <fetcher.Form method="post" ref={form}>
      <input type="hidden" name="intent" value="change-password" />
      <Stack spacing={2}>
        <TextField
          name="current"
          label="Current password"
          type="password"
          autoComplete="current-password"
          required
          fullWidth
          {...fieldError(result, "change-password", "current")}
        />
        <TextField
          name="password"
          label="New password"
          type="password"
          autoComplete="new-password"
          required
          fullWidth
          helperText="At least 12 characters"
          {...fieldError(result, "change-password", "password")}
        />
        <TextField
          name="confirm"
          label="Confirm new password"
          type="password"
          autoComplete="new-password"
          required
          fullWidth
          {...fieldError(result, "change-password", "confirm")}
        />
        {result?.ok && (
          <Alert severity="success" role="status">
            {result.message}
          </Alert>
        )}
        <Stack direction="row">
          <Button type="submit" disabled={fetcher.state !== "idle"}>
            Change password
          </Button>
        </Stack>
      </Stack>
    </fetcher.Form>
  );
}

/** Shows a newly registered agent's token, once, with the line for an MCP profile. */
function TokenDialog({
  name,
  token,
  onClose,
}: {
  name: string;
  token: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const line = `AGENT_TOKEN=${token}`;
  return (
    <Dialog
      open
      title={`${name}'s token`}
      onClose={onClose}
      confirmAction={{ label: "Done", onClick: onClose }}
      cancelAction={{
        label: copied ? "Copied" : "Copy",
        onClick: () =>
          void navigator.clipboard?.writeText(line).then(() => setCopied(true)),
      }}
    >
      <Stack spacing={1.5}>
        <Typography>
          Put this line in the agent's MCP profile. It won't be shown again.
        </Typography>
        <code className="agent-token">{line}</code>
      </Stack>
    </Dialog>
  );
}

function RevokeButton({ agent }: { agent: AgentRow }) {
  const fetcher = useFetcher<SettingsResult>();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        size="small"
        variant="outlined"
        color="error"
        onClick={() => setOpen(true)}
      >
        Revoke
      </Button>
      {open && (
        <Dialog
          open
          title={`Revoke ${agent.name}'s token?`}
          onClose={() => setOpen(false)}
          cancelAction={{ label: "Cancel", onClick: () => setOpen(false) }}
          confirmAction={{
            label: "Revoke",
            color: "error",
            disabled: fetcher.state !== "idle",
            onClick: () =>
              void fetcher.submit(
                { intent: "revoke-agent", id: agent.id },
                { method: "post" },
              ),
          }}
        >
          <Typography>{`${agent.name} stops working at once. You can register it again with a new token.`}</Typography>
        </Dialog>
      )}
    </>
  );
}

function Agents({ agents }: { agents: AgentRow[] }) {
  const fetcher = useFetcher<SettingsResult>();
  const form = useRef<HTMLFormElement>(null);
  const [shown, setShown] = useState<{ name: string; token: string } | null>(
    null,
  );
  const result = fetcher.state === "idle" ? fetcher.data : undefined;
  useEffect(() => {
    if (result?.ok && result.token && result.name) {
      setShown({ name: result.name, token: result.token });
      form.current?.reset();
    }
  }, [result]);

  return (
    <Stack spacing={2}>
      <Typography variant="body2" color="text.secondary">
        Each agent calls the app with its own token, which decides its name.
        Revoke a token to stop that agent.
      </Typography>
      {agents.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No agents yet.
        </Typography>
      ) : (
        <List
          dense
          items={agents.map((agent) => ({
            id: agent.id,
            primary: agent.name,
            secondary: `${agent.prefix}… · registered ${agent.registered} · ${agent.lastUsed}`,
            action: <RevokeButton agent={agent} />,
          }))}
        />
      )}
      <fetcher.Form method="post" ref={form}>
        <input type="hidden" name="intent" value="register-agent" />
        <Stack direction="row" spacing={1} alignItems="flex-start">
          <TextField
            name="name"
            label="Agent name"
            size="small"
            required
            {...fieldError(result, "register-agent", "name")}
          />
          <Button
            type="submit"
            variant="outlined"
            disabled={fetcher.state !== "idle"}
          >
            Register agent
          </Button>
        </Stack>
      </fetcher.Form>
      {shown && (
        <TokenDialog
          name={shown.name}
          token={shown.token}
          onClose={() => setShown(null)}
        />
      )}
    </Stack>
  );
}

export default function Settings({ loaderData }: Route.ComponentProps) {
  const { email, agents } = loaderData;
  return (
    <Stack spacing={3}>
      <Typography variant="h1">Settings</Typography>
      <Card variant="outlined" title="Account">
        <Stack spacing={2}>
          <Typography>{`Signed in as ${email}`}</Typography>
          <ChangePassword />
        </Stack>
      </Card>
      <Card variant="outlined" title="Agents">
        <Agents agents={agents} />
      </Card>
    </Stack>
  );
}
