import * as sqliteVec from "sqlite-vec";
import { getDb } from "./fts.js";

let vecInitialized = false;
let vecAvailable = true;

export function initVec(vaultPath: string): boolean {
  if (vecInitialized) return vecAvailable;

  try {
    const db = getDb(vaultPath);
    sqliteVec.load(db);

    db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS notes_vec USING vec0(
        path TEXT PRIMARY KEY,
        embedding FLOAT[768]
      );
    `);

    vecInitialized = true;
    vecAvailable = true;
  } catch (err) {
    console.warn(
      "[WARN] sqlite-vec failed to load — vector search disabled, FTS-only mode active.\n" +
        "  Try: npm rebuild sqlite-vec\n" +
        "  Error:",
      err
    );
    vecInitialized = true;
    vecAvailable = false;
  }

  return vecAvailable;
}

export function upsertVector(
  vaultPath: string,
  notePath: string,
  embedding: number[]
): void {
  if (!initVec(vaultPath)) return;
  const db = getDb(vaultPath);

  db.prepare("DELETE FROM notes_vec WHERE path = ?").run(notePath);
  db.prepare(
    "INSERT INTO notes_vec (path, embedding) VALUES (?, ?)"
  ).run(notePath, new Float32Array(embedding));
}

export function queryVector(
  vaultPath: string,
  embedding: number[],
  limit: number = 5
): Array<{ path: string; distance: number }> {
  if (!initVec(vaultPath)) return [];
  const db = getDb(vaultPath);

  const rows = db
    .prepare(
      `SELECT path, distance
       FROM notes_vec
       WHERE embedding MATCH ?
       ORDER BY distance
       LIMIT ?`
    )
    .all(new Float32Array(embedding), limit) as Array<{
    path: string;
    distance: number;
  }>;

  return rows;
}

export function deleteVector(vaultPath: string, notePath: string): void {
  if (!initVec(vaultPath)) return;
  const db = getDb(vaultPath);
  db.prepare("DELETE FROM notes_vec WHERE path = ?").run(notePath);
}

export function allVectorPaths(vaultPath: string): string[] {
  if (!initVec(vaultPath)) return [];
  const db = getDb(vaultPath);
  const rows = db
    .prepare("SELECT path FROM notes_vec")
    .all() as Array<{ path: string }>;
  return rows.map((r) => r.path);
}

export function updateVectorPath(
  vaultPath: string,
  oldPath: string,
  newPath: string,
  embedding: number[]
): void {
  deleteVector(vaultPath, oldPath);
  upsertVector(vaultPath, newPath, embedding);
}
