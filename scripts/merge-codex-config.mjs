#!/usr/bin/env node
// Writes the ark's two Codex settings into ~/.codex/config.toml:
//
//   --statusline    [tui].status_line — Codex's status line is not a command
//                   like Claude Code's but a picker over a fixed item
//                   vocabulary (`/statusline` in the TUI), so it gets the item
//                   set that renders the same fields as statusline/statusline.sh.
//   --mcp-approval  [mcp_servers.<server>].default_tools_approval_mode = "approve"
//                   — otherwise every vault tool call opens an "Allow the
//                   memory-layer MCP server to run tool X?" prompt. Set on the
//                   server, not per tool, so tools added later are covered too.
//
//                   The four values are auto | prompt | writes | approve, and
//                   "approve" reads backwards: it means *pre-approved*, not
//                   "ask for approval" — it is what Codex writes when you pick
//                   "Allow and don't ask me again" in the dialog. "auto" is the
//                   one that still prompts here: it derives the decision from
//                   the tool's MCP annotations (read_only_hint /
//                   destructive_hint / open_world_hint), and this server
//                   declares none, so nothing can be inferred and everything
//                   asks. Verified with `codex exec`: "auto" fails the call
//                   with "MCP tool call requires approval", "approve" runs it.
//
// With neither flag, both are written.
//
// config.toml is densely user-owned (auth, sandbox, project trust, MCP servers),
// so this edits line-by-line rather than round-tripping through a TOML parser
// that would reformat and drop comments. It only ever inserts one line per
// setting, never rewrites or reorders anything.
//
// Usage: merge-codex-config.mjs [--statusline] [--mcp-approval] [config.toml path]

import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

const SERVER = "memory-layer";

// Parity with statusline/statusline.sh: branch, model, context, 5-hour, weekly.
// The vocabulary is much larger (context-remaining, used-tokens, task-progress,
// thread-credits, estimated-thread-cost, …) — run /statusline to browse it.
const STATUS_ITEMS = ["git-branch", "model", "context-used", "five-hour-limit", "weekly-limit"];

// Item sets the ark has shipped before. A status_line matching one of these was
// written by a previous setup run, so it is ours to upgrade; anything else is
// the user's own choice and is left alone.
const PRIOR_ARK_ITEMS = [["git-branch", "model", "context-used", "five-hour-limit"]];

const argv = process.argv.slice(2);
const flags = new Set(argv.filter((a) => a.startsWith("--")));
const positional = argv.filter((a) => !a.startsWith("--"));

const unknown = [...flags].filter((f) => f !== "--statusline" && f !== "--mcp-approval");
if (unknown.length) {
  console.error(`unknown option: ${unknown[0]}`);
  process.exit(1);
}

const doStatusLine = flags.size === 0 || flags.has("--statusline");
const doMcpApproval = flags.size === 0 || flags.has("--mcp-approval");

const path = positional[0] ?? join(homedir(), ".codex", "config.toml");

const green = (s) => console.log(`\x1b[1;32m==>\x1b[0m ${s}`);

let lines = (existsSync(path) ? readFileSync(path, "utf8") : "").split("\n");
if (existsSync(path)) copyFileSync(path, `${path}.bak`);
let changed = false;

const tomlList = (items) => `[${items.map((i) => `"${i}"`).join(", ")}]`;

// The body of a [table] runs from its header to the next table header of any kind.
function tableBody(table) {
  const header = lines.findIndex((l) => l.trim() === `[${table}]`);
  if (header === -1) return null;
  let end = lines.length;
  for (let i = header + 1; i < lines.length; i++) {
    if (/^\s*\[/.test(lines[i])) {
      end = i;
      break;
    }
  }
  return { header, end };
}

// Table names carry dots and hyphens ("mcp_servers.memory-layer"), so they must
// be escaped before going into a pattern.
const rx = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Returns the index of `key`'s line inside the table, or -1.
function findKey(body, key) {
  const re = new RegExp(`^\\s*${rx(key)}\\s*=`);
  for (let i = body.header + 1; i < body.end; i++) if (re.test(lines[i])) return i;
  return -1;
}

// A dotted key outside any table is valid TOML and means the same thing.
const dottedKeySet = (table, key) =>
  lines.some((l) => new RegExp(`^\\s*${rx(table)}\\.${rx(key)}\\s*=`).test(l));

// isOurs(existingValue) decides whether a value already present may be replaced.
function setKey(table, key, value, isOurs = () => false) {
  if (dottedKeySet(table, key)) {
    green(`${path} already sets ${table}.${key}`);
    return;
  }

  const body = tableBody(table);
  if (body === null) {
    // No such table: append it. Trailing blank line keeps sections separated.
    while (lines.length && lines[lines.length - 1] === "") lines.pop();
    lines.push("", `[${table}]`, `${key} = ${value}`, "");
    changed = true;
    green(`added [${table}].${key} to ${path}`);
    return;
  }

  const at = findKey(body, key);
  if (at === -1) {
    lines.splice(body.header + 1, 0, `${key} = ${value}`);
    changed = true;
    green(`added [${table}].${key} to ${path}`);
    return;
  }

  const existing = lines[at].split("=").slice(1).join("=").trim();
  if (existing === value) {
    green(`${path} already sets [${table}].${key}`);
  } else if (isOurs(existing)) {
    lines[at] = `${key} = ${value}`;
    changed = true;
    green(`updated [${table}].${key} in ${path}`);
  } else {
    green(`${path} has a custom [${table}].${key} — leaving it alone`);
  }
}

if (doStatusLine) {
  const priorArk = PRIOR_ARK_ITEMS.map(tomlList);
  // Compare with whitespace normalised: `["a","b"]` and `["a", "b"]` are the same list.
  const squash = (s) => s.replace(/\s+/g, "");
  setKey("tui", "status_line", tomlList(STATUS_ITEMS), (existing) =>
    priorArk.some((p) => squash(p) === squash(existing)),
  );
}

if (doMcpApproval) {
  setKey(`mcp_servers.${SERVER}`, "default_tools_approval_mode", '"approve"');
}

if (changed) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, lines.join("\n"));
}
