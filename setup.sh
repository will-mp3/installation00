#!/usr/bin/env bash
set -euo pipefail

# installation00 bootstrap: clone → ./setup.sh → done.
# Idempotent; safe to re-run any time. After the first run, `git pull` is
# enough to update skills and global instructions (they're symlinks);
# re-run this only when the MCP server code changes.
#
# Usage: ./setup.sh [--dry-run] [--skip-ollama]
#   VAULT_PATH=/path/to/vault ./setup.sh   # non-default vault location

REPO="$(cd "$(dirname "$0")" && pwd -P)"
. "$REPO/scripts/common.sh"

export DRY_RUN=0
SKIP_OLLAMA=0
for arg in "$@"; do
  case "$arg" in
    --dry-run)     DRY_RUN=1 ;;
    --skip-ollama) SKIP_OLLAMA=1 ;;
    *) err "unknown option: $arg"; exit 1 ;;
  esac
done
[ "$DRY_RUN" = "1" ] && log "dry run — no changes will be made"

# --- 1. Prerequisites ---
command -v git >/dev/null 2>&1 || { err "git is required"; exit 1; }
command -v node >/dev/null 2>&1 || { err "Node.js 18+ is required (https://nodejs.org or 'brew install node')"; exit 1; }
node_major="$(node -e 'process.stdout.write(String(process.versions.node.split(".")[0]))')"
if [ "$node_major" -lt 18 ]; then
  err "Node.js 18+ required, found $(node --version)"
  exit 1
fi
log "prerequisites ok (node $(node --version))"

# --- 2. Build the MCP server ---
log "building MCP server"
if [ "$DRY_RUN" = "1" ]; then
  printf '\033[2m[dry-run]\033[0m npm install && npm run build (in mcp/obsidian)\n'
else
  (cd "$REPO/mcp/obsidian" && npm install --no-fund --no-audit --silent && npm run build --silent)
fi

# --- 3. Ollama (never fatal) ---
if [ "$SKIP_OLLAMA" = "1" ]; then
  log "skipping ollama setup (--skip-ollama)"
else
  "$REPO/scripts/setup-ollama.sh"
fi

# --- 4. Link skills into both harnesses ---
"$REPO/scripts/link-skills.sh"

# --- 5. Link global instructions ---
"$REPO/scripts/link-global.sh"

# --- 6. Register the MCP server ---
"$REPO/scripts/register-mcp.sh"

log "setup complete"
