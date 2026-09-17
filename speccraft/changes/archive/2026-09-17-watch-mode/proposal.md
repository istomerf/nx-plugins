## Goal

Regenerating an `api-lib`'s sources today requires manually re-running `nx run <lib>:generate-sources` on every spec edit — slow loop while iterating on contract + client together. Add continuous watch support so sources regenerate automatically on local spec changes.

- New continuous executor, `watch-api-lib-sources`, reusing `generateSources()` from `generate-api-lib-sources/executor.ts`.
- Watches resolved local spec file, debounced (default 300ms), re-runs generation on change.
- Marked `"continuous": true` (Nx 20+ continuous-task support) so it composes with `nx watch`, `run-many --parallel`, dev-mode target chains.
- `api-lib` generator gains a sibling `watch-sources` target alongside `generate-sources`, wired to the new executor.
- v1 scope: local spec only. Remote (`isRemoteSpec`) specs fail fast with clear error — no filesystem event to hook, no polling fallback.
- Shared `watchSpecFile(specPath, onChange)` util extracted for reuse (mock-server feature will need same file-watching logic).

## Capabilities

### New Capabilities
- `api-lib/watch-sources`: continuous target/executor that watches a local OpenAPI spec file and re-runs source generation on change, debounced, local-spec-only in v1.

### Modified Capabilities
(none — `generate-api-lib-sources` executor logic is reused, not changed; `api-lib` generator only gains a new target registration, no existing requirement changes)

## Acceptance Criteria
- ACC1: Running `nx run <lib>:watch-sources` on an `api-lib` project with a local `sourceSpecLib` watches the resolved spec file and regenerates sources on save.
- ACC2: Rapid successive saves within the debounce window (300ms default) trigger a single regeneration, not one per save.
- ACC3: Running `watch-sources` against an `api-lib` configured with a remote spec URL fails fast with a clear error message; no watch loop starts.
- ACC4: `watch-sources` target is excluded from `affected`/CI test-style runs by virtue of its `continuous: true` marking — confirmed via Nx continuous-task semantics.
- ACC5: `api-lib` generator registers `watch-sources` target automatically for local-spec projects, alongside existing `generate-sources`.

## Impact

- `packages/nx-plugin-openapi/src/executors/generate-api-lib-sources/executor.ts` — export/reuse `generateSources()` for the new executor.
- New: `packages/nx-plugin-openapi/src/executors/watch-api-lib-sources/` (executor.ts, schema.json, schema.d.ts).
- New: `packages/nx-plugin-openapi/src/utils/watch-spec-file.ts` — shared watch util (chokidar or `fs.watch`).
- `packages/nx-plugin-openapi/src/generators/api-lib/generator.ts` — register `watch-sources` target for local-spec projects.
- `executors.json` — register new executor.
- `package.json` (plugin) — new dependency if using chokidar.
- Unit tests: no mocking — `watchSpecFile` tested against real temp files with real `fs.watch`/chokidar events and real debounce timing; `watch-api-lib-sources` executor tested end-to-end against a small fixture OpenAPI spec, invoking the real `generateSources()` → real `openapi-generator-cli` via `npx`, asserting regenerated output on real file changes; generator test coverage for new target registration.
- No e2e test for this change — real-CLI generation is already exercised by the no-mock unit tests above.
