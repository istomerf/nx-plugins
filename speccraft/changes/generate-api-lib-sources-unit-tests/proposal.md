## Goal

`executors/generate-api-lib-sources/executor.ts` has no unit test coverage today, despite being the piece that deletes output directories and shells out to `openapi-generator-cli`. The gap: it's easy to silently break CLI arg construction, the docker-vs-npx branch, output-dir handling, or exit-code/error handling and not notice until the slow e2e suite (or a real user) hits it.

The ask is unit tests that do **not** mock `cross-spawn` (or `fs`/`rimraf`) - they exercise the real `spawn` call and real filesystem operations, using a throwaway fake `npx`/`docker` executable on `PATH` to stand in for the real CLI instead of a jest mock. This gives confidence that the executor's actual process-spawning and file-deletion code paths work, not just that it calls a mocked function with the right arguments.

What will change:
- Add `executor.spec.ts` covering: output-dir deletion/creation, CLI argument construction for every optional flag, the docker vs. npx command selection, successful exit (`success: true`), non-zero exit (rejection), and spawn-level errors (e.g. command not found).
- Add a small reusable test fixture (fake CLI executable + PATH helper) under the package's test support area so this approach can be reused by future executor tests.
- No production code changes - this is test-only, no behavior change.

## Capabilities

### New Capabilities
_None - no user-facing behavior changes._

### Modified Capabilities
_None - existing behavior is unchanged; only test coverage is added._

## Acceptance Criteria
- ACC1: `executor.spec.ts` exists and exercises `runExecutor` end-to-end without `jest.mock`-ing `cross-spawn`, `child_process`, `fs`, or `rimraf`.
- ACC2: Tests cover: existing output dir gets deleted before generation; output dir gets created; correct command/args for the `npx` path; correct command/args for the `useDockerBuild` path; each optional flag (`additionalProperties`, `globalProperties`, `typeMappings`, `sourceSpecUrlAuthorizationHeaders`, `ignoreList`) is included only when provided; `silent` controls stdio piping; success (`exit 0`) resolves `{ success: true }`; non-zero exit rejects; a spawn `error` event (unresolvable command) rejects.
- ACC3: `pnpm nx test nx-plugin-openapi` passes, including the new spec, on a machine/CI with no network access and no real `openapi-generator-cli`/Docker installation required for the tests to pass.
- ACC4: `pnpm nx lint nx-plugin-openapi` passes for the new files.

## Impact

- New file: `packages/nx-plugin-openapi/src/executors/generate-api-lib-sources/executor.spec.ts`.
- New test-support fixture (fake CLI executables + file-based control, see design.md) under `packages/nx-plugin-openapi/src/test-support/`, plus a Jest `globalSetup`/`globalTeardown` pair wired into `jest.config.ts` to bake the fake `npx`/`docker` onto `PATH` once for the whole test run (per-test `PATH` mutation doesn't work under this project's Jest/Node combo - see design.md).
- No changes to `executor.ts`, `schema.json`, `project.json`, or any published package behavior.
- Corrects stale context: `CLAUDE.md`/`speccraft/config.yaml` reference a `packages/nx-plugin-openapi/src/test/mockSpawn.ts` helper that does not exist in the repo - this change does not resurrect that file, since the user explicitly wants unmocked tests.
