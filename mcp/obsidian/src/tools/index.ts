import fs from "fs";
import path from "path";
import { getMtime, upsertFTS, deleteFTS, allIndexedPaths } from "../db/fts.js";
import { upsertVector, deleteVector, allVectorPaths } from "../db/vectors.js";
import { embed } from "../embeddings/ollama.js";
import { rebuildIssues, type Issue } from "../db/issues.js";
import { PROJECTS_DIR, escapeRegExp } from "../config.js";

const PROJECT_ISSUE_RE = new RegExp(`^${escapeRegExp(PROJECTS_DIR)}/([^/]+)/issues/`);

function stripFrontmatter(content: string): string {
  if (content.startsWith("---")) {
    const end = content.indexOf("---", 3);
    if (end !== -1) return content.slice(end + 3).trim();
  }
  return content;
}

function extractTitle(notePath: string, content: string): string {
  const match = content.match(/^#\s+(.+)$/m);
  if (match) return match[1];
  return path.basename(notePath, ".md");
}

function parseIssueFrontmatter(relPath: string, content: string): Issue | null {
  if (!content.startsWith("---")) return null;
  const end = content.indexOf("---", 3);
  if (end === -1) return null;

  const fm: Record<string, string> = {};
  for (const line of content.slice(3, end).trim().split("\n")) {
    const colon = line.indexOf(":");
    if (colon !== -1) fm[line.slice(0, colon).trim()] = line.slice(colon + 1).trim();
  }

  const id = parseInt(fm.id, 10);
  if (isNaN(id)) return null;

  // Derive project from path: <PROJECTS_DIR>/<project>/issues/...
  let project = fm.project && fm.project !== "none" ? fm.project : null;
  if (!project) {
    const match = relPath.match(PROJECT_ISSUE_RE);
    if (!match) return null;
    project = match[1];
  }

  const plain = stripFrontmatter(content);
  return {
    id,
    title: extractTitle(relPath, plain),
    type: fm.type as Issue["type"],
    status: fm.status as Issue["status"],
    priority: parseInt(fm.priority, 10) || 3,
    project,
    note_path: relPath,
    created_at: fm.created ?? new Date().toISOString(),
    updated_at: fm.updated ?? new Date().toISOString(),
  };
}

function walkAllMd(dir: string, base: string): string[] {
  const results: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;

    const fullPath = path.join(dir, entry.name);

    if (entry.isFile() && entry.name.endsWith(".md")) {
      results.push(path.relative(base, fullPath));
    } else if (entry.isDirectory()) {
      results.push(...walkAllMd(fullPath, base));
    }
  }

  return results;
}

export async function reindexVault(
  vaultPath: string
): Promise<{
  indexed: number;
  skipped: number;
  removed: number;
  issuesRebuilt: number;
  repaired: number;
  missingVectors: number;
}> {
  const allFiles = walkAllMd(vaultPath, vaultPath);
  const fileSet = new Set(allFiles);

  let indexed = 0;
  let skipped = 0;
  let removed = 0;
  let repaired = 0;       // notes that were current but had lost their vector
  let missingVectors = 0; // notes still without a vector after this pass

  // Remove stale entries for files that no longer exist on disk
  const indexedPaths = allIndexedPaths(vaultPath);
  for (const p of indexedPaths) {
    if (!fileSet.has(p)) {
      deleteFTS(vaultPath, p);
      deleteVector(vaultPath, p);
      removed++;
    }
  }

  // Also clean up any vector-only orphans
  const vectorPaths = allVectorPaths(vaultPath);
  for (const p of vectorPaths) {
    if (!fileSet.has(p)) {
      deleteVector(vaultPath, p);
    }
  }

  // Which notes currently have an embedding. A note indexed while Ollama was
  // down has an FTS row and a recorded mtime but no vector, so mtime alone
  // cannot tell us the index is complete — see the skip check below.
  const vectorSet = new Set(vectorPaths);

  // Rebuild issues table from disk
  const issues: Issue[] = [];
  for (const relPath of allFiles) {
    if (relPath.includes("/issues/active/") || relPath.includes("/issues/done/")) {
      const content = fs.readFileSync(path.join(vaultPath, relPath), "utf-8");
      const issue = parseIssueFrontmatter(relPath, content);
      if (issue) issues.push(issue);
    }
  }
  const issuesRebuilt = rebuildIssues(vaultPath, issues);

  // Index new and changed files
  for (const relPath of allFiles) {
    const fullPath = path.join(vaultPath, relPath);
    const stat = fs.statSync(fullPath);
    const fileMtime = stat.mtimeMs;

    const storedMtime = getMtime(vaultPath, relPath);

    // Unchanged since the last pass AND already embedded. Dropping the vector
    // half of this check is what used to make downtime permanent: the file
    // looked current, so every later reindex skipped it and the missing vector
    // was never backfilled.
    const contentCurrent = storedMtime !== null && fileMtime <= storedMtime;
    if (contentCurrent && vectorSet.has(relPath)) {
      skipped++;
      continue;
    }

    const content = fs.readFileSync(fullPath, "utf-8");
    const plain = stripFrontmatter(content);
    const title = extractTitle(relPath, plain);

    upsertFTS(vaultPath, relPath, title, plain, fileMtime);

    // An empty note has no meaningful vector, and counting it as missing would
    // leave the reindex permanently reporting a failure that cannot be fixed.
    const hasContent = plain.trim().length > 0;
    const embedding = hasContent ? await embed(plain) : null;
    if (embedding) {
      upsertVector(vaultPath, relPath, embedding);
      if (contentCurrent) repaired++;
    } else if (hasContent) {
      // Ollama unavailable. The note stays searchable by FTS, and the next
      // reindex will retry it because vectorSet will still not contain it.
      missingVectors++;
    }

    indexed++;
  }

  return { indexed, skipped, removed, issuesRebuilt, repaired, missingVectors };
}
