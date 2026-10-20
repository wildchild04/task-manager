#!/bin/sh
# Starts the task manager's agent MCP server (installed by `just install-mcp`).
#
#   notion-tasks-mcp [profile]
#
# A profile is ~/.config/notion-tasks-mcp/<profile>.env: KEY=value lines for
# APP_URL, AGENT_TOKEN and AGENT_NAME (and e.g. NODE_EXTRA_CA_CERTS).
# Variables already set in the environment win over the profile.
set -eu

profile="${1:-default}"
config="${XDG_CONFIG_HOME:-$HOME/.config}/notion-tasks-mcp/$profile.env"
server="${XDG_DATA_HOME:-$HOME/.local/share}/notion-tasks-mcp/server.mjs"

if [ -f "$config" ]; then
  while IFS= read -r line || [ -n "$line" ]; do
    case "$line" in '' | '#'*) continue ;; esac
    key="${line%%=*}"
    value="${line#*=}"
    # Only plain variable names, and never over a value the caller set.
    case "$key" in '' | *[!A-Za-z0-9_]* | [0-9]*) continue ;; esac
    eval "current=\${$key:-}"
    [ -n "$current" ] || export "$key=$value"
  done < "$config"
elif [ "$#" -gt 0 ]; then
  echo "notion-tasks-mcp: no profile '$profile' at $config" >&2
  exit 1
fi

if [ ! -f "$server" ]; then
  echo "notion-tasks-mcp: $server is missing; run 'just install-mcp' in the task manager repo" >&2
  exit 1
fi
exec node "$server"
