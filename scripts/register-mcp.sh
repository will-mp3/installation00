#!/usr/bin/env bash
set -euo pipefail

# Registers the Obsidian MCP server with every harness on this machine,
# preferring each harness's own CLI over hand-editing config files.
#   - Claude Code: `claude mcp add` (user scope)
#   - Codex:       `codex mcp add` when the CLI exists, otherwise prints the
#                  config.toml snippet to add manually
# VAULT_PATH defaults to ~/Documents/brain; override with the env var.

REPO="$(cd "$(dirname "$0")/.." && pwd -P)"
. "$REPO/scripts/common.sh"

VAULT_PATH="${VAULT_PATH:-$HOME/Documents/brain}"
SERVER_JS="$REPO/mcp/obsidian/dist/server.js"

if [ ! -d "$VAULT_PATH" ]; then
  err "vault not found at $VAULT_PATH — set VAULT_PATH to your Obsidian vault and re-run"
  exit 1
fi

if [ ! -f "$SERVER_JS" ]; then
  err "server not built at $SERVER_JS — run setup.sh (or 'npm install && npm run build' in mcp/obsidian) first"
  exit 1
fi

# --- Claude Code ---
if command -v claude >/dev/null 2>&1; then
  # Re-adding is the idempotent update path; remove is allowed to fail when
  # the server isn't registered yet.
  run claude mcp remove --scope user obsidian >/dev/null 2>&1 || true
  # Name before -e: --env is variadic and would swallow a trailing name.
  run claude mcp add --scope user obsidian -e "VAULT_PATH=$VAULT_PATH" -- node "$SERVER_JS"
  log "registered obsidian MCP with Claude Code (user scope), vault: $VAULT_PATH"

  # A legacy entry in ~/.claude/mcp.json would shadow or duplicate this one.
  if [ -f "$HOME/.claude/mcp.json" ] && grep -q '"obsidian"' "$HOME/.claude/mcp.json"; then
    warn "legacy obsidian entry also exists in ~/.claude/mcp.json — consider removing it to avoid duplicates"
  fi
else
  warn "claude CLI not found — skipping Claude Code registration"
fi

# --- Codex ---
if command -v codex >/dev/null 2>&1; then
  run codex mcp remove obsidian >/dev/null 2>&1 || true
  run codex mcp add obsidian --env "VAULT_PATH=$VAULT_PATH" -- node "$SERVER_JS"
  log "registered obsidian MCP with Codex, vault: $VAULT_PATH"
else
  warn "codex CLI not found — when Codex is installed, register with:"
  cat >&2 <<EOF

  codex mcp add obsidian --env VAULT_PATH=$VAULT_PATH -- node $SERVER_JS

  or add to ~/.codex/config.toml:

  [mcp_servers.obsidian]
  command = "node"
  args = ["$SERVER_JS"]
  env = { VAULT_PATH = "$VAULT_PATH" }

EOF
fi
