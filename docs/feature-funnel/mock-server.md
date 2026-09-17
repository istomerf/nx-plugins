# Feature sketch: mock server target for `api-spec` libs

## Problem

Consumers of an API (frontend/mobile teams, or anyone building against a contract) often need to develop
against it before the real backend exists, or want a fast local stand-in instead of hitting a real service.
Nothing in the plugin serves a spec as a live mock today — you get a spec file and a generated client, but
no runnable server.

## Proposal

A new `--withMock` option on the `api-spec` generator (mirrored on `init`) that registers a `mock` target
on the spec lib, backed by a new `serve-openapi-mock` executor built on
[Stoplight Prism](https://github.com/stoplightio/prism) (`@stoplight/prism-cli mock`).

- `continuous: true` executor — long-running dev server, same category as `nx serve`.
- Options: `port` (default `4010`), `host`, `dynamic` (Prism's `--dynamic`, generates responses from the
  schema instead of requiring static `example`s), `errors` (Prism's `--errors`, strict request validation
  against the spec).
- `useDockerBuild`, mirroring the existing toggle on `generate-api-lib-sources` — teams already comfortable
  with that pattern for codegen get the same escape hatch for the mock server (`stoplight/prism` image)
  instead of needing Node tooling locally.
- Optional `watchSpec` flag that reuses the shared spec-file-watcher from [[watch-mode]] to restart Prism
  automatically when the spec changes — editing the contract and hitting the mock becomes a tight loop.

Attaches to the **`api-spec` lib**, not `api-lib` — mocking only needs the raw spec, not generated code,
and should work regardless of which (if any) client preset is configured. Doesn't apply to remote specs:
if `isRemoteSpec` is set, a real API presumably already exists at that URL, so there's nothing to mock.

## Sketch

```sh
nx generate @istomerf/nx-plugin-openapi:api-spec my-service-api-spec --withMock
nx run my-service-api-spec:mock
```

```jsonc
// project.json on the api-spec lib
"mock": {
  "executor": "@istomerf/nx-plugin-openapi:serve-openapi-mock",
  "options": {
    "sourceSpecPath": "src/my-service-api-spec.openapi.yml",
    "port": 4010
  },
  "continuous": true
}
```

## Open questions / risks

- **Mock quality depends on spec richness**: Prism needs `example`/`examples` on schemas (or `--dynamic`)
  to return sensible payloads. Should `--withSample` seed richer examples so the mock is useful out of the
  box, not just empty/placeholder responses?
- **Auth is not mocked**: Prism doesn't validate or simulate auth by default — protected and public
  endpoints behave identically. Worth a README callout so users don't assume auth-gated behavior is real.
- **Port collisions**: multiple `api-spec` libs with `--withMock` in the same workspace need non-colliding
  default ports — consider erroring clearly (or auto-incrementing) rather than a silent bind failure.
- **Docker parity**: confirm the `stoplight/prism` image's CLI flags line up with `@stoplight/prism-cli`
  closely enough to share one options-to-args mapping, the way `generate-api-lib-sources` does today.
