---
name: test-driven-development
description: Use when implementing a feature, bug fix, refactor, or behavior change, before writing implementation code.
---

# Test-Driven Development

## Iron law

Write one failing behavioral test, watch it fail for the intended reason, then write the smallest production change that makes it pass. If the test was not observed failing, it has not proved that it can detect the change.

## Process

1. Inspect the implementation, neighboring tests, and `docs/BEST_PRACTICES.md` when present. Identify the public seam and an independent source of expected behavior: an approved design, source contract, documented example, or known-good fixture.
2. **Red:** add one focused test at that seam. Run it and confirm it fails because the behavior is absent or wrong, not because setup is broken.
3. **Green:** implement only enough to pass. Re-run the focused test.
4. **Refactor:** improve names, duplication, and structure while keeping the suite green. Preserve strict typing and reuse existing abstractions.
5. Repeat in vertical slices. Run relevant broader checks before moving on.

## Test quality

Test observable behavior rather than private implementation details. Do not reimplement production logic in expectations, rely on snapshots without meaningful assertions, or repair a failing test before reading the implementation. Use source-informed, specific assertions and project conventions for mocks and fixtures. See [tests.md](tests.md) and [mocking.md](mocking.md) for local reference.

## Exceptions

For generated files, configuration-only changes, or a genuinely untestable boundary, explain the exception and choose the strongest available verification before implementation. Never use an exception to skip investigation of a feasible test.
