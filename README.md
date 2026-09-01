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
3. Install/start Ollama and pull the embedding model (never fatal — search degrades to FTS-only without it)
4. Symlink every skill into `~/.claude/skills` (Claude Code) and `~/.agents/skills` (Codex)
5. Symlink `agents/AGENTS.global.md` to `~/.claude/CLAUDE.md` and `~/.codex/AGENTS.md` (existing real files are backed up to `.bak`)
6. Register the MCP server with both harness CLIs

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
```

## Daily use

- New repo? Run `/init-agents` in a session — stamps a tailored `AGENTS.md` (+ `CLAUDE.md` symlink) from the repo's actual contents.
- Feature work flows through the vault: `/grill-with-docs` → `/to-spec` → `/to-tickets` → `/implement`, with specs as project notes and tickets as vault issues.
- Edit a skill here, commit, `git pull` elsewhere — every machine and harness picks it up immediately.
