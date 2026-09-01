# Global Agent Instructions

## Obsidian Brain

I have a personal knowledge vault managed via an Obsidian MCP server. The vault lives at `~/Documents/brain/`.

### Search-First Workflow (CRITICAL)

The vault is a vector-indexed knowledge base. **Always query it before acting on any task or question.** This is the core workflow:

1. **User asks a question or requests a task**
2. **Search the vault first** -- `search_vault(query="relevant terms")` to find existing context, prior decisions, related issues, research, and notes
3. **Use what you find** -- build on existing knowledge instead of starting from scratch
4. **Work on the task** -- with full context from the vault
5. **Capture knowledge as you go** -- save ideas, decisions, research, and discoveries during the conversation (not just at the end)

This prevents duplicate work, surfaces prior decisions, and builds the knowledge base over time. The search is fast (hybrid FTS + vector semantic) -- use it liberally.

### When to use specific tools

- **`search_vault`** -- Before starting any task. When the user references prior work. When you need context on a topic.
- **`write_note` / `update_note`** -- Continuously during conversation. Save ideas, decisions, research, knowledge as they emerge.
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

- **CLI-delivered code is the default.** Unless the user asks at the start of the conversation for direct workspace edits, do not write or modify code files. Instead, deliver hand-written implementation for the user to apply in their CLI. Every proposed change must include: the absolute file path; current line number(s) or a unique symbol/anchor; enough unchanged context above and below the edit to locate it safely; and an exact, copyable command or unified patch. State any prerequisite command, verification command, and ordering dependency. Inspect the current file immediately before preparing the change so its context is current. The user may opt out for the entire conversation with a clear opening instruction such as “edit files directly” or “apply the changes.”
- Never run `git commit` unless I explicitly ask for one in the current conversation. I commit myself.
- New repo without an AGENTS.md? Offer `/init-agents` to stamp one.
