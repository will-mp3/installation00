---
name: systematic-debugging
description: Use when encountering a bug, test failure, regression, or unexpected behavior, before proposing fixes.
---

# Systematic Debugging

## Iron law

Find and verify root cause before changing production behavior. A symptom patch is not a diagnosis.

## Process

1. Search the vault and inspect the affected implementation, logs, tests, recent changes, and `docs/BEST_PRACTICES.md` when present. Redact secrets from all artifacts.
2. Reproduce the exact reported behavior with the smallest reliable command, test, script, or trace. Record the observed symptom and minimize the reproduction.
3. Find a nearby working pattern and list ranked, falsifiable hypotheses. Test one prediction at a time with the narrowest useful inspection or instrumentation.
4. Identify the root cause and explain the evidence linking it to the symptom. If no reliable reproduction is possible, report what was tried and request the missing artifact or access rather than guessing.
5. Add a regression test at the real behavioral seam before applying the fix when a sound seam exists. Implement the smallest root-cause correction and re-run both the regression and original reproduction.
6. Remove temporary instrumentation and capture durable discoveries in the vault. Use `verification-before-completion` before claiming the issue is fixed.

## Guardrails

- Inspect implementation before changing tests or code.
- Do not make a sequence of speculative fixes, hide errors, or treat a green unrelated test as evidence.
- Never commit or push unless the user explicitly asks in this conversation.
