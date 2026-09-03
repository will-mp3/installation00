# the-ark

The Ark: Halo ring (agent harness) factory. Primary function is to destroy flood outbreaks (hand coding).

Dotfiles for agent tooling. One repo that puts the same setup on every machine, for every harness:

- **memory-layer MCP server** (`mcp/memory-layer/`) — persistent, token-efficient access to a markdown knowledge store, with hybrid search and issue tracking
- **Skills** (`skills/`) — a curated engineering + productivity skill set, wired to the vault
- **Global instructions** (`agents/AGENTS.global.md`) — one harness-neutral file serving Claude Code and Codex
- **Status line** (`statusline/statusline.sh`) — branch, model, context and usage bars, in both harnesses

Both harnesses run the *same files* from this checkout via symlinks — `git pull` updates everything, everywhere, at once.

## Setup

```bash
git clone <this repo>
cd the-ark
./setup.sh
```

That's it. The script is idempotent — re-run it any time. It will:

1. Install Homebrew and Node 18+ if they're missing (git you already have — you cloned this)
2. Build the MCP server
3. Install Ollama, install a launchd agent that keeps it running, and pull the embedding model
   (never fatal — search degrades to FTS-only without it)
4. Symlink every skill into `~/.claude/skills` (Claude Code) and `~/.agents/skills` (Codex)
5. Symlink `agents/AGENTS.global.md` to `~/.claude/CLAUDE.md` and `~/.codex/AGENTS.md` (existing real files are backed up to `.bak`)
6. Register the MCP server with both harness CLIs
7. Wire the SessionStart hook so every session loads `using-the-ark`
8. Wire the status line into both harnesses

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
mcp/memory-layer/   # MCP server source (see its README for tools and config)
skills/
  engineering/      # design, planning, implementation, review skills
  productivity/     # general workflow skills
agents/
  AGENTS.global.md  # the shared global instructions file
hooks/
  codex-hooks.json  # symlinked to ~/.codex/hooks.json
statusline/
  statusline.sh     # symlinked to ~/.claude/ark-statusline (Codex gets an item
                    # list in config.toml instead — see Status line)
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

## Status line

Both harnesses show `branch · model · context · 5-hour limit · weekly limit`. This is the one
piece of the ark that cannot be a single shared file, because the two take opposite shapes.

**Claude Code** runs an arbitrary command and renders its stdout, so it gets
`statusline/statusline.sh` — `branch | model | ctx: [bar] % | 5h: [bar] % | wk: [bar] %`, bars
going green → yellow → red as they fill. Two usage windows rather than one: the 5-hour limit is
what throttles a working session, the weekly one is what runs out mid-week.

`setup.sh` symlinks it to `~/.claude/ark-statusline` and points `settings.json` at that shim, so edits ship on `git pull` without re-running setup. An existing
*custom* `statusLine` is left alone and reported rather than overwritten.

Its one dependency is `jq`, which macOS has shipped at `/usr/bin/jq` since Ventura. Without it
the line degrades to a visible reminder instead of rendering blank.

**Codex** has no command hook. Its status line is a picker over a fixed vocabulary of items,
chosen with `/statusline` in the TUI and stored as `[tui].status_line` in `config.toml`. So it
cannot run the script; `setup.sh` writes the item set that renders the same fields:

```toml
[tui]
status_line = ["git-branch", "model", "context-used", "five-hour-limit", "weekly-limit"]
```

A `status_line` you have already set is never overwritten (an item set a previous ark version
wrote is upgraded, since that one is ours). The vocabulary is much larger than the five above —
`context-remaining`, `used-tokens`, `task-progress`,
`thread-credits`, `estimated-thread-cost`, `approval-mode`, `fast-mode`, `pull-request-number`
and more. Run `/statusline` to browse and change it; the same ids also drive `[tui].terminal_title`.

## Never approving vault tools

A knowledge store you have to click "allow" on is a knowledge store agents stop reaching for, so
`setup.sh` pre-approves the whole server in both harnesses:

- **Claude Code** — `mcp__memory-layer__*` in `permissions.allow`. The trailing `__*` is
  required, not decoration: Claude Code compares `mcp__<server>` as an exact string, so on its
  own it matches nothing. The wildcard also covers tools added to the server later, which an
  enumerated list would not — setup replaces any per-tool rules it supersedes.
- **Codex** — `default_tools_approval_mode = "approve"` on `[mcp_servers.memory-layer]`. Set on
  the server rather than per tool, for the same reason. It is written *after* `codex mcp add`,
  which rewrites the whole server table and would otherwise drop it — so it is re-applied on
  each run by design.

  The four values are `auto`, `prompt`, `writes`, `approve`, and **`approve` reads backwards**:
  it means *pre-approved*, not "ask for approval" — it is what Codex writes when you pick
  "Allow and don't ask me again". `auto` is the one that still prompts here: it derives the
  decision from the tool's MCP annotations (`read_only_hint`, `destructive_hint`,
  `open_world_hint`), and this server declares none, so nothing can be inferred and everything
  asks.

  Note `approval_policy = "never"` does *not* help — an MCP call that needs approval then fails
  outright with `MCP tool call requires approval, but approval policy is never`.

Both are skipped if you have set your own value.

## Upgrading from the `obsidian` name

The MCP server used to be called `obsidian`. Nothing in it was ever Obsidian-specific — it
reads and writes plain markdown — so it is now `memory-layer`. Re-running `setup.sh` moves you
over: the old registration is removed from both harnesses before the new one is added.

Two things it will not touch, and warns about instead, because they are your config:

- `mcp__obsidian__*` permission rules in `~/.claude/settings.json` — tool ids are namespaced by
  server name, so these are now `mcp__memory-layer__*`.
- `[mcp_servers.obsidian.tools.*]` approval blocks in `~/.codex/config.toml` — `codex mcp
  remove` drops the server table but leaves these behind.

## Daily use

- New repo? Run `/init-agents` in a session — stamps a tailored `AGENTS.md` (+ `CLAUDE.md` symlink) from the repo's actual contents.
- Feature work flows through the skills: `brainstorming` → `writing-plans` → `executing-plans`, with specs under `docs/the-ark/specs/` and tickets as vault issues.
- Every session opens with `skills/using-the-ark/SKILL.md` injected by the SessionStart hook, in both Claude Code and Codex. Edit that file to change how skills get invoked.
- Edit a skill here, commit, `git pull` elsewhere — every machine and harness picks it up immediately.
- Same for the status line: edit `statusline/statusline.sh` and the next render picks it up.
