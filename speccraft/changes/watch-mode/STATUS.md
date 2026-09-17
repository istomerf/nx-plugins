# Status report: watch-mode

Generated during `/scx:apply watch-mode`, mid-implementation.

## Progress: 10/12 tasks complete

### Track A: Watch executor core — done
- [x] A1 — `generateSources()` extracted to `utils/generate-sources.ts` (exported), `generate-api-lib-sources/executor.ts` now imports it. No behavior change.
- [x] A2 — `chokidar` (`^4.0.1`, dual CJS/ESM build — chosen over the ESM-only 5.x so it stays `require()`-able under this project's CommonJS/`nodenext` build) added as a peer dependency. `utils/watch-spec-file.ts` implements `watchSpecFile(specPath, onChange, { debounceMs = 300 })` with debounce + "at most one trailing rerun" queuing while a run is in-flight.
- [x] A3 — `executors/watch-api-lib-sources` implemented: fails fast on `/^https?:\/\//` before watching; otherwise wires `watchSpecFile` to `generateSources()`. Async-generator continuous-executor shape (`yield {success}` once, then stays alive until Nx kills the process on stop — cleans up the chokidar watcher on `SIGINT`/`SIGTERM`).
- [x] A4 — registered in `executors.json`.
- [x] A5 — real (non-mocked) tests:
  - `utils/watch-spec-file.spec.ts` — 4 tests against real temp files + real chokidar events (single-change dispatch, debounce collapsing, trailing-rerun-while-running, close() stops watching).
  - `executors/watch-api-lib-sources/executor.spec.ts` — 2 tests: remote-spec fail-fast (S03), and a real save → real `generateSources()` → real (faked-on-PATH) `npx openapi-generator-cli` invocation (S01).

### Track B: Generator target registration — done
- [x] B1 — `api-lib/generator.ts`'s `addProject` now registers `watch-sources` (executor `@istomerf/nx-plugin-openapi:watch-api-lib-sources`, same options as `generate-sources`) only when `!options.isRemoteSpec && options.sourceSpecLib`.
- [x] B2 — generator tests added for both the local-spec (`watch-sources` present, same options as `generate-sources`) and remote-spec (`watch-sources` absent) cases.

### Verification
- [x] V1 — `pnpm nx test nx-plugin-openapi`: **38/38 passing, 7/7 suites**, run 3× to rule out flakiness.
- [x] V2 — `pnpm nx lint nx-plugin-openapi`: 0 errors (1 pre-existing-style warning: unused `_context` param in the new executor, required by the executor signature contract; not enforced by this repo's lint config).
- [ ] V3 — not yet done (Nx `continuous` batch-exclusion). See "What's left" below — reasoned through via Nx source, not yet empirically verified against a real workspace.
- [ ] V4 — not yet done (manual smoke test against a real scaffolded `api-lib` project).
- [ ] V5 — COMMIT — not done (no commits made this session; nothing should be committed until V3/V4 are resolved and the user reviews).

## Notable mid-flight event: concurrent-session collision, resolved

Partway through A5, another Claude Code session (`nx-plugins-1a`) working in this **same working directory** turned out to be concurrently rewriting the shared test fixture `packages/nx-plugin-openapi/src/test-support/fake-cli.ts` (+ new `global-setup.ts`/`global-teardown.ts`, + `jest.config.ts` wiring) for a separate, independent SpecCraft change (`generate-api-lib-sources-unit-tests`). That broke the executor test I'd just written against the pre-rewrite API.

Investigation (with the peer session, and independently reproduced) confirmed a real, non-superficial constraint: per-test `process.env.PATH` mutation does **not** reach `cross-spawn`-spawned children under this repo's Jest 30 + ts-jest setup (confirmed working in plain Node, confirmed broken under `nx test`). The only reliable fix is a Jest `globalSetup` that replaces `PATH` once, before Jest forks workers — a project-wide singleton (one `jest.config.ts` slot), so no independent/self-contained alternative was possible without duplicating that mechanism and colliding with the peer's in-flight edit to the same file.

Per user direction, I asked the peer session to pause and took over finishing/stabilizing the shared fixture. Result, now in the working tree (not authored by the watch-mode change's own scope, but required to unblock it):
- `packages/nx-plugin-openapi/src/test-support/fake-cli.ts` (peer's design, verified working): `createFakeCliScenario()` / `setFakeCliExitCode|Stdout|Stderr()` / `readFakeCliArgs()` / `removeFakeCliBinary()`.
- `packages/nx-plugin-openapi/src/test-support/global-setup.ts` / `global-teardown.ts` — replace `PATH` with a fake `npx`/`docker` bin dir once, for the whole Jest run.
- `packages/nx-plugin-openapi/jest.config.ts` — wired to the two above.
- My own `watch-api-lib-sources/executor.spec.ts` was rewritten against this final API.
- Verified stable: full suite green 3× in a row (peer's `generate-api-lib-sources/executor.spec.ts` — 9/9 — plus everything else).
- Peer (`nx-plugins-1a`) was notified the fixture is stable and can resume.

## What's left

- **V3** (continuous-batch-exclusion): Traced through Nx 23.2.1's own source (`target-normalization.js`) to confirm the mechanism — `schema.continuous` (our `schema.json`'s top-level `"continuous": true`) flows into `target.continuous` whenever the target itself doesn't set it, and Nx's task scheduler excludes `continuous` tasks from `affected`/batch runs. Not yet empirically re-verified end-to-end against a real scaffolded workspace (would need `nx show project --json` or a real `affected:test` run against a project carrying this target).
- **V4** (manual smoke test): needs a real, CLI-driven `nx run <lib>:watch-sources` against a scaffolded `api-lib` project (not just the in-process executor tests already passing) — edit the spec, watch it regenerate, Ctrl-C it, confirm clean exit.
- **V5** (commit): intentionally not done — pending V3/V4 and your review of everything above, especially the fixture takeover (files under `test-support/` and `jest.config.ts` beyond this change's original stated scope).

See `HANDOFF.md` in this same folder for how to resume.
