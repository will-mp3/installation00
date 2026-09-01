#!/usr/bin/env bash
set -euo pipefail

# Links every skill in this repo (any directory containing a SKILL.md) into the
# local skill directories used by each agent harness:
#   - ~/.claude/skills  — Claude Code
#   - ~/.agents/skills  — Codex and other Agent Skills-compatible harnesses
# Each entry is a per-skill symlink into this repo, so `git pull` is all that's
# needed to keep every machine and harness on the same version. Also prunes
# stale links left behind when a skill is removed from the repo.

# pwd -P: canonical on-disk path (macOS filesystems are case-insensitive, so
# path string comparisons are only safe between canonicalized paths).
REPO="$(cd "$(dirname "$0")/.." && pwd -P)"
. "$REPO/scripts/common.sh"

REPO_LC="$(printf '%s' "$REPO" | tr '[:upper:]' '[:lower:]')"
DESTS=("$HOME/.claude/skills" "$HOME/.agents/skills")

names=()
srcs=()
while IFS= read -r -d '' skill_md; do
  src="$(dirname "$skill_md")"
  names+=("$(basename "$src")")
  srcs+=("$src")
done < <(find "$REPO/skills" -name SKILL.md -not -path '*/node_modules/*' -print0)

if [ "${#names[@]}" -eq 0 ]; then
  warn "no skills found under $REPO/skills — nothing to link"
  exit 0
fi

for DEST in "${DESTS[@]}"; do
  # If $DEST is itself a symlink into this repo, per-skill links would be
  # written back into the repo's own skills/ tree. Refuse. Compare lowercased
  # paths — macOS filesystems are case-insensitive, and neither readlink nor
  # pwd -P canonicalizes case.
  if [ -L "$DEST" ]; then
    resolved="$(cd "$DEST" 2>/dev/null && pwd -P || readlink "$DEST")"
    resolved_lc="$(printf '%s' "$resolved" | tr '[:upper:]' '[:lower:]')"
    case "$resolved_lc" in
      "$REPO_LC"|"$REPO_LC"/*)
        err "$DEST is a symlink into this repo ($resolved)."
        err "Remove it (rm \"$DEST\") and re-run; it will be recreated as a real directory."
        exit 1
        ;;
    esac
  fi

  run mkdir -p "$DEST"

  # Prune symlinks pointing into this repo whose source no longer exists
  # (skills deleted or renamed since the last run).
  if [ -d "$DEST" ]; then
    for entry in "$DEST"/*; do
      [ -L "$entry" ] || continue
      # A stale target can't be canonicalized (it's gone), so compare
      # case-insensitively against the canonical repo path instead.
      target_lc="$(readlink "$entry" | tr '[:upper:]' '[:lower:]')"
      case "$target_lc" in
        "$REPO_LC"/skills/*)
          if [ ! -e "$entry" ]; then
            run rm "$entry"
            log "pruned stale link $(basename "$entry") ($DEST)"
          fi
          ;;
      esac
    done
  fi

  for i in "${!names[@]}"; do
    name="${names[$i]}"
    src="${srcs[$i]}"
    target="$DEST/$name"

    # A real file/dir (not ours) in the way: back it up rather than destroy.
    if [ -e "$target" ] && [ ! -L "$target" ]; then
      warn "$target exists and is not a symlink — backing up to $target.bak"
      run mv "$target" "$target.bak"
    fi

    run ln -sfn "$src" "$target"
    log "linked $name ($DEST)"
  done
done
