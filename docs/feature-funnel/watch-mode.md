# Feature sketch: watch mode for `generate-sources`

## Problem

Regenerating an `api-lib`'s sources today requires manually re-running `nx run <lib>:generate-sources`
every time the spec changes. While actively iterating on a contract + client together, that's a slow
loop — edit spec, switch to terminal, run command, switch back.

## Proposal

A new continuous executor, `watch-api-lib-sources`, that wraps the existing `generateSources()` logic
from `generate-api-lib-sources/executor.ts` and re-runs it whenever the source spec file changes on disk.

- Watches the resolved local spec file (chokidar or `fs.watch`), debounced (default 300ms) to avoid
  triggering mid-save or on partial writes.
- Marked `"continuous": true` in its `schema.json` (Nx 20+ continuous-task support), so it composes with
  `nx watch`, `run-many --parallel`, and dev-mode target dependency chains instead of exiting immediately.
- `api-lib` generator gains a `--watch`-adjacent registration: either a sibling `watch-sources` target
  auto-added alongside `generate-sources`, or the same executor gaining a `watch: true` option — leaning
  towards a separate target since continuous vs. one-shot targets behave differently in Nx's task graph
  (e.g. `affected`/CI shouldn't accidentally try to run the continuous one).
- **v1 scope: local spec only.** `isRemoteSpec` specs have no filesystem event to hook — watch mode should
  fail fast with a clear error rather than silently no-op or poll.

## Sketch

```jsonc
// project.json, alongside the existing generate-sources target
"watch-sources": {
  "executor": "@istomerf/nx-plugin-openapi:watch-api-lib-sources",
  "options": { /* same shape as generate-sources options */ },
  "continuous": true
}
```

```sh
nx run api-client:watch-sources
```

## Shared groundwork

Both this and the mock-server feature ([[mock-server]]) need "watch a local spec file and react to
changes." Worth extracting a shared `watchSpecFile(specPath, onChange)` util (e.g.
`packages/nx-plugin-openapi/src/utils/watch-spec-file.ts`) rather than building the file-watching twice.

## Open questions / risks

- **Regen cost**: `openapi-generator-cli` startup (JVM boot, or Docker container start) is seconds, not
  milliseconds. Watch mode re-running the full CLI per save may feel sluggish. Worth investigating whether
  openapi-generator-cli has any long-lived/daemon mode, or whether we just document the latency as expected.
- **Invalid intermediate saves**: editors can write partially-valid YAML mid-keystroke. Should do a cheap
  parse check before shelling out to the generator, so watch mode doesn't spam failing runs on every
  autosave.
- **Multi-file specs**: if the entry spec `$ref`s other files, watching only the entrypoint misses changes
  in referenced files — need to watch the containing directory (or resolve refs to build a watch set).
- **CI/affected implications**: a continuous target should never be picked up by `nx affected:test`-style
  commands by accident — confirm Nx's continuous-task semantics handle this cleanly before shipping.
