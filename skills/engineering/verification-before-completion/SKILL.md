---
name: verification-before-completion
description: Use before claiming work is complete, fixed, or passing. Requires fresh verification evidence for the specific claim.
---

# Verification Before Completion

## Iron law

Do not claim completion, correctness, or passing status without fresh evidence that directly proves that claim.

## Gate

1. State the exact claim: tests pass, a bug is fixed, requirements are met, or a build succeeds.
2. Identify the strongest relevant verification command or manual check. Use the original reproduction for a bug fix and the approved plan/spec for requirements.
3. Run the complete check now. Read its exit status and meaningful output; do not substitute an earlier, partial, or adjacent check.
4. Compare the evidence to the claim. If it does not prove the claim, report the actual status and remaining gap.
5. Only then make a qualified completion statement, including the command or manual evidence used.

## Evidence map

- Tests pass: the relevant test command reports no failures.
- Build/typecheck passes: the actual build/typecheck exits successfully.
- Bug fixed: the original symptom no longer reproduces and its regression check passes.
- Requirements met: every requirement and non-goal has been checked against the diff and behavior.
- Agent or tool output: inspect the resulting diff and run independent verification; a report is not evidence.

Completion does not authorize a commit or push. Those actions require the user's explicit request in this conversation.
