# the-ark

The Ark: Halo ring (agent harness) factory. Primary function is to destroy flood outbreaks (hand coding).

Dotfiles for agent tooling. One repo that puts the same setup on every machine, for every harness:

- **Obsidian MCP server** (`mcp/obsidian/`) — persistent, token-efficient vault access with hybrid search and issue tracking
- **Skills** (`skills/`) — a curated engineering + productivity skill set, wired to the vault
- **Global instructions** (`agents/AGENTS.global.md`) — one harness-neutral file serving Claude Code and Codex

Both harnesses run the *same files* from this checkout via symlinks — `git pull` updates everything, everywhere, at once.

## Setup

```bash
git clone <this repo>
cd the-ark
./setup.sh
```

That's it. The script is idempotent — re-run it any time. It will:

1. Check prerequisites (Node 18+, git)
2. Build the MCP server
3. Install Ollama, install a launchd agent that keeps it running, and pull the embedding model
   (never fatal — search degrades to FTS-only without it)
4. Symlink every skill into `~/.claude/skills` (Claude Code) and `~/.agents/skills` (Codex)
5. Symlink `agents/AGENTS.global.md` to `~/.claude/CLAUDE.md` and `~/.codex/AGENTS.md` (existing real files are backed up to `.bak`)
6. Register the MCP server with both harness CLIs
7. Wire the SessionStart hook so every session loads `using-the-ark`

**One manual step on a new machine:** Codex only runs hooks it has been told to trust, and
that prompt exists solely in the interactive TUI — `codex exec` skips untrusted hooks
silently. Start an interactive `codex` session once and approve the hook. Claude Code needs
no equivalent step.

Options:

```bash
./setup.sh --dry-run                      # print what would happen, change nothing
./setup.sh --skip-ollama                  # skip the Ollama step
VAULT_PATH=/path/to/vault ./setup.sh      # non-default vault location (default: ~/Documents/brain)
```

After setup, restart your agent sessions to pick up the MCP server. Skills and instructions update on `git pull` alone; re-run `setup.sh` only when the MCP server code changes.

## Layout

```
setup.sh            # the one command a fresh machine runs
scripts/            # the steps setup.sh orchestrates (each independently runnable)
mcp/obsidian/       # MCP server source (see its README for tools and config)
skills/
  engineering/      # design, planning, implementation, review skills
  productivity/     # general workflow skills
agents/
  AGENTS.global.md  # the shared global instructions file
hooks/
  codex-hooks.json  # symlinked to ~/.codex/hooks.json
```

## Search uptime

Semantic search needs Ollama on `localhost:11434`. A backgrounded `ollama serve` dies at
logout, so `setup.sh` installs a launchd agent instead — `~/Library/LaunchAgents/com.the-ark.ollama.plist`,
with `RunAtLoad` and `KeepAlive`, so it starts at login and restarts within seconds if it
crashes or is killed.

FTS is a deliberate fallback, not an equivalent, so degradation is never silent:

- `search_vault` returns a `warning` field when Ollama is unreachable, saying the results are
  full-text only.
- `reindex_vault` reports how many notes still have no embedding, and backfills any it can.

A note written while Ollama was down keeps its FTS row and an up-to-date mtime but has no
vector. `reindex_vault` therefore checks for a missing embedding as well as a stale mtime —
without that, the mtime alone made such a note look current and it was skipped forever.

Check on it:

```bash
launchctl print gui/$(id -u)/com.the-ark.ollama | grep -E 'state|pid'
tail -f ~/Library/Logs/the-ark-ollama.log
```

## Daily use

- New repo? Run `/init-agents` in a session — stamps a tailored `AGENTS.md` (+ `CLAUDE.md` symlink) from the repo's actual contents.
- Feature work flows through the skills: `brainstorming` → `writing-plans` → `executing-plans`, with specs under `docs/the-ark/specs/` and tickets as vault issues.
- Every session opens with `skills/using-the-ark/SKILL.md` injected by the SessionStart hook, in both Claude Code and Codex. Edit that file to change how skills get invoked.
- Edit a skill here, commit, `git pull` elsewhere — every machine and harness picks it up immediately.
