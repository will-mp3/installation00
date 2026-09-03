#!/usr/bin/env bash
set -euo pipefail

# Wires the ark's status line into both harnesses. They take opposite shapes, so
# this is the one piece of the ark that cannot be a single shared file:
#
#   Claude Code — runs an arbitrary command and renders its stdout. Gets
#     statusline/statusline.sh through a ~/.claude/ark-statusline shim, so later
#     edits to the script ship on `git pull` with no re-run of setup.
#   Codex — no command hook. Its status line is a picker over a fixed vocabulary
#     of items (`/statusline` in the TUI), stored as [tui].status_line in
#     config.toml. So it gets the item set that renders the same four fields.
#
# Same information either way; only the rendering is harness-native.

REPO="$(cd "$(dirname "$0")/.." && pwd -P)"
. "$REPO/scripts/common.sh"

SRC="$REPO/statusline/statusline.sh"

if [ ! -f "$SRC" ]; then
  warn "no status line script at $SRC — skipping"
  exit 0
fi

[ -x "$SRC" ] || run chmod +x "$SRC"

run mkdir -p "$HOME/.claude"

target="$HOME/.claude/ark-statusline"
if [ -e "$target" ] && [ ! -L "$target" ]; then
  warn "$target exists and is not a symlink — backing up to $target.bak"
  run mv "$target" "$target.bak"
fi
run ln -sfn "$SRC" "$target"
log "linked $target -> statusline.sh"

# jq is the one runtime dependency. macOS 13+ ships it at /usr/bin/jq, so this
# normally never fires; the script degrades to a readable message either way.
if ! command -v jq >/dev/null 2>&1; then
  warn "jq not found — the status line will show a reminder instead of bars."
  warn "  Install it with: brew install jq"
fi

CLAUDE_SETTINGS="$HOME/.claude/settings.json"
if [ "${DRY_RUN:-0}" = "1" ]; then
  printf '\033[2m[dry-run]\033[0m merge the ark status line into %s\n' "$CLAUDE_SETTINGS"
else
  node "$REPO/scripts/merge-claude-settings.mjs" --statusline "$CLAUDE_SETTINGS"
fi

# --- Codex ---
# Written straight to config.toml: `/statusline` is interactive-only, and there
# is no `codex config set` to go through instead.
CODEX_CONFIG="$HOME/.codex/config.toml"
if [ "${DRY_RUN:-0}" = "1" ]; then
  printf '\033[2m[dry-run]\033[0m set [tui].status_line in %s\n' "$CODEX_CONFIG"
else
  run mkdir -p "$HOME/.codex"
  node "$REPO/scripts/merge-codex-config.mjs" --statusline "$CODEX_CONFIG"
fi
