#!/usr/bin/env node
// Adds the ark's SessionStart hook to a Claude Code settings.json.
//
// Claude Code has no standalone hooks file, so settings.json — which also holds
// the user's permissions, model, and statusline — is the one file the ark must
// edit rather than own. Kept deliberately small and idempotent: an entry already
// pointing at ark-session-start is left alone, and the prior file is copied to
// *.bak before any write.
//
// The command is written as an absolute path. settings.json is machine-local and
// never committed, so there is nothing to keep portable, and an absolute path
// avoids depending on whether the harness expands `~` in a hook command.

import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const path = process.argv[2] ?? join(homedir(), ".claude", "settings.json");
const command = join(homedir(), ".claude", "ark-session-start");

let settings = {};
if (existsSync(path)) {
  const raw = readFileSync(path, "utf8").trim();
  if (raw) settings = JSON.parse(raw);
  copyFileSync(path, `${path}.bak`);
}

settings.hooks ??= {};
settings.hooks.SessionStart ??= [];

const alreadyWired = settings.hooks.SessionStart.some((group) =>
  (group.hooks ?? []).some((hook) =>
    (hook.command ?? "").includes("ark-session-start"),
  ),
);

if (alreadyWired) {
  console.log(`\x1b[1;32m==>\x1b[0m ${path} already has the ark SessionStart hook`);
  process.exit(0);
}

settings.hooks.SessionStart.push({
  matcher: "startup|clear|compact",
  hooks: [{ type: "command", command, shell: "bash", async: false }],
});

writeFileSync(path, `${JSON.stringify(settings, null, 2)}\n`);
console.log(`\x1b[1;32m==>\x1b[0m added the ark SessionStart hook to ${path}`);
