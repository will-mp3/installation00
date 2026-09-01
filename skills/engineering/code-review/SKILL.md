---
name: code-review
description: Use when reviewing a diff, completed task, branch, or pull request against its requirements and project standards.
---

# Code Review

Review a concrete diff on two independent axes: requirements and standards.

## Process

1. Search the vault for the originating issue, spec, decisions, and known risks. Identify the comparison point; if the user has not supplied one, use the merge-base with the target branch or ask when that cannot be determined safely.
2. Inspect the complete diff, relevant implementation, tests, project instructions, and `docs/BEST_PRACTICES.md` when present. Do not review a description in place of the code.
3. Check **requirements**: each approved requirement, behavior, edge case, and declared non-goal is accounted for. Report missing work, incorrect behavior, and scope creep.
4. Check **standards**: reuse of project abstractions, strict types, tests grounded in implementation, comments that explain why, and the project's security, accessibility, and performance conventions. Apply repository rules before generic style preferences.
5. Report only actionable findings, ordered by severity, with file/symbol evidence and a concise explanation. Separate findings from questions and residual risks. Say explicitly when no findings are found in an axis.
6. Run focused checks only when they clarify a finding; `verification-before-completion` owns completion evidence.

## Guardrails

- Keep review single-agent by default; a second perspective is optional only when the user requests it or the work warrants it.
- Never commit, push, or change the reviewed code unless the user asks for remediation.
