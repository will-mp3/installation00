#!/usr/bin/env bash
# The ark's status line: branch | model | context bar | rate-limit bar.
#
# Claude Code runs this on every render and pipes a JSON session snapshot on
# stdin. Wired by scripts/link-statusline.sh, which points settings.json at
# ~/.claude/ark-statusline (a symlink to this file) so edits ship on `git pull`.
#
# Claude Code only. Codex has a status line too, but it is a picker over fixed
# items rather than a command hook, so it cannot run this script — see
# scripts/merge-codex-statusline.mjs for the equivalent item set.

input=$(cat)

# --- Git branch (shown only inside a repo; no path fallback) ---
branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)

# jq ships with macOS 13+ at /usr/bin/jq, so this is normally a non-issue — but
# a status line that silently prints nothing is a confusing way to find out.
if ! command -v jq >/dev/null 2>&1; then
  [ -n "$branch" ] && printf '%s | ' "$branch"
  printf 'status line needs jq (brew install jq)'
  exit 0
fi

# ANSI color codes — use $'...' quoting so the shell embeds a real ESC byte,
# not the four literal characters \033.
GREEN=$'\033[32m'
YELLOW=$'\033[33m'
RED=$'\033[31m'
RESET=$'\033[0m'

# Pick a color based on a percentage and a set of thresholds.
# Usage: color_for_pct <pct> <yellow_threshold> <red_threshold>
color_for_pct() {
  local pct=$1 yellow_thresh=$2 red_thresh=$3
  if [ "$pct" -ge "$red_thresh" ]; then
    printf '%s' "$RED"
  elif [ "$pct" -ge "$yellow_thresh" ]; then
    printf '%s' "$YELLOW"
  else
    printf '%s' "$GREEN"
  fi
}

# Render one "[bar] NN%" segment from a percentage, or an empty bar and "?"
# when the field is absent.
# Usage: pct_segment <pct-or-empty> <yellow_threshold> <red_threshold>
pct_segment() {
  local pct=$1 yellow_thresh=$2 red_thresh=$3
  if [ -z "$pct" ]; then
    printf '[░░░░░░░░░░] ?'
    return
  fi

  local int filled empty color bar=""
  int=$(printf '%.0f' "$pct")
  filled=$(( int * 10 / 100 ))
  # Any nonzero usage should show at least one segment, and clamp at full.
  [ "$int" -gt 0 ] && [ "$filled" -eq 0 ] && filled=1
  [ "$filled" -gt 10 ] && filled=10
  empty=$(( 10 - filled ))
  color=$(color_for_pct "$int" "$yellow_thresh" "$red_thresh")

  if [ "$filled" -gt 0 ]; then
    bar="${color}"
    for ((i = 0; i < filled; i++)); do bar="${bar}█"; done
    bar="${bar}${RESET}"
  fi
  for ((i = 0; i < empty; i++)); do bar="${bar}░"; done

  printf '[%s] %s%s%%%s' "$bar" "$color" "$int" "$RESET"
}

# One jq call per field, deliberately. Batching all three into a single `@tsv`
# pass is faster and WRONG: tab is an IFS *whitespace* character, so bash
# collapses a run of them into one delimiter. Any absent field then shifts every
# later value one slot left — .context_window is absent until the first API
# response lands, so a fresh session rendered the rate-limit number as the
# context number, in the rate bar's red, and showed "?" for the rate.
# Three reads cannot shift. The extra few milliseconds are not worth the class
# of bug.
#
# .context_window is absent early in a session; .rate_limits is present for
# Claude.ai subscribers only, absent for API-key users. `// empty` yields an
# empty string for both, which pct_segment renders as "?". A real 0 survives —
# 0 is truthy in jq, so `0 // empty` is 0, not empty.
jq_field() { printf '%s' "$input" | jq -r "$1"; }

model=$(jq_field '.model.display_name // "?"')
ctx_pct=$(jq_field '.context_window.used_percentage // empty')
five_h_pct=$(jq_field '.rate_limits.five_hour.used_percentage // empty')
week_pct=$(jq_field '.rate_limits.seven_day.used_percentage // empty')

ctx_seg=$(pct_segment "$ctx_pct" 30 50)
five_h_seg=$(pct_segment "$five_h_pct" 33 66)
week_seg=$(pct_segment "$week_pct" 33 66)

# Two usage windows, labelled rather than both called "rate": the 5-hour limit
# is what throttles a working session, the weekly one is what runs out mid-week.
if [ -n "$branch" ]; then
  printf '%s | %s | ctx: %s | 5h: %s | wk: %s' "$branch" "$model" "$ctx_seg" "$five_h_seg" "$week_seg"
else
  printf '%s | ctx: %s | 5h: %s | wk: %s' "$model" "$ctx_seg" "$five_h_seg" "$week_seg"
fi
