import Database from "better-sqlite3";
import path from "path";

let db: Database.Database | null = null;

export function getDb(vaultPath: string): Database.Database {
  if (db) return db;

  const dbPath = path.join(vaultPath, ".vault-index.db");
  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS notes_meta (
      path TEXT PRIMARY KEY,
      mtime INTEGER NOT NULL
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
      path,
      title,
      content,
      tokenize='porter'
    );
  `);

  return db;
}

export function upsertFTS(
  vaultPath: string,
  notePath: string,
  title: string,
  content: string,
  mtime: number
): void {
  const db = getDb(vaultPath);

  const existing = db
    .prepare("SELECT path FROM notes_meta WHERE path = ?")
    .get(notePath) as { path: string } | undefined;

  if (existing) {
    db.prepare(
      "DELETE FROM notes_fts WHERE path = ?"
    ).run(notePath);
    db.prepare(
      "UPDATE notes_meta SET mtime = ? WHERE path = ?"
    ).run(mtime, notePath);
  } else {
    db.prepare(
      "INSERT INTO notes_meta (path, mtime) VALUES (?, ?)"
    ).run(notePath, mtime);
  }

  db.prepare(
    "INSERT INTO notes_fts (path, title, content) VALUES (?, ?, ?)"
  ).run(notePath, title, content);
}

export function queryFTS(
  vaultPath: string,
  term: string,
  limit: number = 5
): Array<{ path: string; snippet: string }> {
  const db = getDb(vaultPath);

  // Quote each word individually to prevent FTS5 operator injection
  // while preserving implicit AND semantics and porter stemming
  const safeTerm = term
    .replace(/"/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 0)
    .map((w) => `"${w}"`)
    .join(" ");

  try {
    const rows = db
      .prepare(
        `SELECT path, snippet(notes_fts, 2, '<mark>', '</mark>', '...', 40) as snippet
         FROM notes_fts
         WHERE notes_fts MATCH ?
         ORDER BY rank
         LIMIT ?`
      )
      .all(safeTerm, limit) as Array<{ path: string; snippet: string }>;

    return rows;
  } catch {
    return [];
  }
}

export function getMtime(
  vaultPath: string,
  notePath: string
): number | null {
  const db = getDb(vaultPath);
  const row = db
    .prepare("SELECT mtime FROM notes_meta WHERE path = ?")
    .get(notePath) as { mtime: number } | undefined;
  return row?.mtime ?? null;
}

export function deleteFTS(vaultPath: string, notePath: string): void {
  const db = getDb(vaultPath);
  db.prepare("DELETE FROM notes_fts WHERE path = ?").run(notePath);
  db.prepare("DELETE FROM notes_meta WHERE path = ?").run(notePath);
}

export function allIndexedPaths(vaultPath: string): string[] {
  const db = getDb(vaultPath);
  const rows = db
    .prepare("SELECT path FROM notes_meta")
    .all() as Array<{ path: string }>;
  return rows.map((r) => r.path);
}

export function updatePath(
  vaultPath: string,
  oldPath: string,
  newPath: string
): void {
  const db = getDb(vaultPath);

  const row = db
    .prepare("SELECT title, content FROM notes_fts WHERE path = ?")
    .get(oldPath) as { title: string; content: string } | undefined;

  if (!row) return;

  db.prepare("DELETE FROM notes_fts WHERE path = ?").run(oldPath);
  db.prepare(
    "INSERT INTO notes_fts (path, title, content) VALUES (?, ?, ?)"
  ).run(newPath, row.title, row.content);

  db.prepare(
    "UPDATE notes_meta SET path = ? WHERE path = ?"
  ).run(newPath, oldPath);
}
