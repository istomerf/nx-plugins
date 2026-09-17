---
name: speccraft-orchestrate
description: Run the Apply stage of an already-proposed change as a supervised pipeline, with mandatory parallel subagents in one shared worktree and a human approval gate before execution. Use when the user wants apply parallelized by default instead of left to judgment.
allowed-tools: Bash(speccraft:*)
license: MIT
compatibility: Requires speccraft CLI.
metadata:
  author: speccraft
  version: "1.0"
  generatedBy: "1.0.1"
---

Guide the Apply stage of an already-proposed SpecCraft change as a supervised pipeline: a mandatory parallel-subagent apply inside one shared git worktree, with a human approval gate before execution.

**Store selection:** If the user names a store (a store is a standalone SpecCraft repo registered on this machine) or the work lives in one, run `speccraft store list --json` to discover registered store ids, then pass `--store <id>` on the commands that read or write specs and changes (`bootstrap`, `new change`, `status`, `instructions`, `list`, `show`, `validate`, `archive`, `doctor`, `context`, `schemas`, `view`, `record-verification`, `record-flow`, `worktree add`, `worktree list`, `worktree open`, `worktree remove`). Once selected, treat `--store <id>` as sticky for the rest of the workflow. Every unscoped example of those commands below is shorthand: before running it, append the flag. For example, run `speccraft status --change "<name>" --json --store "<id>"`, not the unscoped form shown below. Other commands do not take the flag. Hints printed by commands already carry the flag; keep it on follow-ups. Without a store, commands act on the nearest local `speccraft/` root.

**When to use this instead of `/speccraft-apply-change`**: `/speccraft-apply-change` only parallelizes when `operations.apply.worktree: true` is set in speccraft/config.yaml, and even then leaves grouping and pacing to judgment. Use `/speccraft-orchestrate` when you want the shared-worktree, mandatory-parallel-subagent apply every time, with an explicit stop-and-approve checkpoint before anything runs, regardless of that config setting.

**Input**: A change name (e.g. `/speccraft-orchestrate add-auth`). If omitted, infer it from conversation context, auto-select if only one active change exists, or run `speccraft list --json` and ask the user to pick one. The change must already have its planning artifacts in place - if it doesn't, tell the user to run `/speccraft-explore` and `/speccraft-propose` first; do not create planning artifacts yourself here.

### Apply - one shared worktree, mandatory parallel subagents (gate before execution)

Run `speccraft status --change "<name>" --json` and `speccraft instructions apply --change "<name>" --json` for the task list.

- If `state: "blocked"` (missing artifacts): stop and tell the user to run `/speccraft-propose` first
- If `state: "all_done"`: congratulate and suggest archive
- Otherwise, proceed:

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

Review the changes in the worktree above. It is not automatically merged - when you're satisfied, merge it into your working branch, then archive with `/speccraft-archive-change`.
```

**Guardrails for this mode**
- Never create more than one worktree for this change during this run, and never let a subagent create its own
- Only the orchestrator (you) edits tasks.md; subagents report status back in conversation, they don't touch the tracking file
- If only one task group exists (nothing to parallelize), say so and implement it yourself in the shared worktree instead of forcing a single subagent
- Treat every subagent's report as a claim to verify, not a fact - confirm the files it touched match its assigned group before checking off its tasks

**Guardrails**
- Never skip the gate before execution: it requires an explicit human go-ahead, never silence or a vague acknowledgement
- If the user interrupts at any point, stop immediately and wait for their next instruction
- This workflow's gate is a prompt-level behavior contract, not enforced by the CLI - honor it even though nothing blocks you from skipping ahead
