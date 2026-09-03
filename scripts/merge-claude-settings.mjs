#!/usr/bin/env node
// Merges the ark's pieces into a Claude Code settings.json: the SessionStart
// hook and the status line.
//
// Claude Code has no standalone hooks or statusline file, so settings.json —
// which also holds the user's permissions and model — is the one file the ark
// must edit rather than own. Kept deliberately small and idempotent: entries
// already pointing at the ark are left alone, and the prior file is copied to
// *.bak before any write.
//
// Commands are written as absolute paths. settings.json is machine-local and
// never committed, so there is nothing to keep portable, and an absolute path
// avoids depending on whether the harness expands `~`.
//
// Each piece is selectable so the linker scripts stay independently runnable:
//   merge-claude-settings.mjs [--hook] [--statusline] [settings.json path]
// With neither flag, both are merged.

import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

const argv = process.argv.slice(2);
const flags = new Set(argv.filter((a) => a.startsWith("--")));
const positional = argv.filter((a) => !a.startsWith("--"));

const unknown = [...flags].filter((f) => f !== "--hook" && f !== "--statusline");
if (unknown.length) {
  console.error(`unknown option: ${unknown[0]}`);
  process.exit(1);
}

// No flag means "do everything" — the behaviour this script had before it split.
const doHook = flags.size === 0 || flags.has("--hook");
const doStatusLine = flags.size === 0 || flags.has("--statusline");

const path = positional[0] ?? join(homedir(), ".claude", "settings.json");
const hookCommand = join(homedir(), ".claude", "ark-session-start");
const statusCommand = `bash ${join(homedir(), ".claude", "ark-statusline")}`;

// The status line lived here before it moved into the repo. Treat it as ours to
// replace; any other pre-existing command belongs to the user and is left alone.
const LEGACY_STATUSLINE = join(homedir(), ".claude", "statusline-command.sh");

const green = (s) => console.log(`\x1b[1;32m==>\x1b[0m ${s}`);
const yellow = (s) => console.log(`\x1b[1;33mwarn:\x1b[0m ${s}`);

let settings = {};
if (existsSync(path)) {
  const raw = readFileSync(path, "utf8").trim();
  if (raw) settings = JSON.parse(raw);
  copyFileSync(path, `${path}.bak`);
}

function mergeHook() {
  settings.hooks ??= {};
  settings.hooks.SessionStart ??= [];

  const wired = settings.hooks.SessionStart.some((group) =>
    (group.hooks ?? []).some((hook) =>
      (hook.command ?? "").includes("ark-session-start"),
    ),
  );

  if (wired) {
    green(`${path} already has the ark SessionStart hook`);
    return;
  }

  settings.hooks.SessionStart.push({
    matcher: "startup|clear|compact",
    hooks: [{ type: "command", command: hookCommand, shell: "bash", async: false }],
  });
  green(`added the ark SessionStart hook to ${path}`);
}

function mergeStatusLine() {
  const existing = settings.statusLine?.command ?? "";

  if (existing.includes("ark-statusline")) {
    green(`${path} already has the ark status line`);
    return;
  }

  if (existing && !existing.includes(LEGACY_STATUSLINE)) {
    yellow(`${path} has a custom statusLine command — leaving it alone.`);
    yellow(`  To use the ark's instead, set statusLine.command to: ${statusCommand}`);
    return;
  }

  settings.statusLine = { type: "command", command: statusCommand };
  green(`set the ark status line in ${path}`);
}

if (doHook) mergeHook();
if (doStatusLine) mergeStatusLine();

// The linker scripts mkdir -p ~/.claude first, but this script is also runnable
// on its own — and on a fresh machine the directory may not exist yet.
mkdirSync(dirname(path), { recursive: true });
writeFileSync(path, `${JSON.stringify(settings, null, 2)}\n`);
