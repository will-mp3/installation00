#!/usr/bin/env bash
# Shared helpers, sourced by every script. Not executable on its own.

log()  { printf '\033[1;32m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33mwarn:\033[0m %s\n' "$*" >&2; }
err()  { printf '\033[1;31merror:\033[0m %s\n' "$*" >&2; }

# Mutating commands go through run() so --dry-run can print instead of act.
run() {
  if [ "${DRY_RUN:-0}" = "1" ]; then
    printf '\033[2m[dry-run]\033[0m %s\n' "$*"
  else
    "$@"
  fi
}
