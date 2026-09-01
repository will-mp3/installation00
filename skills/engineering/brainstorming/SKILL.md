---
name: brainstorming
description: Use before designing a feature, component, workflow, or behavior change. Clarifies intent, constraints, alternatives, and approval before implementation.
---

# Brainstorming

Turn an idea into an approved, implementable design through a proportionate conversation.

## Process

1. Search the Obsidian vault for prior decisions, relevant specs, and open issues. Inspect the affected implementation and project documentation before asking questions that the repository can answer. Read `docs/BEST_PRACTICES.md` when it exists.
2. State the understood goal, constraints, and the smallest appropriate design path. For a small, well-bounded change, confirm the intended behavior concisely; for a novel or cross-cutting change, explore alternatives one question at a time.
3. Present the proposed design: behavior, important flows and failure cases, affected boundaries, testing approach, and explicit non-goals. Use a small diagram only when it makes a relationship clearer.
4. Obtain the user's approval before implementation. Record durable decisions in a vault note using the vault template; create or update a vault issue for work that must persist across sessions.
5. Hand approved multi-step work to `writing-plans`; hand a narrow approved change to `test-driven-development` or `executing-plans` as appropriate.

## Guardrails

- Do not write implementation code or alter behavior before the design is approved. Exploration and read-only investigation are allowed.
- Prefer existing project abstractions and terminology over invented ones.
- Never commit or push unless the user explicitly asks in this conversation.
