set shell := ["bash", "-eu", "-o", "pipefail", "-c"]

docker_compose := if `docker compose version >/dev/null 2>&1 && echo yes || true` == "yes" { "docker compose" } else { "docker-compose" }
build_env := "DOCKER_BUILDKIT=1 COMPOSE_DOCKER_CLI_BUILD=1"

default:
  just --list

install:
  npm install

dev:
  npm run dev

typecheck:
  npm run typecheck

test:
  npm test

build:
  npm run build

seed:
  npm run db:seed

docker-build:
  {{build_env}} {{docker_compose}} build app

docker-build-clean:
  {{build_env}} {{docker_compose}} build --no-cache app

docker-up:
  {{build_env}} {{docker_compose}} up -d app

docker-redeploy:
  {{build_env}} {{docker_compose}} build app
  {{build_env}} {{docker_compose}} up -d app

docker-down:
  {{docker_compose}} down

docker-logs:
  {{docker_compose}} logs -f app

# Bundle the agent MCP server into one file and install the `notion-tasks-mcp` launcher (see mcp/README.md).
install-mcp:
  #!/usr/bin/env bash
  set -euo pipefail
  data="${XDG_DATA_HOME:-$HOME/.local/share}/notion-tasks-mcp"
  bin="$HOME/.local/bin"
  mkdir -p "$data" "$bin"
  npx esbuild mcp/server.ts --bundle --platform=node --format=esm --target=node20 \
    --outfile="$data/server.mjs" --log-level=warning
  git rev-parse --short HEAD > "$data/VERSION"
  install -m 755 mcp/notion-tasks-mcp.sh "$bin/notion-tasks-mcp"
  echo "Installed $bin/notion-tasks-mcp, server $(cat "$data/VERSION") in $data"
  echo "Profiles: ${XDG_CONFIG_HOME:-$HOME/.config}/notion-tasks-mcp/<name>.env (APP_URL, AGENT_TOKEN: the agent's own token, from Settings)"

# The owner's account and the agents: `just account password`, `just account agent <name>`, `just account agents`,
# `just account revoke <name>`. Runs inside the app's container when it's up (the homelab), else against the local database.
account *args:
  #!/usr/bin/env bash
  set -euo pipefail
  if {{docker_compose}} ps --status running -q app 2>/dev/null | grep -q .; then
    {{docker_compose}} exec app node build/account.mjs {{args}}
  else
    npm run --silent account -- {{args}}
  fi

# Add a SECRET_KEY to .env when there's none (never overwrites); agents' tokens are kept encrypted under it.
# On the homelab, then restart the app (`just docker-up`) so the container gets it.
secret-key:
  #!/usr/bin/env bash
  set -euo pipefail
  touch .env
  if grep -q '^SECRET_KEY=.' .env; then
    echo "SECRET_KEY is already set in .env; leaving it alone."
  else
    sed -i.bak '/^SECRET_KEY=$/d' .env && rm -f .env.bak
    echo "SECRET_KEY=$(openssl rand -base64 48 | tr -d '\n')" >> .env
    chmod 600 .env
    echo "Added a SECRET_KEY to .env."
  fi

# Make the homelab checkout a push target that deploys: `git push homelab main` updates it and rebuilds the app.
# Needs `ssh homelab` to work (see README); run once.
homelab-setup:
  ssh homelab 'cd ~/apps/task-manager && git config receive.denyCurrentBranch updateInstead && ln -sf ../../scripts/homelab-deploy.sh .git/hooks/post-receive'
  git remote get-url homelab >/dev/null 2>&1 || git remote add homelab homelab:apps/task-manager

# Push main to the homelab, which rebuilds and restarts the app (the push waits for the build).
deploy:
  git push homelab main
