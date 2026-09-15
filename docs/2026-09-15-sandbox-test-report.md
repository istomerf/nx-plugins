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

## Open item raised with the user

The user asked mid-session for e2e tests. `tools/scripts/start-local-registry.ts` and `stop-local-registry.ts` (the old Jest `globalSetup`/`globalTeardown` for `nx-plugin-openapi-e2e`) were already deleted from the repo before this session started, but `packages/nx-plugin-openapi-e2e/tests/happy-path.spec.ts` still references them and still uses the old `@driimus` scope in its generator commands. This needs a decision on direction (restore the old scripts vs. rebuild the e2e harness around the new `publish-local.ts` flow, plus updating the spec to `@istomerf`) before that work proceeds.
