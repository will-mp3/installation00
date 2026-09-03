import { getDb } from "./fts.js";

export type IssueStatus =
  | "backlog"
  | "not_started"
  | "in_progress"
  | "code_review"
  | "done"
  | "blocked";

export type IssueType = "bug" | "feature" | "task";

export interface Issue {
  id: number;
  title: string;
  type: IssueType;
  status: IssueStatus;
  priority: number;
  project: string;
  note_path: string;
  created_at: string;
  updated_at: string;
}

export function initIssuesTable(vaultPath: string): void {
  const db = getDb(vaultPath);

  db.exec(`
    CREATE TABLE IF NOT EXISTS issues (
      project TEXT NOT NULL,
      id INTEGER NOT NULL,
      title TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('bug', 'feature', 'task')),
      status TEXT NOT NULL DEFAULT 'not_started'
        CHECK(status IN ('backlog', 'not_started', 'in_progress', 'code_review', 'done', 'blocked')),
      priority INTEGER NOT NULL CHECK(priority BETWEEN 1 AND 5),
      note_path TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (project, id)
    );

    CREATE INDEX IF NOT EXISTS idx_issues_status ON issues(status);
    CREATE INDEX IF NOT EXISTS idx_issues_priority ON issues(priority);
    CREATE INDEX IF NOT EXISTS idx_issues_type ON issues(type);
    CREATE INDEX IF NOT EXISTS idx_issues_project ON issues(project);
  `);
}

export function insertIssue(
  vaultPath: string,
  title: string,
  type: IssueType,
  priority: number,
  notePath: string,
  project: string
): Issue {
  initIssuesTable(vaultPath);
  const db = getDb(vaultPath);

  const row = db
    .prepare("SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM issues WHERE project = ?")
    .get(project) as { next_id: number };

  db.prepare(
    `INSERT INTO issues (project, id, title, type, priority, note_path)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(project, row.next_id, title, type, priority, notePath);

  return db
    .prepare("SELECT * FROM issues WHERE project = ? AND id = ?")
    .get(project, row.next_id) as Issue;
}

export function getIssue(vaultPath: string, project: string, id: number): Issue | null {
  initIssuesTable(vaultPath);
  const db = getDb(vaultPath);
  return db.prepare("SELECT * FROM issues WHERE project = ? AND id = ?").get(project, id) as
    | Issue
    | null;
}

export function updateIssue(
  vaultPath: string,
  project: string,
  id: number,
  fields: {
    status?: IssueStatus;
    priority?: number;
    title?: string;
    note_path?: string;
  }
): Issue | null {
  initIssuesTable(vaultPath);
  const db = getDb(vaultPath);

  const sets: string[] = ["updated_at = datetime('now')"];
  const values: unknown[] = [];

  if (fields.status !== undefined) {
    sets.push("status = ?");
    values.push(fields.status);
  }
  if (fields.priority !== undefined) {
    sets.push("priority = ?");
    values.push(fields.priority);
  }
  if (fields.title !== undefined) {
    sets.push("title = ?");
    values.push(fields.title);
  }
  if (fields.note_path !== undefined) {
    sets.push("note_path = ?");
    values.push(fields.note_path);
  }

  values.push(project, id);

  db.prepare(`UPDATE issues SET ${sets.join(", ")} WHERE project = ? AND id = ?`).run(
    ...values
  );

  return db.prepare("SELECT * FROM issues WHERE project = ? AND id = ?").get(project, id) as
    | Issue
    | null;
}

export function listIssues(
  vaultPath: string,
  filters: {
    status?: IssueStatus | IssueStatus[];
    type?: IssueType;
    priority?: number;
    project?: string;
  } = {}
): Issue[] {
  initIssuesTable(vaultPath);
  const db = getDb(vaultPath);

  const conditions: string[] = [];
  const values: unknown[] = [];

  if (filters.status !== undefined) {
    if (Array.isArray(filters.status)) {
      const placeholders = filters.status.map(() => "?").join(", ");
      conditions.push(`status IN (${placeholders})`);
      values.push(...filters.status);
    } else {
      conditions.push("status = ?");
      values.push(filters.status);
    }
  }

  if (filters.type !== undefined) {
    conditions.push("type = ?");
    values.push(filters.type);
  }

  if (filters.priority !== undefined) {
    conditions.push("priority <= ?");
    values.push(filters.priority);
  }

  if (filters.project !== undefined) {
    conditions.push("project = ?");
    values.push(filters.project);
  }

  const where =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  return db
    .prepare(
      `SELECT * FROM issues ${where} ORDER BY priority ASC, updated_at DESC`
    )
    .all(...values) as Issue[];
}

export function rebuildIssues(vaultPath: string, issues: Issue[]): number {
  initIssuesTable(vaultPath);
  const db = getDb(vaultPath);

  db.prepare("DELETE FROM issues").run();

  const insert = db.prepare(
    `INSERT INTO issues (project, id, title, type, status, priority, note_path, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  const tx = db.transaction(() => {
    for (const i of issues) {
      insert.run(i.project, i.id, i.title, i.type, i.status, i.priority, i.note_path, i.created_at, i.updated_at);
    }
  });
  tx();

  return issues.length;
}
