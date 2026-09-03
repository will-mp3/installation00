#!/usr/bin/env bash
set -euo pipefail

# Registers the memory-layer MCP server with every harness on this machine,
# preferring each harness's own CLI over hand-editing config files.
#   - Claude Code: `claude mcp add` (user scope)
#   - Codex:       `codex mcp add` when the CLI exists, otherwise prints the
#                  config.toml snippet to add manually
# VAULT_PATH defaults to ~/Documents/brain; override with the env var.

REPO="$(cd "$(dirname "$0")/.." && pwd -P)"
. "$REPO/scripts/common.sh"

VAULT_PATH="${VAULT_PATH:-$HOME/Documents/brain}"
SERVER_JS="$REPO/mcp/memory-layer/dist/server.js"
SERVER_NAME="memory-layer"
# The server was called "obsidian" before the rebrand. Leaving that registration
# in place would expose every tool twice under two names, so it is removed here.
LEGACY_NAME="obsidian"

if [ ! -d "$VAULT_PATH" ]; then
  err "knowledge store not found at $VAULT_PATH — set VAULT_PATH to your markdown vault and re-run"
  exit 1
fi

if [ ! -f "$SERVER_JS" ]; then
  err "server not built at $SERVER_JS — run setup.sh (or 'npm install && npm run build' in mcp/memory-layer) first"
  exit 1
fi

# --- Claude Code ---
if command -v claude >/dev/null 2>&1; then
  # Re-adding is the idempotent update path; remove is allowed to fail when
  # the server isn't registered yet.
  run claude mcp remove --scope user "$LEGACY_NAME" >/dev/null 2>&1 || true
  run claude mcp remove --scope user "$SERVER_NAME" >/dev/null 2>&1 || true
  # Name before -e: --env is variadic and would swallow a trailing name.
  run claude mcp add --scope user "$SERVER_NAME" -e "VAULT_PATH=$VAULT_PATH" -- node "$SERVER_JS"
  log "registered $SERVER_NAME MCP with Claude Code (user scope), store: $VAULT_PATH"

  # A legacy entry in ~/.claude/mcp.json would shadow or duplicate this one.
  if [ -f "$HOME/.claude/mcp.json" ] && grep -qE "\"($SERVER_NAME|$LEGACY_NAME)\"" "$HOME/.claude/mcp.json"; then
    warn "a legacy entry also exists in ~/.claude/mcp.json — consider removing it to avoid duplicates"
  fi

  # Tool ids are namespaced by server name, so the rebrand renamed every one of
  # them. Any mcp__obsidian__* rule left in settings.json now matches nothing.
  if [ -f "$HOME/.claude/settings.json" ] && grep -q "mcp__${LEGACY_NAME}__" "$HOME/.claude/settings.json"; then
    warn "~/.claude/settings.json still has mcp__${LEGACY_NAME}__* permission rules."
    warn "  Tool ids are now mcp__${SERVER_NAME}__* — update or drop the stale rules."
  fi

  # Pre-approve the vault tools so no session stops to ask for them.
  if [ "$DRY_RUN" = "1" ]; then
    printf '\033[2m[dry-run]\033[0m allow mcp__%s__* in %s\n' "$SERVER_NAME" "$HOME/.claude/settings.json"
  else
    run mkdir -p "$HOME/.claude"
    node "$REPO/scripts/merge-claude-settings.mjs" --permissions "$HOME/.claude/settings.json"
  fi
else
  warn "claude CLI not found — skipping Claude Code registration"
fi

# --- Codex ---
if command -v codex >/dev/null 2>&1; then
  run codex mcp remove "$LEGACY_NAME" >/dev/null 2>&1 || true
  run codex mcp remove "$SERVER_NAME" >/dev/null 2>&1 || true
  run codex mcp add "$SERVER_NAME" --env "VAULT_PATH=$VAULT_PATH" -- node "$SERVER_JS"
  log "registered $SERVER_NAME MCP with Codex, store: $VAULT_PATH"

  # Without this, every vault tool call opens an "Allow the memory-layer MCP
  # server to run tool X?" prompt. Set on the server rather than per tool, so
  # tools added later are covered too. Must run AFTER `codex mcp add`, which
  # rewrites the whole [mcp_servers.<name>] table and would drop the key.
  if [ "$DRY_RUN" = "1" ]; then
    printf '\033[2m[dry-run]\033[0m set [mcp_servers.%s].default_tools_approval_mode\n' "$SERVER_NAME"
  else
    node "$REPO/scripts/merge-codex-config.mjs" --mcp-approval "$HOME/.codex/config.toml"
  fi

  # `codex mcp remove` drops [mcp_servers.obsidian] but not the per-tool
  # [mcp_servers.obsidian.tools.*] approval blocks underneath it.
  if [ -f "$HOME/.codex/config.toml" ] && grep -q "mcp_servers\.${LEGACY_NAME}\." "$HOME/.codex/config.toml"; then
    warn "~/.codex/config.toml still has [mcp_servers.${LEGACY_NAME}.tools.*] blocks — remove them by hand."
  fi
else
  warn "codex CLI not found — when Codex is installed, register with:"
  cat >&2 <<EOF

  codex mcp add $SERVER_NAME --env VAULT_PATH=$VAULT_PATH -- node $SERVER_JS

  or add to ~/.codex/config.toml:

  [mcp_servers.$SERVER_NAME]
  command = "node"
  args = ["$SERVER_JS"]
  env = { VAULT_PATH = "$VAULT_PATH" }

EOF
fi
