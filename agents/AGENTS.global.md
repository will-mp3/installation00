# Global Agent Instructions

## Memory Layer

I have a personal knowledge vault served by the `memory-layer` MCP server. The vault lives at
`~/Documents/brain/` — a plain directory of markdown files, browsable in Obsidian but not
dependent on it.

### Search-When-Relevant Workflow

The vault is a vector-indexed knowledge base. Search it when prior decisions, research, tracked work, or other stored context could materially improve the answer. Skip it for self-contained questions, status checks, and narrow work whose necessary context is already in the conversation or workspace.

When you search:

1. **Search first** -- `search_vault(query="relevant terms")`
2. **Read only needed results** -- use the excerpt to decide whether a full note is necessary
3. **Use what you find** -- build on relevant context instead of starting from scratch
4. **Capture durable knowledge** -- save decisions, research, or discoveries that would help a future session; do not save transient progress

### When to use specific tools

- **`search_vault`** -- When the user references prior work or stored context could materially improve the task.
- **`write_note` / `update_note`** -- For durable decisions, research, and discoveries that would help a future session.
- **`create_issue` / `list_issues`** -- For tracking bugs, features, and tasks across sessions.
- **`read_note`** -- When search results point to a note you need full details from.

If I say things like "remember this", "save this", "look up", "find my notes on", "create a project for", or "track this issue" -- use the MCP tools. But also use them proactively without being asked.

### Available tools

| Tool | Purpose |
|---|---|
| `read_note` | Read a note by vault-relative path |
| `write_note` | Create a new note (auto-indexes) |
| `update_note` | Append, prepend, or replace a section |
| `move_note` | Move or rename a note |
| `list_notes` | List notes in a folder |
| `search_vault` | Hybrid full-text + semantic search |
| `reindex_vault` | Rebuild search index |
| `create_project` | Scaffold a project under the projects folder with empty README (populate with the project's existing README), notes/, and issues/ |
| `create_issue` | Create a tracked issue |
| `update_issue` | Update issue status or add notes |
| `list_issues` | Filter and list issues |

### Key rules

- **Always use MCP tools** — never read/write vault files directly
- **Use templates** — read from `templates/` before creating any note
- **Search before creating** — avoid duplicates
- **Never delete notes** — move to `00-inbox/` if unsure
- For full vault rules and structure, read `CLAUDE.md` and `meta/vault-structure.md` in the vault

## Working Rules

- **Tool output stays internal.** Never return raw tool output to the conversation. Shape every shell, MCP, browser, and file-read call to emit only the smallest fact needed—use targeted queries, narrow line ranges, explicit result limits, and bounded output. Do not dump whole files, skills, diffs, logs, directory listings, tool schemas, or command help. When broader inspection is needed, inspect it in small capped chunks and give the user a concise synthesis instead.
- Never run `git commit` unless I explicitly ask for one in the current conversation. I commit myself.
- New repo without an AGENTS.md? Offer `/init-agents` to stamp one.

## Code Quality

- All code must be production-ready, not prototype quality.
- DRY: abstract repeated logic into reusable functions; use existing shared components/utilities before creating new ones.
- Proper error handling with user-friendly messages.
- Comments explain "why", not "what" (code should be self-documenting).
- No emojis in code, comments, logs, commit messages, or documentation.
- Professional tone: clear, concise communication.

## Collaboration

- Discuss what, why, and how before implementation.
- Review existing code and dependencies before writing new code.
