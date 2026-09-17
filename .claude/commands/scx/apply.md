---
name: "SCX: Apply"
description: "Implement tasks from an SpecCraft change (Experimental)"
allowed-tools: Bash(speccraft:*)
category: "Workflow"
tags: ["workflow", "artifacts", "experimental"]
---

Implement tasks from an SpecCraft change.

**Store selection:** If the user names a store (a store is a standalone SpecCraft repo registered on this machine) or the work lives in one, run `speccraft store list --json` to discover registered store ids, then pass `--store <id>` on the commands that read or write specs and changes (`bootstrap`, `new change`, `status`, `instructions`, `list`, `show`, `validate`, `archive`, `doctor`, `context`, `schemas`, `view`, `record-verification`, `record-flow`, `worktree add`, `worktree list`, `worktree open`, `worktree remove`). Once selected, treat `--store <id>` as sticky for the rest of the workflow. Every unscoped example of those commands below is shorthand: before running it, append the flag. For example, run `speccraft status --change "<name>" --json --store "<id>"`, not the unscoped form shown below. Other commands do not take the flag. Hints printed by commands already carry the flag; keep it on follow-ups. Without a store, commands act on the nearest local `speccraft/` root.

**Input**: Optionally specify a change name (e.g., `/scx:apply add-auth`). If omitted, check if it can be inferred from conversation context. If vague or ambiguous you MUST prompt for available changes.

**Steps**

1. **Select the change**

   If a name is provided, use it. Otherwise:
   - Infer from conversation context if the user mentioned a change
   - Auto-select if only one active change exists
   - If ambiguous, run `speccraft list --json` to get available changes and ask the user to select one

   Always announce: "Using change: <name>" and how to override (e.g., `/scx:apply <other>`).

2. **Check status to understand the schema**
   ```bash
   speccraft status --change "<name>" --json
   ```
   Parse the JSON to understand:
   - `schemaName`: The workflow being used (e.g., "spec-driven")
   - `planningHome`, `changeRoot`, and `actionContext`: planning scope and edit constraints
   - Which artifact contains the tasks (typically "tasks" for spec-driven, check status for others)

3. **Get apply instructions**

   ```bash
   speccraft instructions apply --change "<name>" --json
   ```

   This returns:
   - `contextFiles`: artifact ID -> array of concrete file paths (varies by schema - could be proposal/specs/design/tasks or spec/tests/implementation/docs)
   - Progress (total, complete, remaining)
   - Task list with status
   - Dynamic instruction based on current state
   - Optional `context`: current required project instruction input from the selected root
   - Optional `operationGuidance`: current advisory guidance for apply
   - Optional `worktree`: when `true` (set via `operations.apply.worktree` in speccraft/config.yaml), step 6's parallelization is mandatory and runs inside one shared worktree - see "Parallelization mode" below

   **Handle states:**
   - If `state: "blocked"` (missing artifacts): show message, suggest using `/scx:continue` (if it is not installed, run `speccraft status --change "<name>" --json` to see the next artifact and `speccraft instructions <artifact-id> --change "<name>" --json` for how to create it)
   - If `state: "all_done"`: congratulate, suggest archive
   - Otherwise: proceed to implementation

   Treat `context` as a required prompt-level input. Read and consider it, and
   apply relevant project facts, conventions, and constraints while implementing.
   Treat `operationGuidance` as optional additive advice. Read and consider every
   entry, and follow entries that are applicable and compatible with the built-in
   workflow.

   Keep both fields separate from CLI-returned state, missing artifacts, tasks,
   progress, `contextFiles`, and the built-in `instruction`. They are not
   evidence of task completion, do not replace the built-in instruction, and do
   not permit bypassing a blocked state. If context conflicts with the built-in
   instruction, an explicit user choice, or a CLI-controlled value, report the
   conflict and preserve the controlling value. If guidance is inapplicable or
   conflicts with those controlling inputs, do not follow it and explain why.
   These are prompt-level behavior contracts, not enforceable checks.

4. **Read context files**

   Read every file path listed under `contextFiles` from the apply instructions output.
   The files depend on the schema being used:
   - **spec-driven**: proposal, specs, design, tasks
   - Other schemas: follow the contextFiles from CLI output

   Do not copy `context` or `operationGuidance` verbatim into implementation
   files or planning artifacts unless the user separately asks for that content.

5. **Show current progress**

   Display:
   - Schema being used
   - Progress: "N/M tasks complete"
   - Remaining tasks overview
   - Dynamic instruction from CLI

6. **Implement tasks (loop until done or blocked)**

   For each pending task:
   - Show which task is being worked on
   - Make the code changes required
   - Keep changes minimal and focused
   - Mark task complete in the tasks file: `- [ ]` → `- [x]`
   - Continue to next task

   **Pause if:**
   - Task is unclear → ask for clarification
   - Implementation reveals a design issue → suggest updating artifacts
   - A task needs work beyond what the spec and tasks describe, or you are tempted to drop, narrow, defer, or accept exceptions to specified behavior to make it fit → surface the added scope and ask; do not absorb it silently
   - Error or blocker encountered → report and wait for guidance
   - User interrupts

   **Parallelization mode**

   Check the `worktree` field from the apply instructions JSON (step 3).

   **When `worktree` is not `true` (default) - no worktree, parallelize when safe (optional):**

   No worktree is created in this mode: all work happens directly in your current working directory, on whatever branch you already have checked out - whether you implement tasks yourself or fan out to subagents.

   When 2+ pending task groups touch disjoint files (check tasks.md's `## N.` groups against the files each implies from specs/design), you may fan out instead of looping sequentially:
   - Spawn one subagent per independent group. Each works directly in the current working directory (no per-subagent worktree) - safe because the groups are disjoint-file by construction, so concurrent edits don't collide
   - Subagents report task completion back to you; only you edit tasks.md and check boxes - a subagent editing it too turns the one shared file into a merge conflict
   - Groups that share files, or whose order matters, fall back to the sequential loop above - fan-out is an optimization on top of it, never a requirement

   **When `worktree` is `true` - mandatory single-shared-worktree parallel apply:**

   Use this mode when you want to apply tasks without touching your current branch at all - e.g. it's mid-review, or you don't want in-progress task work mixed into your working directory until it's ready. The whole apply (sequential or fanned out) runs inside one dedicated worktree/branch, leaving your current checkout untouched; you review and merge it in when ready.

   Create exactly one worktree for the whole change - not one per subagent:
```bash
speccraft worktree add "<name>" --json
```
If the result's `added[0].error.code` is `worktree_exists`, don't treat that as a failure - run `speccraft worktree list --json` and reuse the existing entry's `path`/`branch` for this change. Every subagent works inside that single path; none works in the original working directory and none creates a worktree of its own.

Build the fan-out plan: group tasks.md's `## N.` sections by the files each implies (from specs/design/proposal). Two groups are independent when they touch disjoint files and neither's tasks must finish before the other's can start.

Present the plan and stop:
```
## Apply plan: <change-name>
Worktree: <worktree-path> (branch <branch-name>)

Group 1 (tasks 1-3): <files> -> subagent A
Group 2 (tasks 4-5): <files> -> subagent B
Group 3 (task 6): sequential (shares files with / depends on another group)

Independent groups run as parallel subagents inside the shared worktree above. Approve this plan before I spawn anything?
```
Wait for explicit approval before spawning any subagent. If the user wants a different grouping, or wants everything run sequentially, adjust the plan and re-present.

Execute once approved:
- You SHALL fan out to parallel subagents whenever 2+ independent groups exist - this is not optional or a judgment call. Groups that share files, or whose order matters, run sequentially instead (directly in the shared worktree), never forced into parallel subagents.
- Spawn one subagent per independent group. Instruct each one explicitly: work only inside `<worktree-path>`; implement only its group's tasks; touch only the files that group implies; report task-by-task completion back to you; never edit tasks.md itself.
- Only you edit tasks.md and check its boxes. All subagents share one filesystem - the single worktree - with no git-level isolation between them. A subagent editing tasks.md, or touching a file outside its assigned group, creates exactly the collision this plan exists to avoid. Verify a subagent's diff stayed inside its assigned files before checking off its tasks.
- As each subagent finishes its group, mark its tasks `- [x]` in tasks.md and show progress: "Group N complete (X/Y tasks total)".
- If a subagent hits a blocker, pause that group and surface it; keep other independent groups running unless the blocker affects them too.

On completion or pause, show status, including the worktree path so the user can review/test there before merging:
```
## Apply complete: <change-name>
Worktree: <worktree-path>
Progress: N/N tasks complete across M groups

Review the changes in the worktree above. It is not automatically merged - when you're satisfied, merge it into your working branch, then archive with `/scx:archive`.
```

**Guardrails for this mode**
- Never create more than one worktree for this change during this run, and never let a subagent create its own
- Only the orchestrator (you) edits tasks.md; subagents report status back in conversation, they don't touch the tracking file
- If only one task group exists (nothing to parallelize), say so and implement it yourself in the shared worktree instead of forcing a single subagent
- Treat every subagent's report as a claim to verify, not a fact - confirm the files it touched match its assigned group before checking off its tasks

7. **On completion or pause, show status**

   Display:
   - Tasks completed this session
   - Overall progress: "N/M tasks complete"
   - If all done: suggest archive
   - If paused: explain why and wait for guidance

**Output During Implementation**

```
## Implementing: <change-name> (schema: <schema-name>)

Working on task 3/7: <task description>
[...implementation happening...]
✓ Task complete

Working on task 4/7: <task description>
[...implementation happening...]
✓ Task complete
```

**Output On Completion**

```
## Implementation Complete

**Change:** <change-name>
**Schema:** <schema-name>
**Progress:** 7/7 tasks complete ✓

### Completed This Session
- [x] Task 1
- [x] Task 2
...

All tasks complete! You can archive this change with `/scx:archive`.
```

**Output On Pause (Issue Encountered)**

```
## Implementation Paused

**Change:** <change-name>
**Schema:** <schema-name>
**Progress:** 4/7 tasks complete

### Issue Encountered
<description of the issue>

**Options:**
1. <option 1>
2. <option 2>
3. Other approach

What would you like to do?
```

**Guardrails**
- Keep going through tasks until done or blocked
- Always read context files before starting (from the apply instructions output)
- If task is ambiguous, pause and ask before implementing
- If implementation reveals issues, pause and suggest artifact updates
- Keep code changes minimal and scoped to each task
- Update task checkbox immediately after completing each task
- Pause on errors, blockers, or unclear requirements - don't guess
- When a task needs work beyond what the spec describes, surface the added scope and pause - never silently narrow, defer, or simplify away specified behavior
- Only mark a task `- [x]` when its specified behavior is fully implemented, not when it is partially done or deferred
- Use contextFiles from CLI output, don't assume specific file names
- Do not use context or operation guidance as proof that a task is complete
- Apply relevant project context; report conflicts with controlling workflow inputs
- Consider every guidance entry; explain any inapplicable or conflicting advice
- Do not copy runtime context or operation guidance into implementation files or planning artifacts
- Preserve CLI-controlled blocked/ready/all-done behavior and completion criteria

**Fluid Workflow Integration**

This skill supports the "actions on a change" model:

- **Can be invoked anytime**: Before all artifacts are done (if tasks exist), after partial implementation, interleaved with other actions
- **Allows artifact updates**: If implementation reveals design issues, suggest updating artifacts - not phase-locked, work fluidly
