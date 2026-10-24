#!/usr/bin/env bash
# The homelab's post-receive hook: after a push to main updates the checkout (receive.denyCurrentBranch=updateInstead),
# rebuilds and restarts the app. Installed as .git/hooks/post-receive by `just homelab-setup`; reads the pushed refs on stdin.
set -euo pipefail

# Hooks run in the .git folder, without the login shell's PATH (docker and just come from Homebrew).
cd "$(git rev-parse --absolute-git-dir)/.."
unset GIT_DIR
export PATH="/home/linuxbrew/.linuxbrew/bin:$PATH"

deploy=false
while read -r _old new ref; do
  if [[ $ref == refs/heads/main && $new != 0000000000000000000000000000000000000000 ]]; then deploy=true; fi
done
$deploy || exit 0

# The build fetches the design system from GitHub over SSH: with the pusher's forwarded agent if there is one,
# otherwise with the homelab's own read-only deploy key for that repository, in an agent for this build only.
deploy_key="$HOME/.ssh/design-system-deploy"
if ! ssh-add -l >/dev/null 2>&1; then
  if [[ ! -f $deploy_key ]]; then
    echo "deploy: no SSH agent forwarded and no $deploy_key; the code is updated but not deployed." >&2
    exit 1
  fi
  eval "$(ssh-agent -s)" >/dev/null
  trap 'ssh-agent -k >/dev/null' EXIT
  ssh-add -q "$deploy_key"
fi

echo "deploy: building $(git rev-parse --short HEAD)…"
if just docker-redeploy; then
  echo "deploy: $(git rev-parse --short HEAD) is live."
else
  echo "deploy: the build failed; the previous version is still running." >&2
  exit 1
fi
