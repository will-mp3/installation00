// Folder (relative to vault root) where projects live. The server imposes no
// other structure on the vault — conventions belong in the vault's own CLAUDE.md.
export const PROJECTS_DIR = (process.env.PROJECTS_DIR ?? "02-projects").replace(/\/+$/, "");

export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
