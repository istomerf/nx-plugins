# Feature sketch: breaking-change detection for `api-spec` libs

## Problem

A spec can change in a way that silently breaks every consumer of the generated client — a removed field,
a newly-required property, a changed response shape — and nothing today flags that at PR time. The only
signal is downstream: a consumer's generated client changes shape and something fails later, far from the
spec change that caused it.

## Proposal

A new one-shot executor, `diff-api-spec`, addable to an `api-spec` lib (e.g. via a `--withDiff` option on
the generator, consistent with `--withLint`/`--withMock`), that diffs the working copy of the spec against
a previous committed version using [`oasdiff`](https://github.com/oasdiff/oasdiff) (or `openapi-diff`) and
fails the target if breaking changes are found.

- Options: `baseRef` (git ref to diff against — e.g. `main`, a tag, or `HEAD` for staged-vs-working-tree;
  default likely the workspace's configured base branch), `failOnBreaking` (default `true`),
  `format` (`text`/`json`/`markdown` — markdown is useful for posting as a PR comment in CI).
- Implementation shape: `git show <baseRef>:<specPathRelativeToRepoRoot>` to materialize the "before" spec
  into a temp file (reusing the scratch-dir pattern the executor layer already uses via
  `delete-output-dir.ts`-adjacent utils), then shell out to the diff tool between that and the current
  file — same `cross-spawn` + stdout/stderr streaming pattern as `generate-api-lib-sources`.
- Primarily a CI-facing target: `nx affected -t diff-spec --base=main` (or wired into the PR workflow
  directly) as a required check, catching breaking spec changes before merge rather than after a consumer
  regenerates and finds out the hard way.

## Sketch

```sh
nx generate @istomerf/nx-plugin-openapi:api-spec my-service-api-spec --withDiff
nx run my-service-api-spec:diff-spec --baseRef=main
```

```jsonc
// project.json on the api-spec lib
"diff-spec": {
  "executor": "@istomerf/nx-plugin-openapi:diff-openapi-spec",
  "options": {
    "sourceSpecPath": "src/my-service-api-spec.openapi.yml",
    "baseRef": "main",
    "failOnBreaking": true
  }
}
```

## Open questions / risks

- **What counts as "base"**: for a monorepo where multiple consumers evolve alongside the spec, is
  diffing against `main` always right, or should it be the merge-base of the current branch (avoids false
  positives from unrelated commits already on `main`)?
- **Intentional breaking changes**: need an escape hatch (e.g. `failOnBreaking: false` for a one-off run,
  or a documented way to acknowledge/suppress a specific breaking change) for deliberate v2-style bumps —
  otherwise this becomes a check people learn to route around instead of trust.
- **Tool choice**: `oasdiff` vs `openapi-diff` vs writing a thin wrapper around Spectral's own diff — worth
  a short spike to confirm which gives the clearest breaking-vs-non-breaking classification and best
  supports the OpenAPI versions this plugin targets.
- **Relationship to spec-lint**: this is a natural CI companion to [[spec-lint]] — one gate for "is the
  spec well-formed," another for "did it change safely." Worth documenting them together in the README
  once both exist, even though they ship as separate targets/executors.
