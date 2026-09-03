#!/usr/bin/env bash
set -euo pipefail

# the-ark bootstrap: clone → ./setup.sh → done.
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

# --- 1. Prerequisites: Homebrew and Node, installed if missing ---
# Sourced, not executed, so the brew PATH it sets reaches the later steps.
. "$REPO/scripts/bootstrap-deps.sh"

# --- 2. Build the MCP server ---
log "building MCP server"
if [ "$DRY_RUN" = "1" ]; then
  printf '\033[2m[dry-run]\033[0m npm install && npm run build (in mcp/memory-layer)\n'
else
  (cd "$REPO/mcp/memory-layer" && npm install --no-fund --no-audit --silent && npm run build --silent)
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

# --- 7. Wire the SessionStart hook into both harnesses ---
"$REPO/scripts/link-hooks.sh"

# --- 8. Wire the status line (Claude Code only — Codex has none) ---
"$REPO/scripts/link-statusline.sh"

log "setup complete"
