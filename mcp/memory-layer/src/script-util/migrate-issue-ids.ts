import fs from "fs";
import path from "path";
import { PROJECTS_DIR } from "../config.js";

const VAULT_PATH = process.env.VAULT_PATH;
if (!VAULT_PATH) {
  console.error("Set VAULT_PATH env var");
  process.exit(1);
}

interface ParsedIssue {
  filePath: string;
  oldId: number;
  created: string;
  content: string;
}

function walkIssueFiles(dir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isFile() && entry.name.endsWith(".md")) results.push(full);
    else if (entry.isDirectory()) results.push(...walkIssueFiles(full));
  }
  return results;
}

// Find all projects with issues
const projectsDir = path.join(VAULT_PATH, PROJECTS_DIR);
const projects = fs.readdirSync(projectsDir, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name);

let totalRewritten = 0;

for (const project of projects) {
  const issuesDir = path.join(projectsDir, project, "issues");
  if (!fs.existsSync(issuesDir)) continue;

  const files = walkIssueFiles(issuesDir);
  if (files.length === 0) continue;

  // Parse each file
  const parsed: ParsedIssue[] = [];
  for (const filePath of files) {
    const content = fs.readFileSync(filePath, "utf-8");
    const match = content.match(/^---\n([\s\S]*?)\n---/);
    if (!match) continue;

    const idMatch = match[1].match(/^id:\s*(\d+)/m);
    const createdMatch = match[1].match(/^created:\s*(.+)/m);
    if (!idMatch) continue;

    parsed.push({
      filePath,
      oldId: parseInt(idMatch[1], 10),
      created: createdMatch?.[1]?.trim() ?? "2000-01-01",
      content,
    });
  }

  // Sort by created date, then by old ID as tiebreaker
  parsed.sort((a, b) => a.created.localeCompare(b.created) || a.oldId - b.oldId);

  // Assign new sequential IDs
  console.log(`\n${project}: ${parsed.length} issues`);
  for (let i = 0; i < parsed.length; i++) {
    const newId = i + 1;
    const issue = parsed[i];

    // Replace id in frontmatter
    const rewritten = issue.content.replace(
      /^(---\n[\s\S]*?)id:\s*\d+/m,
      `$1id: ${newId}`
    );

    // Ensure project field is set correctly
    const withProject = rewritten.replace(
      /^(project:\s*).+$/m,
      `$1${project}`
    );

    fs.writeFileSync(issue.filePath, withProject, "utf-8");
    console.log(`  #${issue.oldId} -> #${newId}  ${path.basename(issue.filePath)}`);
    totalRewritten++;
  }
}

console.log(`\nMigration complete: ${totalRewritten} files rewritten`);
