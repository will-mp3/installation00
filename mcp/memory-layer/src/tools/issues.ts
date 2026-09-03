import {
  insertIssue,
  updateIssue as dbUpdateIssue,
  listIssues as dbListIssues,
  getIssue,
  type IssueStatus,
  type IssueType,
  type Issue,
} from "../db/issues.js";
import { writeNote, updateNote, readNote } from "./notes.js";
import { moveNote } from "./navigation.js";
import { PROJECTS_DIR } from "../config.js";

const STATUS_LABELS: Record<IssueStatus, string> = {
  backlog: "Backlog",
  not_started: "Not Started",
  in_progress: "In Progress",
  code_review: "Code Review",
  done: "Done",
  blocked: "Blocked",
};

const PRIORITY_LABELS: Record<number, string> = {
  1: "Critical",
  2: "High",
  3: "Medium",
  4: "Low",
  5: "Trivial",
};

function issueToMarkdown(issue: Issue, body: string): string {
  return `---
id: ${issue.id}
type: ${issue.type}
status: ${issue.status}
priority: ${issue.priority}
project: ${issue.project}
created: ${issue.created_at}
updated: ${issue.updated_at}
---

# ${issue.title}

**Status:** ${STATUS_LABELS[issue.status as IssueStatus]} | **Priority:** P${issue.priority} (${PRIORITY_LABELS[issue.priority]}) | **Type:** ${issue.type}

## Description

${body}

## Notes

`;
}

function formatIssueList(issues: Issue[]): string {
  if (issues.length === 0) return "No issues found.";

  const lines = issues.map(
    (i) =>
      `${i.project}#${i.id} [P${i.priority}] [${i.status}] (${i.type}) ${i.title}`
  );

  return lines.join("\n");
}

export async function createIssue(
  vaultPath: string,
  title: string,
  type: IssueType,
  priority: number,
  description: string = "",
  project: string
): Promise<string> {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const folder = `${PROJECTS_DIR}/${project}/issues/active`;
  const notePath = `${folder}/${type}-${slug}.md`;

  const issue = insertIssue(vaultPath, title, type, priority, notePath, project);
  const markdown = issueToMarkdown(issue, description);

  await writeNote(vaultPath, notePath, markdown);

  return `Created ${issue.project}#${issue.id}: ${title} [P${priority}] [${type}]\nNote: ${notePath}`;
}

export async function updateIssueStatus(
  vaultPath: string,
  project: string,
  id: number,
  fields: {
    status?: IssueStatus;
    priority?: number;
    title?: string;
    notes?: string;
  }
): Promise<string> {
  const issue = getIssue(vaultPath, project, id);
  if (!issue) return `Error: Issue ${project}#${id} not found`;

  const updated = dbUpdateIssue(vaultPath, project, id, fields);
  if (!updated) return `Error: Failed to update issue ${project}#${id}`;

  // Rewrite the note with updated frontmatter and status line
  const noteContent = await readNote(vaultPath, updated.note_path);
  if (!noteContent.startsWith("Error:")) {
    const newFrontmatter = `---
id: ${updated.id}
type: ${updated.type}
status: ${updated.status}
priority: ${updated.priority}
project: ${updated.project}
created: ${updated.created_at}
updated: ${updated.updated_at}
---`;

    const newStatusLine = `**Status:** ${STATUS_LABELS[updated.status as IssueStatus]} | **Priority:** P${updated.priority} (${PRIORITY_LABELS[updated.priority]}) | **Type:** ${updated.type}`;

    let rewritten = noteContent.replace(
      /^---[\s\S]*?---/,
      newFrontmatter
    );

    rewritten = rewritten.replace(
      /\*\*Status:\*\*.*?\*\*Type:\*\*\s*\w+/,
      newStatusLine
    );

    await writeNote(vaultPath, updated.note_path, rewritten);
  }

  // Move note to done/ when status changes to done
  let currentPath = updated.note_path;
  if (fields.status === "done" && currentPath.includes("/issues/active/")) {
    const newPath = currentPath.replace("/issues/active/", "/issues/done/");
    await moveNote(vaultPath, currentPath, newPath);
    dbUpdateIssue(vaultPath, project, id, { note_path: newPath });
    currentPath = newPath;
  }

  // If notes were provided, append them
  if (fields.notes) {
    const timestamp = new Date().toISOString().split("T")[0];
    await updateNote(
      vaultPath,
      currentPath,
      `- ${timestamp}: ${fields.notes}`,
      "append"
    );
  }

  const changes: string[] = [];
  if (fields.status) changes.push(`status -> ${fields.status}`);
  if (fields.priority) changes.push(`priority -> P${fields.priority}`);
  if (fields.title) changes.push(`title -> ${fields.title}`);
  if (fields.notes) changes.push(`added note`);

  return `Updated ${project}#${id}: ${changes.join(", ")}`;
}

export async function listFilteredIssues(
  vaultPath: string,
  filters: {
    status?: IssueStatus | IssueStatus[];
    type?: IssueType;
    priority?: number;
    project?: string;
  } = {}
): Promise<string> {
  const effectiveFilters = { ...filters };
  if (effectiveFilters.status === undefined) {
    effectiveFilters.status = ["backlog", "not_started", "in_progress", "code_review", "blocked"];
  }
  const issues = dbListIssues(vaultPath, effectiveFilters);
  return formatIssueList(issues);
}
