---
name: executing-plans
description: Use when executing an approved written implementation plan.
---

# Executing Plans

Execute an approved plan deliberately, keeping its evidence and durable state current.

## Process

1. Load the plan, relevant vault notes/issues, project instructions, and `docs/BEST_PRACTICES.md` when present. Inspect the current implementation before changing code or tests.
2. Critically review the plan against the current worktree. Raise material ambiguity, drift, or safety concerns before proceeding; update the vault plan or issue when the decision changes.
3. Work one task at a time. Reuse project abstractions; retain strict types; follow the project's security, accessibility, and performance conventions; write comments for why, not narration.
4. For each behavior change, use `test-driven-development`. For failures or unexpected behavior, use `systematic-debugging` before proposing a fix.
5. Run the task's stated checks, record meaningful discoveries in the vault, and keep persistent issues accurate. Do not mark an issue done until its completion criterion is met.
6. Review the completed diff with `code-review`, then use `verification-before-completion` before reporting success.

## Guardrails

- Work in the current workspace unless the user explicitly requests a different arrangement.
- Do not delegate by default; use a single focused execution path.
- Never commit or push unless the user explicitly asks in this conversation.
