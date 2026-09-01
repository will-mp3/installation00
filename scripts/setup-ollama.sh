#!/usr/bin/env bash
set -uo pipefail

# Ollama bootstrap for the MCP server's semantic search: install if missing,
# make sure the server is running, pull the embedding model.
# NEVER fatal — the MCP server degrades gracefully to FTS-only search, so
# every failure here warns and moves on. Always exits 0.

REPO="$(cd "$(dirname "$0")/.." && pwd -P)"
. "$REPO/scripts/common.sh"

MODEL="embeddinggemma"
OLLAMA_URL="http://localhost:11434"

if ! command -v ollama >/dev/null 2>&1; then
  if command -v brew >/dev/null 2>&1; then
    log "installing ollama via homebrew"
    run brew install ollama || { warn "brew install ollama failed — search will be FTS-only"; exit 0; }
  else
    warn "ollama not installed and homebrew unavailable — install from https://ollama.com; search will be FTS-only until then"
    exit 0
  fi
fi

if ! curl -sf --max-time 2 "$OLLAMA_URL" >/dev/null 2>&1; then
  log "starting ollama server"
  if command -v brew >/dev/null 2>&1 && brew services list 2>/dev/null | grep -q '^ollama'; then
    run brew services start ollama >/dev/null || true
  else
    if [ "${DRY_RUN:-0}" = "1" ]; then
      printf '\033[2m[dry-run]\033[0m nohup ollama serve &\n'
    else
      nohup ollama serve >/dev/null 2>&1 &
    fi
  fi
  # Give it a few seconds to come up.
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    curl -sf --max-time 2 "$OLLAMA_URL" >/dev/null 2>&1 && break
    sleep 1
  done
fi

if ! curl -sf --max-time 2 "$OLLAMA_URL" >/dev/null 2>&1; then
  if [ "${DRY_RUN:-0}" = "1" ]; then
    log "ollama not running (expected under dry-run)"
  else
    warn "ollama server not responding at $OLLAMA_URL — search will be FTS-only"
  fi
  exit 0
fi

# Capture first: `grep -q | pipefail` turns ollama's SIGPIPE into a false negative.
installed_models="$(ollama list 2>/dev/null || true)"
if printf '%s\n' "$installed_models" | grep -q "^$MODEL"; then
  log "embedding model $MODEL already present"
else
  log "pulling embedding model $MODEL"
  run ollama pull "$MODEL" || warn "pull failed — search will be FTS-only until '$MODEL' is pulled"
fi

log "ollama ready"
exit 0
