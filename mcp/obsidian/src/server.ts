import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import fs from "fs";

import { readNote, writeNote, updateNote } from "./tools/notes.js";
import { searchVault } from "./tools/search.js";
import { listNotes, moveNote } from "./tools/navigation.js";
import { createProject } from "./tools/projects.js";
import { reindexVault } from "./tools/index.js";
import { createIssue, updateIssueStatus, listFilteredIssues } from "./tools/issues.js";
import { PROJECTS_DIR } from "./config.js";

const VAULT_PATH = process.env.VAULT_PATH;

if (!VAULT_PATH) {
  console.error("Error: VAULT_PATH environment variable is required");
  process.exit(1);
}

if (!fs.existsSync(VAULT_PATH)) {
  console.error(`Error: Vault path does not exist: ${VAULT_PATH}`);
  process.exit(1);
}

const server = new McpServer({
  name: "obsidian-vault",
  version: "1.0.0",
});

// --- Tool Registration ---

server.tool(
  "read_note",
  "Read a note by path relative to vault root",
  { path: z.string().describe("Note path relative to vault root, e.g. 'notes/my-note.md'") },
  async ({ path: notePath }) => ({
    content: [{ type: "text", text: await readNote(VAULT_PATH, notePath) }],
  })
);

server.tool(
  "write_note",
  "Create a new note at the given path",
  {
    path: z.string().describe("Note path relative to vault root"),
    content: z.string().describe("Markdown content for the note"),
  },
  async ({ path: notePath, content }) => ({
    content: [{ type: "text", text: await writeNote(VAULT_PATH, notePath, content) }],
  })
);

server.tool(
  "update_note",
  "Update an existing note: append, prepend, or replace a section",
  {
    path: z.string().describe("Note path relative to vault root"),
    content: z.string().describe("Content to add or replace"),
    mode: z.enum(["append", "prepend", "replace-section"]).describe("How to apply the update"),
    section: z.string().optional().describe("Section heading name (required for replace-section mode)"),
  },
  async ({ path: notePath, content, mode, section }) => ({
    content: [{ type: "text", text: await updateNote(VAULT_PATH, notePath, content, mode, section) }],
  })
);

server.tool(
  "search_vault",
  "Hybrid FTS5 + vector semantic search. Returns top N results with paths and excerpts.",
  {
    query: z.string().describe("Search query"),
    limit: z.number().optional().default(5).describe("Max results to return (default 5)"),
  },
  async ({ query, limit }) => {
    const results = await searchVault(VAULT_PATH, query, limit);
    return {
      content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
    };
  }
);

server.tool(
  "list_notes",
  "List notes in a folder, optionally recursive",
  {
    folder: z.string().optional().default("").describe("Folder path relative to vault root (default: root)"),
    recursive: z.boolean().optional().default(false).describe("Include subfolders"),
  },
  async ({ folder, recursive }) => {
    const notes = await listNotes(VAULT_PATH, folder, recursive);
    return {
      content: [{ type: "text", text: JSON.stringify(notes, null, 2) }],
    };
  }
);

server.tool(
  "move_note",
  "Move or rename a note, updating the index",
  {
    from: z.string().describe("Current path relative to vault root"),
    to: z.string().describe("New path relative to vault root"),
  },
  async ({ from, to }) => ({
    content: [{ type: "text", text: await moveNote(VAULT_PATH, from, to) }],
  })
);

server.tool(
  "create_project",
  `Scaffold a project folder under ${PROJECTS_DIR}/ with starter files`,
  {
    name: z.string().describe("Project name"),
  },
  async ({ name }) => ({
    content: [{ type: "text", text: await createProject(VAULT_PATH, name) }],
  })
);

server.tool(
  "reindex_vault",
  "Full vault crawl: rebuild FTS5 and vector index, skipping unchanged files. Removes stale entries for deleted files",
  {},
  async () => {
    const result = await reindexVault(VAULT_PATH);
    return {
      content: [
        {
          type: "text",
          text: `Reindex complete: ${result.indexed} indexed, ${result.skipped} skipped, ${result.removed} stale entries removed, ${result.issuesRebuilt} issues rebuilt`,
        },
      ],
    };
  }
);

// --- Issue Tracking Tools ---

server.tool(
  "create_issue",
  "Create a tracked issue with status and priority. Stores as a note in the project's issues/ folder.",
  {
    title: z.string().describe("Issue title"),
    type: z.enum(["bug", "feature", "task"]).describe("Issue type"),
    priority: z.number().min(1).max(5).describe("Priority: 1 (critical) to 5 (trivial)"),
    description: z.string().optional().default("").describe("Issue description"),
    project: z.string().describe(`Project name (folder under ${PROJECTS_DIR}/)`),
  },
  async ({ title, type, priority, description, project }) => ({
    content: [{ type: "text", text: await createIssue(VAULT_PATH, title, type, priority, description, project) }],
  })
);

server.tool(
  "update_issue",
  "Update an issue's status, priority, or add notes",
  {
    project: z.string().describe("Project the issue belongs to"),
    id: z.number().describe("Issue ID (scoped to project)"),
    status: z.enum(["backlog", "not_started", "in_progress", "code_review", "done", "blocked"]).optional().describe("New status"),
    priority: z.number().min(1).max(5).optional().describe("New priority"),
    title: z.string().optional().describe("New title"),
    notes: z.string().optional().describe("Progress note to append"),
  },
  async ({ project, id, status, priority, title, notes }) => ({
    content: [{ type: "text", text: await updateIssueStatus(VAULT_PATH, project, id, { status, priority, title, notes }) }],
  })
);

server.tool(
  "list_issues",
  "List issues filtered by status, type, priority, or project. Sorted by priority.",
  {
    status: z.union([
      z.enum(["backlog", "not_started", "in_progress", "code_review", "done", "blocked"]),
      z.array(z.enum(["backlog", "not_started", "in_progress", "code_review", "done", "blocked"])),
    ]).optional().describe("Filter by status (single or array)"),
    type: z.enum(["bug", "feature", "task"]).optional().describe("Filter by type"),
    priority: z.number().min(1).max(5).optional().describe("Show issues at this priority or higher (lower number = higher priority)"),
    project: z.string().optional().describe("Filter by project name"),
  },
  async ({ status, type, priority, project }) => ({
    content: [{ type: "text", text: await listFilteredIssues(VAULT_PATH, { status, type, priority, project }) }],
  })
);

// --- Start Server ---

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Server failed to start:", err);
  process.exit(1);
});
