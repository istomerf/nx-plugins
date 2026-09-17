## Parallel Execution Path
<!-- Single track - this is one small, sequential unit of test-only work with no independent streams to parallelize. -->

## Track A: Unmocked executor tests

- [x] A1 Add a fake-CLI test-support module (`test-support/fake-cli.ts`) plus `test-support/global-setup.ts` / `global-teardown.ts` wired into `jest.config.ts`: `globalSetup` creates one fixed-for-the-run temp bin dir with executable `npx`/`docker` scripts and prepends it to `process.env.PATH` (mutated once, before Jest's per-test sandbox exists - per-test `process.env.PATH` mutation does not work under this project's Jest/Node combo, see design.md); `globalTeardown` removes it. The scripts read/write per-test control and args-capture files located via `dirname(outputDir)` (parsed from their own `-o` argv), not via env vars
  - Verify: `executor.spec.ts`'s own first test (A2) spawns through the fixture and observes the expected captured args and exit code, proving the mechanism end-to-end
- [x] A2 Create `executor.spec.ts` with `beforeEach`/`afterEach` that set up real temp dirs (`context.root`, and a scratch dir containing `outputDir`) via `fs.mkdtempSync`, no `jest.mock` of `cross-spawn`/`fs`/`rimraf`
  - Verify: a first real test - e.g. default exit code 0 with no control files written - runs `runExecutor` and resolves `{ success: true }` under `pnpm nx test nx-plugin-openapi`
- [x] A3 Test: existing `outputDir` is deleted before generation and recreated
  - Verify: ACC2 (output-dir deletion/creation) - a pre-existing file inside `outputDir` is gone after `runExecutor` resolves, and `outputDir` exists
- [x] A4 Test: npx path command/args - base args (`generate -i <spec> -g <generator> -o <outputDir>`) via `npx openapi-generator-cli`, and each optional flag (`additionalProperties`, `globalProperties`, `typeMappings`, `sourceSpecUrlAuthorizationHeaders`, `ignoreList`) appended only when provided
  - Verify: ACC2 - args captured by the fake `npx` script match expectations for both a minimal schema and a schema with all optional fields set
- [x] A5 Test: `useDockerBuild: true` invokes `docker run --rm -v <cwd>:/local:rw -w /local openapitools/openapi-generator-cli ...` instead of `npx`
  - Verify: ACC2 - args captured by the fake `docker` script match the expected docker invocation
- [x] A6 Test: `silent` option controls stdio - `silent: true` produces no `logger.info`/`logger.error` calls from stdout/stderr; `silent: false`/default logs stdout via `logger.info` and stderr via `logger.error` (spy on `@nx/devkit`'s `logger`, not on `cross-spawn`)
  - Verify: ACC2 - logger spy assertions differ correctly between `silent: true` and `silent: false` using a fake script that writes known stdout/stderr text
- [x] A7 Test: success and failure exit codes - exit `0` resolves `runExecutor` with `{ success: true }`; non-zero exit causes `runExecutor` to reject
  - Verify: ACC2 - both outcomes observed via the fake script's `FAKE_CLI_EXIT_CODE`
- [x] A8 Test: spawn-level error - temporarily overwrite the shared fake `npx` (or `docker`) script with a broken-shebang variant (`#!/nonexistent/bad-interpreter`) so the OS `exec` itself fails, restoring the original in a `finally`, and assert `runExecutor` rejects
  - Verify: ACC2 - a real `child.on('error', reject)` observed (not a mocked rejection, not a nonzero exit) without any mocking of `cross-spawn`
- [x] A9 Run `pnpm nx test nx-plugin-openapi` and `pnpm nx lint nx-plugin-openapi`, fix any failures
  - Verify: ACC3, ACC4 - both commands pass, including the new spec and fixture files
- [x] A10 COMMIT

## Verification
- [x] V1 `pnpm nx test nx-plugin-openapi` passes with the new `executor.spec.ts` included, with no network access and without Docker/`openapi-generator-cli` installed
- [x] V2 `pnpm nx lint nx-plugin-openapi` passes
- [x] V3 `grep -r "jest.mock" packages/nx-plugin-openapi/src/executors/generate-api-lib-sources/` returns nothing (confirms ACC1 - no mocking of cross-spawn/fs/rimraf)
