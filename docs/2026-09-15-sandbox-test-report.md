# Sandbox test report — nx-plugin-openapi (2026-09-15)

## Goal

Before publishing `@istomerf/nx-plugin-openapi`, validate the plugin end-to-end in a throwaway Nx workspace against a locally-published build (`pnpm run local-publish`, Verdaccio on `http://localhost:4873`, tag `local`).

## Setup

- Sandbox workspace scaffolded via `create-nx-workspace@latest sandbox-proj --preset apps --packageManager=pnpm` (outside the repo, in a scratch dir).
- Plugin installed with `pnpm add @istomerf/nx-plugin-openapi@local`, scoped to the local registry via a per-project `.npmrc`:
  ```
  @istomerf:registry=http://localhost:4873
  ```
  (Installing with plain `npm install` against a pnpm-managed `node_modules` crashed npm's arborist with `Cannot read properties of null (reading 'matches')` — unrelated to the plugin. Using `pnpm add` avoided it.)

## Bugs found and fixed

### 1. Invalid JSON Schema for `outputDir` (executor)

`packages/nx-plugin-openapi/src/executors/generate-api-lib-sources/schema.json` declared:
```json
"outputDir": { "type": "string | boolean" }
```
`"string | boolean"` is not a valid JSON Schema `type` value (needs to be a single type string or an array of types). Every real invocation of `generate-sources` failed schema validation with:
```
Property 'outputDir' does not match the schema. 'libs/...' should be a 'string | boolean'.
```
`schema.d.ts` and the executor code only ever treat `outputDir` as a `string`, so fixed to `"type": "string"`.

### 2. Generated executor pointed at the wrong package scope

`packages/nx-plugin-openapi/src/generators/api-lib/generator.ts` hardcoded the `generate-sources` target's executor as:
```
@driimus/nx-plugin-openapi:generate-api-lib-sources
```
but the package actually published to npm is `@istomerf/nx-plugin-openapi`. A real user installing the published package and running `init`/`api-lib` got an immediate, unrecoverable:
```
NX  Unable to resolve @driimus/nx-plugin-openapi:generate-api-lib-sources.
Cannot find module '@driimus/nx-plugin-openapi/package.json'
```
Fixed the executor string in `generator.ts`, the two example commands in the generated lib's `README.md__tmpl__`, and the matching assertions in `generator.spec.ts`. Confirmed via `nx test nx-plugin-openapi --testFile=generator.spec.ts` (14/14 passing) and by re-running the sandbox test below.

Both fixes are committed to the working tree, not yet released.

## End-to-end result (after fixes, republished locally)

1. `nx generate @istomerf/nx-plugin-openapi:init` — bootstrapped `api-spec` + `api-client` libs, updated `package.json`, `tsconfig.base.json`. Generated `libs/api-client/project.json` now correctly references `@istomerf/nx-plugin-openapi:generate-api-lib-sources`.
2. `nx run api-client:generate-sources` — deleted the output dir, shelled out to `openapi-generator-cli` (`typescript-fetch`), and generated a full client (`apis/`, `models/`, `runtime.ts`, `index.ts`, docs) from the sample OpenAPI spec. Task succeeded with no errors.

**Verdict: the `init` → `api-lib`/`api-spec` → `generate-sources` flow works correctly against the actually-published package shape, once both fixes above are applied.**

## Operational note (unrelated to plugin correctness)

`pnpm run local-publish` hung twice at the Verdaccio/local-registry startup step (stuck cycling on "Creating project graph nodes", 0% CPU) while this repo's Nx daemon was warm alongside daemons for unrelated projects on the same machine. Stopping the daemon (`nx daemon --stop`) and re-running with `NX_DAEMON=false` resolved it immediately. Root cause not fully diagnosed — flagging in case it recurs for CI or other contributors.

## E2E harness rebuild

`tools/scripts/start-local-registry.ts` and `stop-local-registry.ts` (the Jest `globalSetup`/`globalTeardown` for `nx-plugin-openapi-e2e`) had been deleted from the repo before this session started, and `packages/nx-plugin-openapi-e2e/tests/happy-path.spec.ts` still referenced them and still used the old `@driimus` scope. Rebuilt around the existing `publish-local.ts` flow:

- Extracted the build+Verdaccio+release-publish logic shared by manual and e2e testing into `tools/scripts/local-registry.ts` (`publishToLocalRegistry({ tag, version, build })`).
- `tools/scripts/publish-local.ts` now calls the shared helper (tag `local`, builds first since it's invoked directly via `node`, not through Nx's task graph).
- Restored `tools/scripts/start-local-registry.ts` / `stop-local-registry.ts` as thin Jest globalSetup/globalTeardown wrappers around the same helper (tag `e2e`, `build: false` since the `e2e` target already depends on `^build`).
- Recreated `packages/nx-plugin-openapi-e2e/tests/happy-path.spec.ts` under the `@istomerf` scope.

## E2E-specific bugs found and fixed (via repeated real e2e runs)

1. **`create-nx-workspace` git-init collision** — scaffolding the throwaway workspace under `<repo>/tmp/nx-e2e/proj` failed with `git add`: `The following paths are ignored by one of your .gitignore files: tmp` (the repo's own `/tmp` gitignore rule), because `create-nx-workspace` detected the enclosing repo and skipped creating its own isolated `.git`. Fixed by adding `--skipGit` to the scaffold command — the throwaway workspace doesn't need its own git repo anyway.
2. **`sudo rm -rf` cleanup hangs without a TTY** — `afterAll` used `sudo rm -rf ${projectDirectory}`, which blocks forever waiting for a password prompt in any non-interactive shell. Replaced with a plain `rmSync`, falling back to a non-interactive `sudo -n rm -rf` (swallowed on failure) only for the rare case of root-owned files left behind by the Docker case in CI.
3. **`npm install` on a pnpm-structured `node_modules`** — `create-nx-workspace` defaults to pnpm on this machine, but `beforeAll` always runs plain `npm install @istomerf/nx-plugin-openapi@e2e`, which crashed with the same arborist bug found in the manual sandbox test (`Cannot read properties of null (reading 'matches')`). Fixed by pinning `--packageManager=npm` on the scaffold command so the workspace's `node_modules` layout matches the install command actually used.
4. **Wrong assertion path** — `existsSync` checked `libs/${lib}/src/index.ts`, but the `api-lib` generator always writes output to `libs/${lib}/openapi-generated-sources/index.ts` (`generator.ts:67`). This assertion was already wrong before this session (inherited unchanged from before the scripts were deleted) and was never caught because the e2e suite couldn't run. Fixed both occurrences.

## Final e2e suite result

`nx e2e nx-plugin-openapi-e2e`: **5 of 6 tests passing.**

| Test | Result |
|---|---|
| should work with a local spec | ✅ pass |
| should work with docker | ❌ fail — **environmental**: Docker Desktop is not running on this machine (`Cannot connect to the Docker daemon`). Not a code defect; needs verification in an environment with Docker available (e.g. CI). |
| should work with a remote spec | ✅ pass |
| --global-properties: one value | ✅ pass |
| --global-properties: multiple values | ✅ pass |
| should support bootstrapping with nx add | ✅ pass |

## Operational note (Verdaccio startup)

`pnpm run local-publish` hung twice at the Verdaccio/local-registry startup step (stuck cycling on "Creating project graph nodes", 0% CPU) while this repo's Nx daemon was warm alongside daemons for unrelated projects on the same machine. Stopping the daemon (`nx daemon --stop`) and re-running with `NX_DAEMON=false` resolved it immediately. Root cause not fully diagnosed — flagging in case it recurs for CI or other contributors.
