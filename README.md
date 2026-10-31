# Notion task manager

Projects with explorations, work, updates and chores; a knowledge library and workspace pages edited as blocks; and an agent API with an MCP server so AI agents can work tasks.

## Development

```bash
npm install
npm run db:seed   # optional sample project
npm run dev       # http://localhost:5173
```

Settings come from the environment or `.env` (see `.env.example`): `DATABASE_PATH`, `CONTENT_PATH` (uploaded images, default `content` beside the database), `TIME_ZONE`. `just` lists the shortcuts.

## Account

Everything needs signing in. The first visit, while there's no account, offers **Create your account** (an email and a password of at least 12 characters); that account owns everything in the app. Settings (the account menu at the top right) changes the password and registers agents. With `SECRET_KEY` set (`just secret-key` adds one to `.env`; at least 32 characters), agents' tokens are kept encrypted so Settings can show one again after your password, and `just account token <name>` prints it; keep the key out of backups of `data/`. Locked out: `just account password` sets a new password from the command line (inside the container when it's running) and signs out every browser.

## Vim mode

On desktop browsers, the terminal button in the header turns Vim mode on for page and task description editors (not titles or comments). It's off by default and remembered per browser, in local storage. The mode shows at the editor's bottom right.

| Mode | Keys |
|---|---|
| Normal | `h j k l` (and the arrows), `w b e`, `0 ^ $`, `gg G` (within the cursor's block), counts (`3w`, `2dd`) |
| | `i a I A o O` to Insert; `v` to Visual |
| | `x`, `dw`, `d$`, `cw`, `cc`, `dd`, `yy`, `p`, `P`; `u` and `Ctrl-r` to undo and redo |
| | Space is the leader: `Space /` the slash menu, `Space @` the mention menu, `Space Esc` selects the block |
| Insert | the editor as usual; `Esc` closes an open menu, then returns to Normal |
| Visual | motions extend the selection, across blocks too; `d`/`x`, `c`, `y` (also to the clipboard); `Esc` or `v` to leave |

Shortcuts with Ctrl or Cmd (bold, links, turn into, undo) work in every mode. `j`/`k` stop at images like ↓/↑, and go on from them. `?` in Normal mode, or a click on the mode indicator, lists the keys in the app.

## Docker

The design system is installed from GitHub over SSH, so the build needs an SSH agent with access to it:

```bash
eval "$(ssh-agent -s)"
ssh-add ~/.ssh/<your-private-key>
just docker-redeploy  # build and (re)start
```

The app is at `http://localhost:3002/task-manager/`. Its SQLite database lives in `./data` (mounted at `/app/data`), with uploaded images in `./data/content`; migrations run on startup. Back up both: `sqlite3 data/app.sqlite ".backup 'backup.sqlite'"` for the database, and a copy of `data/content/` (its files never change once written). Compose reads `TIME_ZONE` (default `America/Mexico_City`) from `.env`; see `.env.docker.example`.

### Deploying by push

A machine running the app from a clone (`~/apps/task-manager` on the homelab) can deploy on push: `scripts/homelab-deploy.sh` is its `post-receive` hook, rebuilding and restarting the app when `main` arrives. The build fetches the design system from GitHub with the homelab's own key, `~/.ssh/design-system-deploy` (no passphrase), added to the design system repository as a read-only deploy key; a forwarded SSH agent is used instead when there is one. The SSH host for pushing:

```ssh-config
Host homelab
	HostName 192.168.100.101
	User wild
```

Then `just homelab-setup` (once) and `just deploy`. The push waits for the build and prints it; a push is refused when the clone has local edits, and a failed build leaves the running version up.

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

Each agent has its own token, which decides its name: register it in **Settings → Agents** (or `just account agent <name>`), then see [`mcp/README.md`](mcp/README.md). Point `APP_URL` at the running app including its base path (for Docker, `http://localhost:3002/task-manager`, or the proxy's URL).
