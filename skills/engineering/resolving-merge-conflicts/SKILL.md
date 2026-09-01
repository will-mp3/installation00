---
name: resolving-merge-conflicts
description: Resolve an in-progress git merge or rebase by tracing each conflict to both sides' intent and verifying the integrated result.
---

# Resolving Merge Conflicts

1. Inspect the repository state, conflict list, and history. Search the vault for the relevant issues, decisions, and specs.
2. Read the primary source for each side of every conflict: the changed implementation, tests, commit context, and applicable requirements. Establish the intent before editing.
3. Resolve one hunk at a time, preserving both compatible intents. When they conflict, choose the behavior consistent with the merge's approved goal and record the trade-off.
4. Inspect the resulting implementation and run the relevant type, test, format, and security checks. Use `systematic-debugging` for unexpected failures.
5. Leave the integration in the best verified state possible. Report exactly what remains for the user, including any required `git add`, `git merge --continue`, or `git rebase --continue` command.

Never finalize a merge/rebase, commit, or push unless the user explicitly asks in this conversation.
