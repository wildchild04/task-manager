# Notion task manager

Projects with explorations, work, updates and chores; a knowledge library and workspace pages edited as blocks; and an agent API with an MCP server so AI agents can work tasks.

## Development

```bash
npm install
npm run db:seed   # optional sample project
npm run dev       # http://localhost:5173
```

Settings come from the environment or `.env` (see `.env.example`): `DATABASE_PATH`, `TIME_ZONE`, `AGENT_TOKEN`. `just` lists the shortcuts.

## Docker

The design system is installed from GitHub over SSH, so the build needs an SSH agent with access to it:

```bash
eval "$(ssh-agent -s)"
ssh-add ~/.ssh/<your-private-key>
just agent-token      # optional: enables the agent API, stored in .env
just docker-redeploy  # build and (re)start
```

The app is at `http://localhost:3002/task-manager/`. Its SQLite database lives in `./data` (mounted at `/app/data`); migrations run on startup. Compose reads `TIME_ZONE` (default `America/Mexico_City`) and `AGENT_TOKEN` from `.env`; see `.env.docker.example`.

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

For local development `npm run dev` stays at the root; `APP_BASE_PATH=/task-manager npm run build && npm start` runs a production build under the prefix.

## Agents

See [`mcp/README.md`](mcp/README.md). Point `APP_URL` at the running app including its base path (for Docker, `http://localhost:3002/task-manager`, or the proxy's URL).
