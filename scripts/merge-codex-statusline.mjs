#!/usr/bin/env node
// Configures Codex's status line in ~/.codex/config.toml.
//
// Codex's status line is not a command like Claude Code's — it is a picker over
// a fixed vocabulary of items, chosen interactively with /statusline and stored
// as [tui].status_line. So the ark cannot run statusline/statusline.sh there;
// it selects the items that render the same four fields instead.
//
// config.toml is densely user-owned (auth, sandbox, project trust, MCP servers),
// so this edits line-by-line rather than round-tripping through a TOML parser
// that would reformat and drop comments. It only ever inserts one line, never
// rewrites or reorders anything, and never touches a status_line the user has
// already set.
//
// Usage: merge-codex-statusline.mjs [config.toml path]

import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

// Parity with statusline/statusline.sh: branch, model, context, 5-hour rate.
// The full vocabulary is much larger (weekly-limit, used-tokens, task-progress,
// thread-credits, …) — run /statusline in Codex to browse and change it.
const ITEMS = ["git-branch", "model", "context-used", "five-hour-limit"];

const path = process.argv[2] ?? join(homedir(), ".codex", "config.toml");
const line = `status_line = [${ITEMS.map((i) => `"${i}"`).join(", ")}]`;

const green = (s) => console.log(`\x1b[1;32m==>\x1b[0m ${s}`);

const raw = existsSync(path) ? readFileSync(path, "utf8") : "";
if (existsSync(path)) copyFileSync(path, `${path}.bak`);

// A dotted key written outside any table is valid TOML and means the same thing.
if (/^\s*tui\.status_line\s*=/m.test(raw)) {
  green(`${path} already sets tui.status_line`);
  process.exit(0);
}

const lines = raw.split("\n");
const tuiHeader = lines.findIndex((l) => /^\s*\[tui\]\s*$/.test(l));

if (tuiHeader === -1) {
  const prefix = raw.length && !raw.endsWith("\n") ? "\n" : "";
  writeFileSync(path, `${raw}${prefix}\n[tui]\n${line}\n`);
  green(`added [tui].status_line to ${path}`);
  process.exit(0);
}

// The section body runs to the next table header of any kind.
let end = lines.length;
for (let i = tuiHeader + 1; i < lines.length; i++) {
  if (/^\s*\[/.test(lines[i])) {
    end = i;
    break;
  }
}

if (lines.slice(tuiHeader + 1, end).some((l) => /^\s*status_line\s*=/.test(l))) {
  green(`${path} already sets [tui].status_line`);
  process.exit(0);
}

lines.splice(tuiHeader + 1, 0, line);
mkdirSync(dirname(path), { recursive: true });
writeFileSync(path, lines.join("\n"));
green(`added [tui].status_line to ${path}`);
