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

The app is at `http://localhost:3002`. Its SQLite database lives in `./data` (mounted at `/app/data`); migrations run on startup. Compose reads `TIME_ZONE` (default `America/Mexico_City`) and `AGENT_TOKEN` from `.env`; see `.env.docker.example`.

The app expects to be served at the root of its host (links stored in pages are absolute paths), so put a proxy in front of the port rather than under a sub-path.

## Agents

See [`mcp/README.md`](mcp/README.md). Point `APP_URL` at the running app (for Docker, `http://localhost:3002`).
