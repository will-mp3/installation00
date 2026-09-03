# memory-layer

A Node.js MCP server that gives coding agents persistent, token-efficient access to a
directory of markdown files. Hybrid full-text + semantic search, plus built-in issue tracking.

Nothing here is Obsidian-specific — the server reads and writes plain `.md` files with
optional YAML frontmatter, so any markdown store works: an Obsidian vault, a Logseq graph,
a docs folder, a bare git repo of notes. "Vault" below just means "the directory you
pointed `VAULT_PATH` at".

## Prerequisites

- Node.js 18+
- [Ollama](https://ollama.com) running locally with `embeddinggemma` pulled (optional — server works without it, FTS-only mode)

```bash
ollama pull embeddinggemma
```

## Setup

```bash
npm install
npm run build
```

### Register with Claude Code

Add the server to your MCP configuration. Create a `.mcp.json` file in your project root, or add to `~/.claude/mcp.json` for global access:

```json
{
  "mcpServers": {
    "memory-layer": {
      "command": "node",
      "args": ["/absolute/path/to/the-ark/mcp/memory-layer/dist/server.js"],
      "env": {
        "VAULT_PATH": "/absolute/path/to/your/markdown/store"
      }
    }
  }
}
```

For development, you can use `tsx` to run TypeScript directly without building:

```json
{
  "mcpServers": {
    "memory-layer": {
      "command": "npx",
      "args": ["tsx", "/absolute/path/to/the-ark/mcp/memory-layer/src/server.ts"],
      "env": {
        "VAULT_PATH": "/absolute/path/to/your/markdown/store"
      }
    }
  }
}
```

**Important:**
- Use absolute paths for both the server script and `VAULT_PATH`
- `VAULT_PATH` must point to an existing directory — the server will exit immediately if it is missing or invalid
- One server instance per store

### Configuration

| Env var | Required | Default | Purpose |
|---|---|---|---|
| `VAULT_PATH` | yes | — | Absolute path to the vault root |
| `PROJECTS_DIR` | no | `02-projects` | Vault-relative folder where `create_project` scaffolds and issue notes live |

### Verify connection

After configuring, restart your agent. The server should appear in the MCP tools list. If the connection fails, check:

1. `VAULT_PATH` is set and points to an existing directory
2. The path to the server script is correct and absolute
3. `npm install` (and `npm run build` if using compiled mode) has been run in this directory
4. Node.js 18+ is available

## Tools

### Notes

| Tool | Description |
|---|---|
| `read_note` | Read a note by path relative to vault root |
| `write_note` | Create a new note, auto-indexes it |
| `update_note` | Append, prepend, or replace a section; re-indexes |
| `move_note` | Move or rename a note, updates index |
| `list_notes` | List notes in a folder, optionally recursive |

### Search

| Tool | Description |
|---|---|
| `search_vault` | Hybrid FTS5 + vector semantic search. Returns top N results with paths and excerpts (default 5) |
| `reindex_vault` | Full vault crawl, rebuilds FTS5 and vector index. Skips unchanged files via mtime |

### Projects

| Tool | Description |
|---|---|
| `create_project` | Scaffold `<PROJECTS_DIR>/<name>/` with starter files (README.md, notes/, issues/) |

### Issue Tracking

| Tool | Description |
|---|---|
| `create_issue` | Create a tracked issue with type, priority, and description. Stored as a note in the project's `issues/active/` folder |
| `update_issue` | Change status, priority, or append progress notes. Updates both the SQLite record and the markdown note. Moves the note to `issues/done/` on completion |
| `list_issues` | Filter issues by status, type, priority, or project. Sorted by priority |

**Statuses:** backlog, not_started, in_progress, code_review, done, blocked

**Priorities:** P1 (critical), P2 (high), P3 (medium), P4 (low), P5 (trivial)

**Types:** bug, feature, task

## Vault Structure

The server does not impose a vault layout. Notes can live anywhere; search, read, write, and move work on any path under the vault root. The only structured location is `PROJECTS_DIR` (default `02-projects`), used by the project and issue tools: projects are folders under it, and each project's issues live in `<PROJECTS_DIR>/<project>/issues/active/` and `issues/done/`.

Everything else — folder taxonomy, naming conventions, where ideas vs research vs planning notes go — belongs to you, expressed in your vault's own `CLAUDE.md` (see below), not enforced by the server. As an example, the vault this server was built against uses numbered top-level folders (`00-inbox/`, `01-ideas/`, `02-projects/`, `03-research/`, …, `meta/`), but that is convention, not requirement.

## How It Works

### Search

1. `reindex_vault` walks all `.md` files, strips frontmatter, embeds via Ollama, and stores in SQLite (FTS5 + sqlite-vec)
2. `search_vault` runs keyword (FTS5) and semantic (vector cosine) queries in parallel, merges and deduplicates results
3. The agent calls `read_note` only on relevant results — this is the token efficiency mechanism

If Ollama is unavailable, the server falls back to FTS5-only search automatically. If `sqlite-vec` fails to load (e.g. missing native binary), the server falls back to FTS-only mode as well.

### Issue Tracking

Issues are dual-stored:
- **Markdown note** in `<PROJECTS_DIR>/<project>/issues/` — browsable in any markdown editor, includes frontmatter metadata and a notes log. Kept in sync when issues are updated.
- **SQLite table** in `.vault-index.db` — enables fast structured queries (filter by status, priority, type, project)

### Security

- All note paths are validated to stay within the vault boundary — path traversal attacks (e.g. `../../etc/passwd`) are rejected
- FTS5 search input is sanitized to prevent query operator injection

### Indexing

Each vault stores its index at `<VAULT_PATH>/.vault-index.db`. This file is generated and should not be committed to version control.

## CLAUDE.md

Your vault's conventions live in a `CLAUDE.md` at the vault root — it loads automatically each session and is the right place for structure rules the server deliberately doesn't enforce. Example rules:

- Never delete notes — move them to an inbox folder if unsure
- Search before creating — avoid duplicate notes
- Use the MCP tools instead of reading/writing vault files directly
- Folder roles and where each kind of note belongs

## Dependencies

| Package | Purpose |
|---|---|
| `@modelcontextprotocol/sdk` | MCP server framework |
| `better-sqlite3` | SQLite driver (FTS5) |
| `sqlite-vec` | Vector similarity extension for SQLite |
| `zod` | Schema validation for tool parameters |
| `tsx` | Run TypeScript directly |
| `typescript` | Language |
