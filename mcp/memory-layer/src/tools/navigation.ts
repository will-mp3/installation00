import fs from "fs";
import path from "path";
import { updatePath } from "../db/fts.js";
import { updateVectorPath } from "../db/vectors.js";
import { embed } from "../embeddings/ollama.js";

function validatePath(vaultPath: string, notePath: string): string | null {
  const resolved = path.resolve(vaultPath, notePath);
  if (!resolved.startsWith(path.resolve(vaultPath) + path.sep) && resolved !== path.resolve(vaultPath)) {
    return `Error: Path "${notePath}" escapes vault boundary`;
  }
  return null;
}

function walkDir(
  dir: string,
  recursive: boolean,
  base: string
): string[] {
  const results: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;

    const fullPath = path.join(dir, entry.name);
    const relPath = path.relative(base, fullPath);

    if (entry.isFile() && entry.name.endsWith(".md")) {
      results.push(relPath);
    } else if (entry.isDirectory() && recursive) {
      results.push(...walkDir(fullPath, true, base));
    }
  }

  return results;
}

export async function listNotes(
  vaultPath: string,
  folder: string = "",
  recursive: boolean = false
): Promise<string[]> {
  if (folder) {
    const pathError = validatePath(vaultPath, folder);
    if (pathError) return [];
  }

  const targetDir = path.join(vaultPath, folder);

  if (!fs.existsSync(targetDir)) {
    return [];
  }

  return walkDir(targetDir, recursive, vaultPath);
}

export async function moveNote(
  vaultPath: string,
  from: string,
  to: string
): Promise<string> {
  const fromError = validatePath(vaultPath, from);
  if (fromError) return fromError;
  const toError = validatePath(vaultPath, to);
  if (toError) return toError;

  const fromFull = path.join(vaultPath, from);
  const toFull = path.join(vaultPath, to);

  if (!fs.existsSync(fromFull)) {
    return `Error: Note not found at ${from}`;
  }

  const toDir = path.dirname(toFull);
  if (!fs.existsSync(toDir)) {
    fs.mkdirSync(toDir, { recursive: true });
  }

  // Read content before moving for re-indexing
  const content = fs.readFileSync(fromFull, "utf-8");

  fs.renameSync(fromFull, toFull);

  // Update FTS index
  updatePath(vaultPath, from, to);

  // Update vector index
  const embedding = await embed(content);
  if (embedding) {
    updateVectorPath(vaultPath, from, to, embedding);
  }

  return `Moved ${from} → ${to}`;
}
