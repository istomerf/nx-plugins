---
name: speccraft-bootstrap
description: Seed speccraft/config.yaml context/rules from an existing codebase - for adopting SpecCraft on a brownfield project.
allowed-tools: Bash(speccraft:*)
license: MIT
compatibility: Requires speccraft CLI.
metadata:
  author: speccraft
  version: "1.0"
  generatedBy: "1.0.1"
---

Seed this project's `speccraft/config.yaml` `context` and per-artifact `rules` from the existing codebase, so every artifact SpecCraft generates from now on already knows the project's stack, conventions, and domain - without the user hand-writing it.

**Store selection:** If the user names a store (a store is a standalone SpecCraft repo registered on this machine) or the work lives in one, run `speccraft store list --json` to discover registered store ids, then pass `--store <id>` on the commands that read or write specs and changes (`bootstrap`, `new change`, `status`, `instructions`, `list`, `show`, `validate`, `archive`, `doctor`, `context`, `schemas`, `view`, `record-verification`, `record-flow`, `worktree add`, `worktree list`, `worktree open`, `worktree remove`). Once selected, treat `--store <id>` as sticky for the rest of the workflow. Every unscoped example of those commands below is shorthand: before running it, append the flag. For example, run `speccraft status --change "<name>" --json --store "<id>"`, not the unscoped form shown below. Other commands do not take the flag. Hints printed by commands already carry the flag; keep it on follow-ups. Without a store, commands act on the nearest local `speccraft/` root.

This workflow is re-runnable: run it again any time the codebase has evolved enough that the recorded context is stale. Merging is additive - text already recorded is never duplicated.

---

## Preflight

```bash
speccraft --version 2>&1 || echo "CLI_NOT_INSTALLED"
```

**If CLI not installed:** tell the user to install it, then stop.

**If `speccraft/config.yaml` does not exist yet:** tell the user to run `speccraft init` first, then stop. Bootstrap seeds an existing config; it does not create the project from scratch.

---

## Phase 1: Scan

Run the mechanical, non-AI scan first - it's cheap and gives you a starting inventory:

```bash
speccraft bootstrap --json
```

This returns `scan.manifest` (package name/description/dependencies/scripts), `scan.readme` (an excerpt), `scan.lintFormatConfig`, `scan.typescript` (tsconfig presence/strictness), `scan.topLevelEntries` (top-level dirs/files), `scan.recentCommits`, and `scan.existingConfig` (what's already recorded - schema, whether context is already set, which artifact IDs already have rules).

Then read further yourself, beyond what the mechanical scan covers:
- The full README (the scan only gives an excerpt).
- `package.json` in full, and any workspace/monorepo config (`pnpm-workspace.yaml`, `lerna.json`, etc.).
- A sample of real source files under the top-level entries the scan reported, enough to notice real conventions (naming, error handling style, test structure) rather than guessing from configs alone.
- Any existing `speccraft/specs/` content, if present - it tells you the project's domain vocabulary and how it's already being described.

Find the project's configured schema and its valid artifact IDs (rules are keyed by artifact ID, and IDs vary by schema):

```bash
speccraft schemas --json
```

Match `scan.existingConfig.schema` (or the config's `schema:` field) against an entry's `name`, and use its `artifacts` list as the valid rule keys (typically `proposal`, `specs`, `design`, `tasks`, but this varies by schema - never guess).

---

## Phase 2: Draft

**EXPLAIN:**
```
## Seeding Project Context

I've scanned the repo. Here's a draft of what I'd record in speccraft/config.yaml so every future artifact already knows this - tech stack, conventions, domain - without you repeating it each time.
```

**DO:** Draft two things:

1. A `context` string: tech stack, key dependencies/frameworks, testing approach, lint/format conventions, domain vocabulary, directory layout conventions. Keep it factual and dense - this gets injected into every artifact instruction, so verbosity here is a tax paid on every future change. If `scan.existingConfig.hasContext` is true, draft only what's missing or has changed - do not restate what's already recorded, since the merge already keeps it.

2. Per-artifact `rules`: short, concrete constraints for specific artifact IDs (e.g. `proposal`: "Reference the existing spec path being modified, if any"; `tasks`: "Group tasks by file, not by layer"). Only add rules that reflect something real and specific about this project - skip generic advice any project could get from the schema's built-in guidance. Skip artifact IDs already listed in `scan.existingConfig.ruleArtifactIds` unless you have a genuinely new rule to add for them.

**SHOW:**
```
Here's the draft:

---

## Context

<the drafted context string>

## Rules

### <artifact-id>
- <rule>
- <rule>

---

Does this look right? I can adjust before saving. (Nothing is written yet.)
```

**PAUSE** - wait for user approval or edits. Incorporate any requested changes before proceeding.

---

## Phase 3: Write

Once approved, write the two drafts to temporary files, merge them in, then delete the temporary files:

```bash
# write the approved context string to a temp file, and the approved rules
# to a temp JSON file shaped { "<artifact-id>": ["<rule>", ...], ... }
speccraft bootstrap --context-file <tmp-context-path> --rules-file <tmp-rules-path> --write --json
```

Omit whichever flag has nothing to contribute (e.g. `--rules-file` alone if there's no new context). The JSON response reports `context.changed`, the `rules` actually added per artifact, and `mergedContextSizeBytes` against `maxContextSizeBytes` - if `exceedsMaxContextSize` is true, the write is refused; shorten the context and retry.

Delete the temporary files once the write succeeds.

**SHOW:**
```
## Done

Recorded in speccraft/config.yaml:
- Context: <updated | unchanged - already covered>
- Rules added: <artifact-id>: <count>, ...

This is now injected into every artifact SpecCraft generates for this project. Run /scx:bootstrap again later if the codebase changes enough to be worth re-scanning.
```

---

## Guardrails

- **Never write without approval** - Phase 3 only runs after the user has seen and confirmed the draft in Phase 2.
- **Additive, not exhaustive** - this seeds a starting context, not a full architectural document. Keep it dense; the goal is useful signal per token, not completeness.
- **Respect what's already recorded** - use `scan.existingConfig` to avoid re-drafting context or rules that already exist; the CLI merge is also idempotent, but drafting only what's new keeps the review step short.
- **Don't guess artifact IDs** - always confirm valid rule keys via `speccraft schemas --json` for the project's actual schema before drafting rules.
