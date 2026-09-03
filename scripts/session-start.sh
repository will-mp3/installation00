#!/usr/bin/env bash
set -euo pipefail

# SessionStart hook: injects skills/using-the-ark/SKILL.md as developer context
# so every new session starts knowing it must reach for skills.
#
# Claude Code and Codex accept the identical hookSpecificOutput shape, so one
# script serves both harnesses. Wired by scripts/link-hooks.sh; both harnesses
# reach it through a ~/.<harness>/ark-session-start symlink, which keeps the
# committed hook config free of machine-specific paths.

REPO="$(cd "$(dirname "$(readlink "$0" || echo "$0")")/.." && pwd -P)"
SKILL="$REPO/skills/using-the-ark/SKILL.md"

if ! content="$(cat "$SKILL" 2>/dev/null)"; then
  content="Error: could not read the using-the-ark skill at $SKILL"
fi

# Escape for embedding in a JSON string. Each ${s//old/new} is a single C-level
# pass — far faster than a character-by-character loop.
escape_for_json() {
  local s="$1"
  s="${s//\\/\\\\}"
  s="${s//\"/\\\"}"
  s="${s//$'\n'/\\n}"
  s="${s//$'\r'/\\r}"
  s="${s//$'\t'/\\t}"
  printf '%s' "$s"
}

escaped="$(escape_for_json "$content")"
context="<EXTREMELY_IMPORTANT>\nYou have the Ark.\n\n**Below is the full content of your 'using-the-ark' skill — your introduction to using skills. For all other skills, use the 'Skill' tool:**\n\n${escaped}\n</EXTREMELY_IMPORTANT>"

# printf rather than a heredoc: bash 5.3+ can hang on heredocs in this position.
printf '{\n  "hookSpecificOutput": {\n    "hookEventName": "SessionStart",\n    "additionalContext": "%s"\n  }\n}\n' "$context"
