#!/usr/bin/env bash
set -euo pipefail

# Wires the SessionStart hook into every harness, so a fresh session on any
# machine starts with the using-the-ark skill already injected:
#   - Codex:       ~/.codex/hooks.json     — a standalone file, so the ark owns
#                                            it outright via symlink
#   - Claude Code: ~/.claude/settings.json — no standalone hooks file exists, so
#                                            this is a one-time idempotent merge
# Both harnesses accept the same hookSpecificOutput JSON and both run the same
# script, reached through a ~/.<harness>/ark-session-start symlink. That keeps
# the committed config machine-independent: later edits ship on `git pull`.

REPO="$(cd "$(dirname "$0")/.." && pwd -P)"
. "$REPO/scripts/common.sh"

HOOK_SRC="$REPO/scripts/session-start.sh"
CODEX_HOOKS_SRC="$REPO/hooks/codex-hooks.json"

[ -x "$HOOK_SRC" ] || run chmod +x "$HOOK_SRC"

# --- the shared shim, in each harness's directory ---
for dir in "$HOME/.claude" "$HOME/.codex"; do
  run mkdir -p "$dir"
  target="$dir/ark-session-start"
  if [ -e "$target" ] && [ ! -L "$target" ]; then
    warn "$target exists and is not a symlink — backing up to $target.bak"
    run mv "$target" "$target.bak"
  fi
  run ln -sfn "$HOOK_SRC" "$target"
  log "linked $target -> session-start.sh"
done

# --- Codex: own hooks.json outright ---
codex_target="$HOME/.codex/hooks.json"
if [ -e "$codex_target" ] && [ ! -L "$codex_target" ]; then
  warn "$codex_target exists and is not a symlink — backing up to $codex_target.bak"
  run mv "$codex_target" "$codex_target.bak"
fi
run ln -sfn "$CODEX_HOOKS_SRC" "$codex_target"
log "linked $codex_target -> codex-hooks.json"

# Codex will not run a hook it has not been told to trust, and the trust prompt
# only exists in the interactive TUI — `codex exec` skips untrusted hooks in
# silence. So linking the file is not enough on a new machine: the first
# interactive session has to approve it once.
warn "Codex requires a one-time trust approval before hooks run."
warn "  Start an interactive 'codex' session and approve the hook when prompted."
warn "  Until then the hook is silently skipped (this is a Codex trust gate, not a config error)."

# Codex gates hooks behind a feature flag. It ships enabled on current builds,
# but older ones need the flip — and enabling twice is harmless.
if command -v codex >/dev/null 2>&1; then
  # Captured first, then matched against a here-string: `grep -q` exits at the
  # first match and closes the pipe, so a direct pipeline would kill `codex` with
  # SIGPIPE and `set -o pipefail` would read that as a failed check.
  codex_features="$(codex features list 2>/dev/null || true)"
  if grep -qE '^hooks[[:space:]]+[^[:space:]]+[[:space:]]+true' <<<"$codex_features"; then
    log "codex hooks feature already enabled"
  else
    run codex features enable hooks
    log "enabled the codex hooks feature"
  fi
else
  warn "codex CLI not found — hooks.json is linked; when Codex is installed run:"
  warn "  codex features enable hooks"
fi

# --- Claude Code: merge one SessionStart entry into settings.json ---
CLAUDE_SETTINGS="$HOME/.claude/settings.json"
if [ "${DRY_RUN:-0}" = "1" ]; then
  printf '\033[2m[dry-run]\033[0m merge the ark SessionStart hook into %s\n' "$CLAUDE_SETTINGS"
else
  node "$REPO/scripts/merge-claude-settings.mjs" --hook "$CLAUDE_SETTINGS"
fi
