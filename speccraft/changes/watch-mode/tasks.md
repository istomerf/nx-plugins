## Parallel Execution Path

```
                    ┌─ Track A: Watch executor core ────────---┐
Start ──────────────┤                                          ├──▶ Verification
                    └─ Track B: Generator target registration-┘
```

Track A and Track B touch disjoint files (`executors/*`, `utils/*` vs. `generators/api-lib/generator.ts`) and can run concurrently; both converge at Verification.

## Track A: Watch executor core

- [x] A1 Extract `generateSources()` out of `generate-api-lib-sources/executor.ts` into `utils/generate-sources.ts`, exported; update `generate-api-lib-sources/executor.ts` to import it, no behavior change
  - Verify: existing `generate-api-lib-sources` executor unit tests still pass unchanged
- [x] A2 Add `chokidar` as a `peerDependency` in `packages/nx-plugin-openapi/package.json`; implement `utils/watch-spec-file.ts` (`watchSpecFile(specPath, onChange, { debounceMs = 300 })`) with debounced, trailing-rerun-queued change dispatch
  - Verify: the "Multiple saves within debounce window" scenario passes (api-lib/watch-sources#S02)
- [x] A3 Implement `executors/watch-api-lib-sources` (`executor.ts`, `schema.json` with `"continuous": true`, `schema.d.ts`): validate `sourceSpecPathOrUrl` against `/^https?:\/\//` and fail fast before watching if remote; otherwise call `watchSpecFile` wired to `generateSources()`
  - Verify: the "Spec file saved triggers regeneration" scenario passes (api-lib/watch-sources#S01)
- [x] A4 Register `watch-api-lib-sources` in `executors.json`
  - Verify: `nx run <fixture-lib>:watch-sources` resolves the executor without an "unknown executor" error
- [x] A5 Unit tests (no mocking): `watch-spec-file.ts` against real temp files with real `fs.watch`/chokidar events; `watch-api-lib-sources` executor end-to-end against a small fixture OpenAPI spec, invoking the real `generateSources()` → real `openapi-generator-cli` via `npx`
  - Verify: the "Watch invoked on remote-spec project" scenario passes (api-lib/watch-sources#S03), and A2/A3's scenarios above are covered by real (non-mocked) test runs

## Track B: Generator target registration

- [x] B1 Update `api-lib/generator.ts`'s `addProject` to register a `watch-sources` target (executor `@istomerf/nx-plugin-openapi:watch-api-lib-sources`, same options shape as `generate-sources`) only when `!options.isRemoteSpec && options.sourceSpecLib`
  - Verify: the "Local-spec project gets watch-sources target" scenario passes (api-lib/watch-sources#S05)
- [x] B2 Unit test: generator run against a remote-spec schema produces a `project.json` with no `watch-sources` target
  - Verify: the "Remote-spec project does not get watch-sources target" scenario passes (api-lib/watch-sources#S06)

## Verification

- [x] V1 `pnpm nx test nx-plugin-openapi` passes in full, including all new and pre-existing executor/generator unit tests
- [x] V2 `pnpm nx lint nx-plugin-openapi` passes
- [ ] V3 Confirm `watch-sources`'s `continuous: true` marking excludes it from batch runs: `nx affected:test` / `nx run-many -t test` on a workspace containing a `watch-sources`-registered project does not attempt to execute that target (api-lib/watch-sources#S04)
- [ ] V4 Manual smoke test: scaffold a local-spec `api-lib` project, run `nx run <lib>:watch-sources`, edit the spec file, confirm regeneration completes within roughly the 300ms debounce window, then stop the process and confirm it terminates cleanly
- [ ] V5 COMMIT
