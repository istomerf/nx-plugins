## Context

`generate-api-lib-sources/executor.ts` deletes `outputDir` then shells `openapi-generator-cli` (`npx` or `docker run`) via a private, unexported `generateSources()`. `api-lib/generator.ts` always registers a `generate-sources` target; it conditionally sets `implicitDependencies` on `!options.isRemoteSpec && options.sourceSpecLib` — the existing precedent for "local-spec-only" branching. The generator's executor-options builder (`getExecutorOptions`) resolves `sourceSpecPathOrUrl` to either a workspace-relative path or a URL, but the executor schema itself carries no `isRemoteSpec` flag — only the resolved string. Nx is pinned at `23.2.1`, comfortably within continuous-task support (Nx 20+). No file-watching library is currently a dependency; `cross-spawn` and `rimraf` are declared as `peerDependencies` of the plugin package rather than regular `dependencies`. See proposal.md - Goal for motivation.

## Goals / Non-Goals

**Goals:**
- Reuse `generateSources()` unchanged in behavior for both one-shot and watch executors.
- Keep the watch executor's failure mode for remote specs symmetric with the generator's registration behavior (defense in depth: even if someone hand-wires the executor into `project.json`, it still refuses a remote spec).
- Never let overlapping spec saves start two concurrent `openapi-generator-cli` runs.

**Non-Goals:**
- Multi-file (`$ref`) watch sets — v1 watches only the entry spec file (proposal's open question, not resolved here).
- A long-lived/daemon `openapi-generator-cli` process — each regeneration still pays full CLI startup cost.
- Watching remote specs via polling.

## Decisions

### Decision: File-watching mechanism

| Option                | Atomic-save reliability                                                                                            | Dependency footprint                                                                 | Debounce/coalescing                                                         |
|-----------------------|--------------------------------------------------------------------------------------------------------------------|--------------------------------------------------------------------------------------|-----------------------------------------------------------------------------|
| `fs.watch` (built-in) | Low — editors that save via unlink+rename (vim, some IDEs) fire inconsistent `rename` events depending on platform | None                                                                                 | Manual, but must also paper over duplicate/rename-vs-change event semantics |
| chokidar (chosen)     | High — normalizes atomic-save patterns across platforms into a single `change` event                               | New dependency, added as `peerDependency` (matches `cross-spawn`/`rimraf` precedent) | Manual debounce on top of chokidar's normalized events                      |

`fs.watch`'s platform-inconsistent rename semantics on atomic saves is a real failure mode for editors developers use daily (vim, JetBrains atomic save). Chokidar absorbs that at the cost of one dependency, kept as a peer dependency to match how this plugin already ships its other runtime shell-out dependency (`cross-spawn`).

### Decision: Where `generateSources()` lives

Only one reasonable option given the "no reuse duplication" goal: extract `generateSources()` out of `generate-api-lib-sources/executor.ts` into `utils/generate-sources.ts`, exported, with both executors importing it. Keeps neither executor depending on the other's module, and matches the existing `utils/delete-output-dir.ts` pattern already used by `generate-api-lib-sources`.

### Decision: Detecting a remote spec inside the watch executor

Only one reasonable option: the executor schema has no `isRemoteSpec` flag, only the resolved `sourceSpecPathOrUrl` string — so the watch executor fails fast when that string matches `/^https?:\/\//`, before touching the filesystem. Cheap, and matches how the generator already resolves the same field.

### Decision: Handling a spec save while a regeneration is in-flight

| Option | Correctness | Complexity |
|---|---|---|
| Drop overlapping change events entirely | Wrong — a save during generation is silently lost, output can go stale | Low |
| Kill in-flight generation, restart | Wastes partial `openapi-generator-cli` work every time; harder to guarantee clean process termination (Docker case) | Medium |
| Queue at most one trailing rerun (chosen) | A save during generation schedules exactly one follow-up run after the current one finishes; further saves during that window collapse into the same pending rerun | Low-medium |

Trailing-rerun queuing guarantees the last saved state is always eventually reflected without ever running two `openapi-generator-cli` processes concurrently.

## Risks / Trade-offs

- [Regen cost] `openapi-generator-cli` startup (JVM boot, or Docker container start) is seconds, not milliseconds — watch mode feels sluggish per save → Mitigation: none in v1; document the latency as expected. Revisit only if a daemon/long-lived mode is investigated later.
- [Invalid intermediate saves] Editors can write partially-valid YAML mid-keystroke, triggering a failing generator run → Mitigation: none in v1 given the "no mocking, real CLI" testing decision already accepted — the trailing-rerun queue (see Decisions) at least ensures the next valid save re-triggers generation; a cheap pre-parse check is deferred as an open question below.
- [Multi-file specs] `$ref`s into other files aren't watched, so cross-file edits don't trigger regeneration → Mitigation: none in v1, called out in proposal as known v1 limitation.
- [New dependency] Adding chokidar as a peer dependency means consuming workspaces must install it → Mitigation: `api-lib` generator's `init` task can flag it as a required peer, consistent with how `cross-spawn`/`rimraf` are already surfaced.

## Migration Plan

Purely additive: new executor (`watch-api-lib-sources`), new shared utils, new generator-time target registration for newly-scaffolded local-spec `api-lib` projects. No existing `project.json` for already-generated libs is touched — an existing project must add the `watch-sources` target manually if it wants watch mode. Rollback is a plugin version downgrade; no data migration or generated-output format change involved.

## Open Questions

- Whether to add a cheap YAML pre-parse check before shelling out on each debounced change, to avoid spamming failing generator runs on invalid intermediate saves — doesn't change the spec contract (ACC1/ACC2 only require eventual regeneration on a real change) or the task breakdown either way; can be decided during implementation.
- Exact Nx 23 continuous-executor shutdown contract (`AbortSignal` on `context` vs. relying on process signals) for closing the chokidar watcher cleanly — affects implementation only, not observable behavior covered by any ACC.
