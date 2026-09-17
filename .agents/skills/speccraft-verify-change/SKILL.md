---
name: speccraft-verify-change
description: Verify implementation matches change artifacts. Use when the user wants to validate that implementation is complete, correct, and coherent before archiving.
allowed-tools: Bash(speccraft:*)
license: MIT
compatibility: Requires speccraft CLI.
metadata:
  author: speccraft
  version: "1.0"
  generatedBy: "1.0.1"
---

Verify that an implementation matches the change artifacts (specs, tasks, design).

**Store selection:** If the user names a store (a store is a standalone SpecCraft repo registered on this machine) or the work lives in one, run `speccraft store list --json` to discover registered store ids, then pass `--store <id>` on the commands that read or write specs and changes (`bootstrap`, `new change`, `status`, `instructions`, `list`, `show`, `validate`, `archive`, `doctor`, `context`, `schemas`, `view`, `record-verification`, `record-flow`, `worktree add`, `worktree list`, `worktree open`, `worktree remove`). Once selected, treat `--store <id>` as sticky for the rest of the workflow. Every unscoped example of those commands below is shorthand: before running it, append the flag. For example, run `speccraft status --change "<name>" --json --store "<id>"`, not the unscoped form shown below. Other commands do not take the flag. Hints printed by commands already carry the flag; keep it on follow-ups. Without a store, commands act on the nearest local `speccraft/` root.

**Input**: Optionally specify a change name. If omitted, check if it can be inferred from conversation context. If vague or ambiguous you MUST prompt for available changes.

**Steps**

1. **Select the change**

   If a name is provided, use it. Otherwise:
   - Infer from conversation context if the user mentioned a change
   - Auto-select if only one active change exists
   - If ambiguous, run `speccraft list --json` to get available changes and ask the user to select one

   When prompting, show changes that have a tracked task checklist (a non-zero task count for the change).
   Include the schema used for each change if available.
   Mark changes with incomplete tasks as "(In Progress)".

   Always announce: "Using change: <name>" and how to override (e.g., `/speccraft-verify-change <other>`).

2. **Check status to understand the schema**
   ```bash
   speccraft status --change "<name>" --json
   ```
   Parse the JSON to understand:
   - `schemaName`: The workflow being used (e.g., "spec-driven")
   - `planningHome`, `changeRoot`, `artifactPaths`, and `actionContext`: path and scope context
   - Which artifacts exist for this change

3. **Get planning context and load artifacts**

   ```bash
   speccraft instructions apply --change "<name>" --json
   ```

   This returns the change directory and `contextFiles` (artifact ID -> array of concrete file paths). Read all available artifacts from `contextFiles`.

   It also returns `progress` (`{total, complete, remaining}`) and `tasks` (parsed checklist items, each with a `description` and `done` flag), computed from whichever artifact the schema's `apply.tracks` points at. Use these directly for task completion instead of assuming the checklist lives under a `contextFiles.tasks` key - a schema can track tasks embedded in any artifact's file (for example, a combined plan.md that also carries goals and invariants), and no `tasks`-named artifact needs to exist.

4. **Initialize verification report structure**

   Create a report structure with three dimensions:
   - **Completeness**: Track tasks and spec coverage
   - **Correctness**: Track requirement implementation and scenario coverage
   - **Coherence**: Track design adherence and pattern consistency

   Each dimension can have CRITICAL, WARNING, or SUGGESTION issues.

5. **Verify Completeness**

   **Task Completion**:
   - Use `progress` and `tasks` from the step 3 JSON - don't re-derive this
     by parsing a `contextFiles.tasks` file, since the tracked checklist may
     live under a different artifact id entirely
   - If `progress.total` is 0, this schema has no tracked task checklist -
     skip this check and note it was skipped
   - For each task in `tasks` where `done` is false:
     - Add CRITICAL issue: "Incomplete task: <description>"
     - Recommendation: "Complete task: <description>" or "Mark as done if already implemented"

   **Spec Coverage**:
   - If delta specs exist in `contextFiles.specs`:
     - Extract all requirements (marked with "### Requirement:")
     - For each requirement:
       - Search codebase for keywords related to the requirement
       - Assess if implementation likely exists
     - If requirements appear unimplemented:
       - Add CRITICAL issue: "Requirement not found: <requirement name>"
       - Recommendation: "Implement requirement X: <description>"

6. **Verify Correctness**

   **Requirement Implementation Mapping**:
   - For each requirement from delta specs:
     - Search codebase for implementation evidence
     - If found, note file paths and line ranges
     - Assess if implementation matches requirement intent
     - If divergence detected:
       - Add WARNING: "Implementation may diverge from spec: <details>"
       - Recommendation: "Review <file>:<lines> against requirement X"

   **Scenario Coverage**:
   - For each scenario in delta specs (marked with "#### Scenario:"):
     - Check if conditions are handled in code
     - Check if tests exist covering the scenario
     - If scenario appears uncovered:
       - Add WARNING: "Scenario not covered: <scenario name>"
       - Recommendation: "Add test or implementation for scenario: <description>"

7. **Verify Coherence**

   **Design Adherence**:
   - Check every `contextFiles` entry other than `specs` for decision-like
     content (sections such as "Decision:", "Approach:", "Architecture:",
     "CONSTRAINTS", "INVARIANTS") - this covers a dedicated `design.md` as
     well as a schema that folds design into another artifact (e.g. a
     combined plan.md)
   - Verify implementation follows those decisions
   - If contradiction detected:
     - Add WARNING: "Design decision not followed: <decision>"
     - Recommendation: "Update implementation or revise <file> to match reality"
   - If no such artifact exists: Skip design adherence check, note "No design-bearing artifact to verify against"

   **Code Pattern Consistency**:
   - Review new code for consistency with project patterns
   - Check file naming, directory structure, coding style
   - If significant deviations found:
     - Add SUGGESTION: "Code pattern deviation: <details>"
     - Recommendation: "Consider following project pattern: <example>"

8. **Generate Verification Report**

   **Summary Scorecard**:
   ```markdown
   ## Verification Report: <change-name>

   ### Summary
   | Dimension    | Status           |
   |--------------|------------------|
   | Completeness | X/Y tasks, N reqs|
   | Correctness  | M/N reqs covered |
   | Coherence    | Followed/Issues  |
   ```

   **Issues by Priority**:

   1. **CRITICAL** (Must fix before archive):
      - Incomplete tasks
      - Missing requirement implementations
      - Each with specific, actionable recommendation

   2. **WARNING** (Should fix):
      - Spec/design divergences
      - Missing scenario coverage
      - Each with specific recommendation

   3. **SUGGESTION** (Nice to fix):
      - Pattern inconsistencies
      - Minor improvements
      - Each with specific recommendation

   **Final Assessment**:
   - If CRITICAL issues: "X critical issue(s) found. Fix before archiving."
   - If only warnings: "No critical issues. Y warning(s) to consider. Ready for archive (with noted improvements)."
   - If all clear: "All checks passed. Ready for archive."

9. **Persist verification evidence**

   Write a JSON file recording what this run found, then record it against the change. This is additive: the chat-facing report from step 8 is unchanged; this just gives `speccraft validate --drift` and archive something to check code drift against later.

   Build the payload:
   - `verdict`: `"critical"` if any CRITICAL issue was found, else `"warning"` if any WARNING was found, else `"clean"`
   - `counts`: `{ critical, warning, suggestion }` - the counts from step 8's scorecard
   - `evidence`: one entry per CRITICAL/WARNING issue (SUGGESTIONs are opinions, not evidence - omit them). Each entry needs a `file` (the artifact or source file the issue is about - `tasks.md` for an incomplete task, the delta `spec.md` for a missing requirement/scenario, the source file for a correctness/coherence finding); optionally `requirement`, `scenario`, `lines`, and `note` (the issue text itself)

   ```json
   {
     "verdict": "warning",
     "counts": { "critical": 0, "warning": 1, "suggestion": 2 },
     "evidence": [
       {
         "requirement": "Toggle SHALL exist",
         "scenario": "Toggle visible",
         "file": "src/components/Toggle.tsx",
         "lines": "10-40",
         "note": "Implementation may diverge from spec: toggle does not persist state"
       }
     ]
   }
   ```

   Write it to a temp file, then run:
   ```bash
   speccraft record-verification "<name>" --file <path-to-temp-file> --json
   ```

   If this command fails, report the failure but do not treat it as blocking archive - it is a persistence step, not part of the verification verdict itself.

**Verification Heuristics**

- **Completeness**: Focus on objective checklist items (checkboxes, requirements list)
- **Correctness**: Use keyword search, file path analysis, reasonable inference - don't require perfect certainty
- **Coherence**: Look for glaring inconsistencies, don't nitpick style
- **False Positives**: When uncertain, prefer SUGGESTION over WARNING, WARNING over CRITICAL
- **Actionability**: Every issue must have a specific recommendation with file/line references where applicable

**Graceful Degradation**

- If only a task checklist exists (`progress.total > 0`, no `specs`): verify task completion only, skip spec/design checks
- If a task checklist and `specs` both exist: verify completeness and correctness, skip design
- If full artifacts: verify all three dimensions
- Always note which checks were skipped and why

**Output Format**

Use clear markdown with:
- Table for summary scorecard
- Grouped lists for issues (CRITICAL/WARNING/SUGGESTION)
- Code references in format: `file.ts:123`
- Specific, actionable recommendations
- No vague suggestions like "consider reviewing"
