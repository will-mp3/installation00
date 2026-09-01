#!/usr/bin/env bash
set -euo pipefail

# Symlinks the shared global instructions file (agents/AGENTS.global.md) to
# every harness's global-instructions location:
#   - ~/.claude/CLAUDE.md   — Claude Code
#   - ~/.codex/AGENTS.md    — Codex
# One file, written harness-neutral, always in sync by construction.
# Real (non-symlink) files at a target are backed up to *.bak, never destroyed.

REPO="$(cd "$(dirname "$0")/.." && pwd -P)"
. "$REPO/scripts/common.sh"

SRC="$REPO/agents/AGENTS.global.md"
TARGETS=("$HOME/.claude/CLAUDE.md" "$HOME/.codex/AGENTS.md")

if [ ! -f "$SRC" ]; then
  warn "no global instructions file at $SRC yet — skipping (re-run setup once it exists)"
  exit 0
fi

for target in "${TARGETS[@]}"; do
  run mkdir -p "$(dirname "$target")"

  if [ -e "$target" ] && [ ! -L "$target" ]; then
    warn "$target exists and is not a symlink — backing up to $target.bak"
    run mv "$target" "$target.bak"
  fi

  run ln -sfn "$SRC" "$target"
  log "linked $target -> AGENTS.global.md"
done
