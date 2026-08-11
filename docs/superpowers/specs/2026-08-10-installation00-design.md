# installation00 — Agent Harness Startup Repo: Design

**Date:** 2026-08-10
**Status:** Approved design; phase 1 (MCP port) scoped for implementation

## Purpose

installation00 is an all-in-one agent harness startup repo — dotfiles for agent tooling. Clone it on any machine, run one script, and get:

- The Obsidian MCP server built, configured, and registered in every harness
- A curated set of custom skills, identical across machines and harnesses
- A preferred global instructions file (AGENTS.md) and per-repo AGENTS.md templates

**Primary motivator:** use the same skills and workflows across multiple devices *and across harnesses* — specifically Claude Code and Codex, kept in lockstep so the two can be compared fairly.

## Key decisions

1. **Absorb obsidian-brain.** The MCP server code moves into this repo (`mcp/obsidian/`), which becomes its canonical home. The old repo is archived after migration.
2. **Symmetric setup script; no plugin.** A Claude Code plugin was considered and rejected: plugins are Claude Code-only, and they run from a managed clone updated on a separate trigger from the working checkout — so Claude Code and Codex would silently drift to different skill versions, defeating the sync goal. Instead, one setup script serves both harnesses identically from a single git checkout. A plugin wrapper may be added later as a distribution layer.
3. **Per-skill symlinks** (modeled on Matt Pocock's `link-skills.sh`): each skill directory is symlinked individually into `~/.claude/skills` and `~/.agents/skills`. The harness skill dirs stay real directories that can hold skills from other sources. Guard against the whole-dir-symlink footgun (a harness skills dir that is itself a symlink into this repo).
4. **One shared global instructions file**, written harness-neutral, symlinked to both `~/.claude/CLAUDE.md` and Codex's global instructions file (`~/.codex/AGENTS.md` — confirm exact path against the installed Codex version during phase 2). Split into variants only if a real conflict appears.
5. **Per-repo AGENTS.md templates delivered by a skill** (`init-agents`), not a CLI: the skill inspects the repo, picks the closest template, tailors it, and writes `AGENTS.md`. Being a skill, it distributes through the same symlink mechanism and works in both harnesses.
6. **Full-auto Ollama bootstrap**: install via brew if missing, pull `embeddinggemma`, health-check. Non-fatal on failure — the MCP server already degrades gracefully to FTS-only search.
7. **Vault-structure generalization (phase 1 mod):** the server must not require a particular vault layout. Structure conventions belong to the user's in-vault CLAUDE.md, not the server.

## Repo layout

```
installation00/
├── README.md
├── setup.sh                    # the one command a fresh machine runs
├── mcp/
│   └── obsidian/               # absorbed from obsidian-brain (src/, package.json, tsconfig.json)
├── skills/
│   ├── init-agents/            # template-stamping skill (SKILL.md)
│   └── <your-skills>/          # curated set, seeded from the Pocock clone, refined by Will
├── agents/
│   ├── AGENTS.global.md        # single shared global instructions file
│   └── templates/              # per-repo templates (default.md, node.md, python.md, ...)
├── scripts/
│   ├── link-skills.sh          # per-skill symlinks → ~/.claude/skills + ~/.agents/skills
│   ├── setup-ollama.sh         # brew install if missing, pull model, health check
│   └── register-mcp.sh         # register obsidian server in both harness configs
└── docs/
    └── superpowers/specs/      # design docs (this file)
```

## setup.sh flow (idempotent — safe to re-run)

1. **Prereqs:** Node 18+, git, brew (macOS). Fail early with clear messages.
2. **Build MCP:** `npm install && npm run build` in `mcp/obsidian/`.
3. **Ollama:** install via brew if absent, `ollama pull embeddinggemma`, verify `localhost:11434` responds. Warn-and-continue on any failure.
4. **Link skills:** per-skill symlinks into `~/.claude/skills` and `~/.agents/skills`.
5. **Link global instructions:** `agents/AGENTS.global.md` → `~/.claude/CLAUDE.md` and Codex's global AGENTS.md. If a real (non-symlink) file exists at a target, back it up to `*.bak` — never silently destroy.
6. **Register MCP:** add the obsidian server to both harness configs, preferring each harness's own CLI (`claude mcp add --scope user`; Codex equivalent) over hand-editing config files. `VAULT_PATH` defaults to `~/Documents/brain`, overridable via env var or flag.

New machine: `git clone` → `./setup.sh`. Updates: `git pull` (symlinks propagate instantly); re-run `setup.sh` only when MCP code changes.

## Phase 1: MCP port + generalization

### Port

- Copy the obsidian-brain server source into `mcp/obsidian/` (fresh files, no git history carried over; the archived repo keeps the history).
- Verify: builds, runs against the real vault, all tools function (search, notes, issues, reindex).
- Archive the obsidian-brain repo after verification.

### Generalization

Audit result (verified 2026-08-10): the only *code-level* structure coupling is the `02-projects/` prefix inside the project/issue subsystem — `src/tools/projects.ts` (scaffold path), `src/tools/issues.ts` (issue note path), `src/tools/index.ts` (project-derivation regex during reindex), and tool description strings in `src/server.ts`. All other tools are path-agnostic. The `00-inbox`…`07-work` taxonomy exists only in the README.

Changes:

1. **`PROJECTS_DIR` env var**, default `02-projects`. All four coupling sites read from it. Existing vault behavior is unchanged by default.
2. **README rewrite:** document the tools; state that structure conventions belong in the vault's own CLAUDE.md (loaded automatically each session). Show the current taxonomy as *an example*, not a requirement.

Explicitly kept as-is: `create_project` scaffolding and the dual-store (SQLite + markdown) issue tracker — they are the primary use case. `issues/active/` and `issues/done/` subfolder behavior within a project is retained.

## Later phases (not in scope for phase 1)

- **Phase 2:** setup.sh + the three scripts (link-skills, setup-ollama, register-mcp)
- **Phase 3:** seed `skills/` from the Pocock clone (curation/refinement is Will's, done separately)
- **Phase 4:** `AGENTS.global.md` (seeded from current `~/.claude/CLAUDE.md`), first templates, `init-agents` skill
- **Phase 5:** end-to-end test on this machine, both harnesses

## Out of scope (YAGNI)

Plugin packaging, Windows/Linux support, auto-update machinery, per-harness instruction variants, changes to the issue tracker's data model.

## Error handling principles

- Setup steps that touch user files back up real files before replacing; symlinks may be overwritten freely.
- Ollama problems never block setup (FTS-only fallback exists).
- Idempotency throughout: every script safe to re-run.

## Testing

- **MCP port (phase 1):** build passes; manual smoke test of each tool against the real vault via a live session; reindex produces expected counts. A `PROJECTS_DIR` override smoke test against a scratch vault confirms the default and the override both work.
- **Setup scripts (phase 2):** dry-run mode plus verification on this machine; idempotency check (run twice, second run is a no-op).
