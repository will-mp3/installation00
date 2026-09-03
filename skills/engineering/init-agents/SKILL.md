---
name: init-agents
description: Stamp an AGENTS.md into the current repo from a template, tailored to what the repo actually contains. Use when a repo has no agent instructions, or the user says "init agents" or asks for an AGENTS.md.
disable-model-invocation: true
---

Write an `AGENTS.md` for the current repo: pick the closest template from this skill's `templates/` directory, fill it from what the repo actually contains, and wire it up for every harness.

## Process

### 1. Check what exists

Look for `AGENTS.md` and `CLAUDE.md` at the repo root. If either exists, show the user what's there and ask whether to update it or start over — never silently overwrite.

### 2. Inspect the repo

Establish, from the repo itself (not assumptions):

- What the project is — README, package manifest description
- Language and toolchain — package.json / pyproject.toml / go.mod / Cargo.toml etc.
- The real commands — build, test, lint, run, as defined in the manifest or Makefile, verified against what's actually configured
- Layout — top-level directories and what lives in each
- Conventions already in force — linter configs, formatter settings, CI checks

### 3. Fill the template

Read `templates/default.md` (in this skill's directory) and fill it in. Rules:

- Every command you write down must exist in the repo's config — no invented commands.
- Describe the layout that is, not the layout that ought to be.
- Keep it short. An AGENTS.md is always-loaded context; every line costs on every turn of every future session. Point to docs rather than inlining them.
- Omit template sections that have nothing real to say — an empty heading is noise.

### 4. Wire up both harnesses

- Write the result to `AGENTS.md` at the repo root.
- If no `CLAUDE.md` exists, symlink it: `ln -s AGENTS.md CLAUDE.md` — Claude Code reads CLAUDE.md, Codex reads AGENTS.md, and the symlink keeps them one file.

### 5. Link the vault

If the memory-layer MCP is connected, check whether this repo has a vault project (`search_vault` / `list_notes` on the projects folder). If it does, make sure the AGENTS.md's Vault section names it. If not, offer to `create_project` — don't create one unbidden.

Show the user the final file.
