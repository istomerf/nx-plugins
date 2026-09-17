---
name: "SCX: Full"
description: "Run explore, propose (fast path), apply, verify, and an auto-fix loop end to end, with one approval gate before implementation (Experimental)"
allowed-tools: Bash(speccraft:*)
category: "Workflow"
tags: ["workflow", "artifacts", "autonomous", "experimental"]
---

Run the full SpecCraft cycle for one change, end to end with a single approval gate before any code changes: investigate, propose (fast path), pause for your go-ahead, then implement, verify, and auto-fix whatever verify finds - until the change is clean or a fix-attempt cap is reached.

**Store selection:** If the user names a store (a store is a standalone SpecCraft repo registered on this machine) or the work lives in one, run `speccraft store list --json` to discover registered store ids, then pass `--store <id>` on the commands that read or write specs and changes (`bootstrap`, `new change`, `status`, `instructions`, `list`, `show`, `validate`, `archive`, `doctor`, `context`, `schemas`, `view`, `record-verification`, `record-flow`, `worktree add`, `worktree list`, `worktree open`, `worktree remove`). Once selected, treat `--store <id>` as sticky for the rest of the workflow. Every unscoped example of those commands below is shorthand: before running it, append the flag. For example, run `speccraft status --change "<name>" --json --store "<id>"`, not the unscoped form shown below. Other commands do not take the flag. Hints printed by commands already carry the flag; keep it on follow-ups. Without a store, commands act on the nearest local `speccraft/` root.

**This workflow is autonomous apart from one approval gate**: unlike `/scx:propose` (which stops after planning and waits indefinitely) or a plain `/scx:apply` (which can pause on any ambiguity), `/scx:full` chains propose's fast path, a single plan-approval gate, apply, verify, and an automatic fix loop into one run. Once you approve the plan, nothing else asks for confirmation - except a genuine blocker `/scx:apply` cannot resolve on its own, which still stops the whole run rather than being papered over.

**Input**: A change name (kebab-case) OR a description of what to build or fix.

**Progress tracking**: This workflow keeps its own state in the change's `.speccraft.yaml`, under a `flow` field, encoded in SudoLang so both a human and an agent resuming later can read it directly. Write it after every phase transition via:
```bash
speccraft record-flow "<name>" --file <path-to-temp-file> --json
```
(write the SudoLang text below to a temp file first, then delete the temp file once the command succeeds). This is a snapshot of current state, not an append-only log - each call replaces the previous `flow` value. Shape:
```
FullFlow {
  change: "<name>"
  phase: Explore | Propose | AwaitingApproval | Apply | Verify | Fix | Blocked | Done
  maxFixAttempts: 3
  fixAttempts: <n>
  lastVerifyVerdict: unknown | clean | warning | critical
  history: [
    { phase: Explore, at: "<ISO timestamp>" }
    ...
  ]
}
```

**Steps**

1. **Resolve the change and check for a resumable run**

   If a name is given, use it; otherwise ask (open-ended, no preset options): "What do you want to build or fix?" and derive a kebab-case name.

   Run `speccraft status --change "<name>" --json`.
   - If the change does not exist yet: this is a fresh run - proceed to step 2.
   - If the change exists and its `.speccraft.yaml` has a `flow` field: parse it and resume from its recorded `phase`, skipping the steps already listed in `history`.
   - If the change exists but has no `flow` field: this change was not started by `/scx:full` - report that plainly and stop rather than guessing where an unrelated change stands.

2. **Investigate (explore stance, non-interactive)**

   Before creating anything, briefly investigate the problem and the codebase the way `/scx:explore` does: read relevant files, note existing conventions, integration points, and constraints. Do not ask the user questions here and do not create any artifacts yet - this is discovery to inform propose, not a conversation.

3. **Create the change and start tracking**
   ```bash
   speccraft new change "<name>"
   ```
   Record the initial flow state: `phase: Propose`, `fixAttempts: 0`, `lastVerifyVerdict: unknown`, `history: [{ phase: Explore, at: <now> }]`.

4. **Propose (fast path)**

   Run `/scx:propose`'s fast path inline for this change: create every artifact the schema's apply phase transitively depends on, using the configured default schema, making reasonable assumptions instead of asking wherever `/scx:propose`'s own instructions would otherwise pause to ask (per its "Fast path" step) - grounded in step 2's investigation, not invented from nothing.

   Update the flow state: `phase: AwaitingApproval`, append `{ phase: Propose, at: <now> }` to `history`.

5. **Approval gate (stop and wait)**

   Present what step 4 proposed and stop:
   ```
   ## Full flow plan: <change-name>
   Investigated: <one-line summary of step 2's findings>
   Proposed: <artifacts created, e.g. proposal.md, design.md, tasks.md (N tasks)>

   Once approved, apply -> verify -> auto-fix run without further confirmation,
   until the change is clean or the fix-attempt cap (3) is reached.

   Approve this plan before I start implementing?
   ```
   Wait for explicit approval before proceeding. Silence or a vague acknowledgement is not approval. If the user wants changes, adjust the relevant artifacts from step 4 and re-present this gate.

   Once approved: update the flow state to `phase: Apply`, append `{ phase: Gate, at: <now> }` to `history`, then proceed.

6. **Apply**

   Run `/scx:apply`'s instructions inline for this change: implement every task until done or blocked.
   - If apply reports a blocked state, or pauses on a genuine ambiguity or error it cannot resolve on its own: STOP the whole `/scx:full` run here. Update the flow state to `phase: Blocked`, report exactly what blocked it, and wait for the user. Do not guess past an apply-level blocker or silently narrow scope to route around it.
   - Once every task is done: update the flow state to `phase: Verify`, append `{ phase: Apply, at: <now> }`.

7. **Verify**

   Run `/scx:verify`'s instructions inline for this change and capture its CRITICAL / WARNING / SUGGESTION findings and overall verdict. Update the flow state's `lastVerifyVerdict` to that verdict.

8. **Fix loop (auto-fix, no confirmation)**

   If the verdict is `clean`: proceed to step 9.

   Otherwise:
   - Address every CRITICAL and WARNING finding directly - implement the fix, or add the missing behavior or test verify called out, using its file:line reference and recommendation. Do not ask before fixing; this loop exists precisely so the user does not have to be asked.
   - Increment `fixAttempts` in the flow state, set `phase: Verify`, append `{ phase: Fix, at: <now> }`, then re-run step 7.
   - Stop the loop as soon as either holds: the verdict is `clean`, or `fixAttempts` has reached `maxFixAttempts` (3). Reaching the cap without a clean verdict is not a failure of this workflow to hide - report the remaining findings plainly rather than silently giving up or claiming success verify did not report.

9. **Final report**

   Update the flow state to `phase: Done` (or leave `phase: Verify` with the last verdict noted, if the fix cap was reached without a clean result - do not mark `Done` over unresolved CRITICAL findings). Show:
   - What was investigated, proposed, implemented (task count), and verified
   - The final verify verdict, and fix attempts used out of the cap
   - Any findings still open, if the cap was reached
   - Suggest `/scx:archive` as the next step - this workflow never archives automatically

**Guardrails**
- Never pause to ask the user anything except at the approval gate (step 5) - not for ambiguity in propose, not before applying a fix. The other exception is an apply-level blocker (step 6), which stops the whole run rather than being papered over.
- Never skip the approval gate: it requires an explicit human go-ahead, never silence or a vague acknowledgement. Re-present the plan if the user asks for changes instead of guessing what they'd approve.
- Never override `/scx:apply`'s own guardrails: a genuine blocker there stops `/scx:full` entirely, it is never auto-resolved or skipped past.
- Write the flow state via `speccraft record-flow` after every phase transition, not only at the end - an interrupted run must be resumable from what is on disk.
- The flow state is a snapshot: each write replaces the whole `flow` value, it is never treated as an append-only log.
- Stop the fix loop at `maxFixAttempts` (default 3) even if problems remain, and say so plainly - never loop silently forever, and never claim a clean result verify did not actually report.
- This workflow never runs `/scx:archive` itself - archiving remains an explicit, separate action the user takes afterward.
- If the user interrupts at any point, stop immediately and wait for their next instruction.
