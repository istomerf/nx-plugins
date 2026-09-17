# Handoff: watch-mode

For whoever (or whichever session) picks this up next. Read `STATUS.md` first for the detailed rundown; this is the "how to resume" summary.

## Resume with

```
/scx:apply watch-mode
```

`tasks.md` in this folder is the source of truth for what's checked off (10/12). Re-running the skill will read it, see A1–A5/B1–B2/V1–V2 done, and pick up at V3.

## Files touched, at a glance

**Watch-mode's own scope** (new/changed):
- `packages/nx-plugin-openapi/src/utils/generate-sources.ts` (new — extracted)
- `packages/nx-plugin-openapi/src/executors/generate-api-lib-sources/executor.ts` (now imports the extracted fn)
- `packages/nx-plugin-openapi/src/utils/watch-spec-file.ts` + `.spec.ts` (new)
- `packages/nx-plugin-openapi/src/executors/watch-api-lib-sources/` (new: `executor.ts`, `executor.spec.ts`, `schema.json`, `schema.d.ts`)
- `packages/nx-plugin-openapi/executors.json` (registered new executor)
- `packages/nx-plugin-openapi/package.json` (added `chokidar` peer dep)
- `packages/nx-plugin-openapi/src/generators/api-lib/generator.ts` + `generator.spec.ts` (new `watch-sources` target registration + tests)

**Outside watch-mode's original scope, but required to unblock it** (see STATUS.md's "concurrent-session collision" section — this belongs conceptually to the `generate-api-lib-sources-unit-tests` change, whose own session (`nx-plugins-1a`) had it mid-rewrite and paused):
- `packages/nx-plugin-openapi/src/test-support/fake-cli.ts` (rewritten API, now stable)
- `packages/nx-plugin-openapi/src/test-support/global-setup.ts`, `global-teardown.ts` (new)
- `packages/nx-plugin-openapi/jest.config.ts` (wired to the above)
- `packages/nx-plugin-openapi/src/test-support/fake-cli.spec.ts` was deleted by the peer session pre-handoff (superseded by the new design; not restored)

**Worth flagging on review**: the fixture files above are shared infrastructure two independent changes now depend on. Before merging/committing, decide whether they should land as part of *this* change, be split into their own commit, or be handed back to land with `generate-api-lib-sources-unit-tests`.

## Immediate next steps (V3–V5)

1. **V3**: verify `continuous: true` (from `watch-api-lib-sources/schema.json`) actually excludes the target from `nx affected:test` / `nx run-many -t test` on a real workspace. Scaffolding one needs network (`create-nx-workspace`) — confirmed available in this environment when I checked. This monorepo doesn't currently dogfood the plugin against itself, so there's no existing project to point `nx show project --json` at.
2. **V4**: manual smoke test — scaffold a local-spec `api-lib` project for real, `nx run <lib>:watch-sources`, edit the spec, confirm regen + clean Ctrl-C shutdown. The unit tests already cover the same mechanics in-process (real chokidar, real spawn via a faked `npx` on PATH) but V4 asks for the real CLI entry point specifically.
3. **V5**: COMMIT — do this last, after the user has reviewed the shared-fixture takeover above, and after V3/V4 are either done or explicitly waived.

## Cross-session coordination notes

- Peer session `nx-plugins-1a` is paused, waiting on a ping once the fixture (test-support/fake-cli.ts + global-setup/teardown + jest.config.ts) is confirmed stable — **it now is** (full suite green 3×), and they were notified. If you're a fresh session picking this up, no need to re-notify unless you change those files again.
- Peer session `nx-plugins-3c` was given a heads-up as a courtesy; no action needed there unless it turns out to also be touching this area.
- If you see unexpected changes to files you didn't touch again, check `ListAgents` before assuming something is broken — there may be another live session in this same working directory.
