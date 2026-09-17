# Feature sketch: spec-lint target for `api-spec` libs

## Problem

When a spec has structural problems (bad `$ref`s, missing required fields for the target generator,
plain invalid OpenAPI), the first thing a user sees today is an opaque failure from
`openapi-generator-cli` deep inside `generate-sources` — not a readable "here's what's wrong with your
spec" error. Nothing validates the spec on its own before codegen runs against it.

## Proposal

A new `--withLint` option on the `api-spec` generator, registering a `lint-spec` target (deliberately not
named `lint`, to avoid colliding with a workspace's own ESLint target on the same project) backed by a new
`lint-openapi-spec` executor wrapping [Spectral](https://github.com/stoplightio/spectral)
(`@stoplight/spectral-cli lint`).

- Options: `rulesetPath` (custom Spectral ruleset; defaults to Spectral's built-in `oas` ruleset if unset),
  `failSeverity` (default `error`, matching Spectral's own flag), `format` (`stylish`/`json`/etc.).
- One-shot executor (not continuous) — runs, reports, exits non-zero on violations at or above
  `failSeverity`.
- `api-lib`'s `generate-sources` target, when pointed at a local spec lib with a `lint-spec` target, gets
  that target added to its `dependsOn` — so `nx run api-client:generate-sources` validates the spec first
  automatically, surfacing a readable lint error instead of a raw generator crash. Remote specs
  (`isRemoteSpec`) skip this since there's no local target to depend on.
- Also directly useful in CI on its own: `nx affected -t lint-spec` as a fast, generator-independent PR
  check.

## Sketch

```sh
nx generate @istomerf/nx-plugin-openapi:api-spec my-service-api-spec --withLint
nx run my-service-api-spec:lint-spec
```

```jsonc
// project.json on the api-spec lib
"lint-spec": {
  "executor": "@istomerf/nx-plugin-openapi:lint-openapi-spec",
  "options": {
    "sourceSpecPath": "src/my-service-api-spec.openapi.yml",
    "failSeverity": "error"
  }
}
```

```jsonc
// project.json on the paired api-lib, generator-added dependsOn
"generate-sources": {
  "executor": "@istomerf/nx-plugin-openapi:generate-api-lib-sources",
  "options": { /* ... */ },
  "dependsOn": ["^lint-spec"]
}
```

## Open questions / risks

- **Default ruleset choice**: Spectral's built-in `oas` ruleset is fairly permissive (mostly style/best-
  practice, not "will this break the generator"). May want a plugin-authored ruleset tuned to catch the
  specific things known to break `openapi-generator-cli`, distinct from general spec style linting.
- **Existing invalid specs**: turning `--withLint` on by default for `init`/`api-spec` could break existing
  workspaces with specs that don't pass lint today — should default to `false` and be opt-in, at least
  initially.
- **Relationship to breaking-change detection**: this checks a spec is *well-formed*; [[breaking-change-
  detection]] checks it hasn't *changed dangerously* since last committed. Both are "spec quality gates"
  and could eventually share a CI-facing doc/target naming convention, but are independently useful.
