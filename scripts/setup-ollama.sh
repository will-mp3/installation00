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

# --- Persistence: a launchd agent the ark owns ---
# A backgrounded `ollama serve` dies at logout and never comes back, which
# silently drops search to FTS-only until someone re-runs setup. `brew services`
# is not a reliable substitute: it only works when ollama came from brew, and a
# broken Homebrew makes `brew services list` fail outright, which the old probe
# read as "no service" and quietly fell through. A launchd agent starts at login
# and restarts on crash, independent of how ollama was installed.
AGENT_LABEL="com.the-ark.ollama"
AGENT_PLIST="$HOME/Library/LaunchAgents/$AGENT_LABEL.plist"
AGENT_LOG="$HOME/Library/Logs/the-ark-ollama.log"
OLLAMA_BIN="$(command -v ollama)"

install_agent() {
  run mkdir -p "$HOME/Library/LaunchAgents" "$HOME/Library/Logs"
  if [ "${DRY_RUN:-0}" = "1" ]; then
    printf '\033[2m[dry-run]\033[0m write %s\n' "$AGENT_PLIST"
    return 0
  fi
  cat > "$AGENT_PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$AGENT_LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>$OLLAMA_BIN</string>
    <string>serve</string>
  </array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ProcessType</key><string>Background</string>
  <!-- Do not respawn faster than this; a port conflict would otherwise spin. -->
  <key>ThrottleInterval</key><integer>10</integer>
  <key>StandardOutPath</key><string>$AGENT_LOG</string>
  <key>StandardErrorPath</key><string>$AGENT_LOG</string>
</dict>
</plist>
PLIST
}

if [ -z "$OLLAMA_BIN" ]; then
  warn "ollama binary not found after install — search will be FTS-only"
  exit 0
fi

install_agent
log "wrote launchd agent $AGENT_PLIST"

# A stray `ollama serve` (from a terminal, or an older setup run) holds port
# 11434, so the agent would fail to bind and thrash against ThrottleInterval.
# Hand the port over: ollama serve keeps no state, so a restart costs nothing.
if pgrep -f "ollama serve" >/dev/null 2>&1 && ! launchctl print "gui/$(id -u)/$AGENT_LABEL" >/dev/null 2>&1; then
  log "stopping unmanaged 'ollama serve' so the launchd agent can own port 11434"
  run pkill -f "ollama serve" || true
  sleep 2
fi

# bootout then bootstrap is the idempotent reload; both are allowed to fail
# (nothing loaded yet, or an older macOS without the modern subcommands).
# Not routed through run(): these need their own output suppressed, which would
# also swallow run()'s dry-run notice and hide the step from --dry-run.
if [ "${DRY_RUN:-0}" = "1" ]; then
  printf '\033[2m[dry-run]\033[0m launchctl bootout + bootstrap %s\n' "$AGENT_LABEL"
else
  launchctl bootout "gui/$(id -u)/$AGENT_LABEL" >/dev/null 2>&1 || true
  if ! launchctl bootstrap "gui/$(id -u)" "$AGENT_PLIST" >/dev/null 2>&1; then
    launchctl load -w "$AGENT_PLIST" >/dev/null 2>&1 || warn "could not load $AGENT_LABEL"
  fi
fi

# Give it a few seconds to come up.
for _ in 1 2 3 4 5 6 7 8 9 10; do
  curl -sf --max-time 2 "$OLLAMA_URL" >/dev/null 2>&1 && break
  sleep 1
done

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
