# Notion task manager

Projects with explorations, work, updates and chores; a knowledge library and workspace pages edited as blocks; and an agent API with an MCP server so AI agents can work tasks.

## Development

```bash
npm install
npm run db:seed   # optional sample project
npm run dev       # http://localhost:5173
```

Settings come from the environment or `.env` (see `.env.example`): `DATABASE_PATH`, `CONTENT_PATH` (uploaded images, default `content` beside the database), `TIME_ZONE`, `AGENT_TOKEN`. `just` lists the shortcuts.

## Docker

The design system is installed from GitHub over SSH, so the build needs an SSH agent with access to it:

```bash
eval "$(ssh-agent -s)"
ssh-add ~/.ssh/<your-private-key>
just agent-token      # optional: enables the agent API, stored in .env
just docker-redeploy  # build and (re)start
```

The app is at `http://localhost:3002/task-manager/`. Its SQLite database lives in `./data` (mounted at `/app/data`), with uploaded images in `./data/content`; migrations run on startup. Back up both: `sqlite3 data/app.sqlite ".backup 'backup.sqlite'"` for the database, and a copy of `data/content/` (its files never change once written). Compose reads `TIME_ZONE` (default `America/Mexico_City`) and `AGENT_TOKEN` from `.env`; see `.env.docker.example`.

### Deploying by push

A machine running the app from a clone (`~/apps/task-manager` on the homelab) can deploy on push: `scripts/homelab-deploy.sh` is its `post-receive` hook, rebuilding and restarting the app when `main` arrives. The build uses the pusher's forwarded SSH agent for GitHub, so the SSH host needs `ForwardAgent`:

```ssh-config
Host homelab
	HostName 192.168.100.101
	User wild
	ForwardAgent yes
```

Then `just homelab-setup` (once) and `just deploy`, with your key loaded in an agent. The push waits for the build and prints it; a push is refused when the clone has local edits, and a failed build leaves the running version up.

### Behind a reverse proxy

The app is built to live under `APP_BASE_PATH` (default `/task-manager`; set it in `.env` and rebuild to change it). The proxy must forward the path with its prefix, so in Caddy use `handle`, not the prefix-stripping `handle_path`:

```caddyfile
example.home {
	handle /task-manager* {
		reverse_proxy localhost:3002
	}
}
```

The server (`server.mjs`) trusts `X-Forwarded-Proto` from proxies on loopback and private networks (`TRUST_PROXY` overrides it, as Express's `trust proxy`). Without that, form posts through an HTTPS proxy are refused as cross-site.

Open tabs refresh themselves from a Server-Sent Events stream, `/api/changes`. Caddy passes it through as is (it flushes event streams at once and has no response timeout), but a proxy that buffers responses would hold events back. After deploying, check it through the proxy: `curl -N https://192.168.100.101/task-manager/api/changes` should print `event: hello` at once, and an `event: change` when something is edited.

For local development `npm run dev` stays at the root; `APP_BASE_PATH=/task-manager npm run build && npm start` runs a production build under the prefix.

## Agents

See [`mcp/README.md`](mcp/README.md). Point `APP_URL` at the running app including its base path (for Docker, `http://localhost:3002/task-manager`, or the proxy's URL).
