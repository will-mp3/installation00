---
name: writing-plans
description: Use after requirements are understood for a multi-step implementation task, before editing code.
---

# Writing Plans

Write an execution-ready plan for an engineer who has not seen this conversation.

## Process

1. Search the vault for related decisions, specs, and active issues. Inspect the code, tests, conventions, and `docs/BEST_PRACTICES.md` when present. Resolve uncertainty before planning.
2. Check scope. Split genuinely independent subsystems into independently testable plans; keep one coherent change together.
3. Save the plan in the vault as a project note, using the appropriate template. For persistent work, create or update a parent vault issue and create only the child issues that add useful cross-session tracking.
4. Write small, ordered tasks. Every task names the relevant files or symbols, the behavior to change, existing abstractions to reuse, precise verification, and completion criteria. Include source-informed tests: inspect implementation before describing assertions.
5. State strict typing, security, accessibility, performance, and comment-why requirements where they apply. Do not copy technology-specific rules from another project.
6. Review the plan for missing paths, speculative work, and unverified assumptions. Present it for approval before execution.

## Plan shape

Each task should be a vertical, independently verifiable increment when practical. Include dependencies, risks, and non-goals. The final task runs the relevant checks and invokes `verification-before-completion`.

## Guardrails

- Plans describe a route to a clean working tree; commits and pushes require the user's explicit request in this conversation.
- Do not require worktrees, branch-finishing, or subagent/parallel execution.
