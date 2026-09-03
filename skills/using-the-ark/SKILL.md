---
name: using-the-ark
description: Use when starting any conversation - establishes how to find and use skills, requiring skill invocation before ANY response including clarifying questions
disable-model-invocation: true
---

<SUBAGENT-STOP>
If you were dispatched as a subagent to execute a specific task, ignore this skill.
</SUBAGENT-STOP>

<EXTREMELY-IMPORTANT>
If a skill directly matches the user's request or the user names it, invoke it.

Do not invoke a skill for a self-contained question, status check, or narrow task solely because it might apply.

This is not negotiable. You cannot rationalize your way out of this.
</EXTREMELY-IMPORTANT>

## The Rule

**Invoke directly relevant or requested skills BEFORE any response or action.** Do not load a workflow merely to confirm that it is unnecessary.

**Before entering plan mode:** if you haven't already brainstormed, invoke the brainstorming skill first.

Then announce "Using [skill] to [purpose]" and follow the skill exactly. If it has a checklist, create a todo per item.

## Search The Vault When Relevant

The memory layer outlives this session. Search it when stored decisions, specs, issues, or research could materially improve the work. Use excerpts first; read a full note only when necessary. Capture durable knowledge, not transient progress.

## Skill Priority

When multiple skills apply, process skills come first — they set the approach, then implementation skills carry it out. Brainstorming and systematic-debugging are the most common process skills, but the rule holds for any of them.

- "Let's build X" → brainstorming first, then implementation skills.
- "Fix this bug" → systematic-debugging first, then domain skills.

Skills marked user-invoked wait for the user to ask for them by name.

## Red Flags

These thoughts mean STOP—you're rationalizing:

| Thought | Reality |
|---------|---------|
| "This is just a simple question" | Questions are tasks. Check for skills. |
| "I need more context first" | Skill check comes BEFORE clarifying questions. |
| "Let me explore the codebase first" | Skills tell you HOW to explore. Check first. |
| "I can check git/files quickly" | Files lack conversation context. Check for skills. |
| "Let me gather information first" | Skills tell you HOW to gather information. |
| "This doesn't need a formal skill" | If a skill exists, use it. |
| "I remember this skill" | Skills evolve. Read current version. |
| "This doesn't count as a task" | Action = task. Check for skills. |
| "The skill is overkill" | Simple things become complex. Use it. |
| "I'll just do this one thing first" | Check BEFORE doing anything. |
| "This feels productive" | Undisciplined action wastes time. Skills prevent this. |
| "I know what that means" | Knowing the concept ≠ using the skill. Invoke it. |

## User Instructions

User instructions (CLAUDE.md, AGENTS.md, direct requests) take precedence over skills, which in turn override default behavior. Only skip skill workflows or instructions when your human partner has explicitly told you to.
