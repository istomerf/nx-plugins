# Changelog

All notable changes to `@istomerf/nx-plugin-openapi` are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- `init` generator now bootstraps a working `api-spec` + `api-lib` pair out of the box (a sample OpenAPI spec plus a generated client wired up to it), instead of only installing `openapi-generator-cli`. New options: `apiSpecName`, `apiLibName`, `client`, `useDockerBuild`, `skipBootstrap`, `skipFormat`.
- `init` skips bootstrapping (with a warning) if a project named `apiSpecName`/`apiLibName` already exists, so it's safe to re-run.
- Root `README.md` with quick-start install/usage instructions and repository layout.

### Changed

- `init` generator is no longer `hidden` in `generators.json` — it can now be run directly by users, not just internally by `api-spec`/`api-lib`.
- `api-spec` and `api-lib` generators now call `init` with `skipBootstrap: true` so they don't trigger the new sample-scaffolding behavior when `init` runs as their internal dependency.
- Renamed the `init` generator's schema type from `InitGeneratorOptions` to `InitGeneratorSchema` and added the new option fields.
- Bumped the default `openapi-generator-cli` version pinned in `versions.ts` from `2.3.7` to `2.41.0`.
- Rewrote `packages/nx-plugin-openapi/README.md` to document the `init` bootstrap flow, client presets, and the manual step-by-step (`api-spec` + `api-lib`) usage path.
- Refreshed the sample OpenAPI spec template used by `api-spec --withSample` with a fuller example (`servers`, CRUD `paths`, typed `components.schemas`).

### Removed

- Deleted `tools/scripts/start-local-registry.ts` and `tools/scripts/stop-local-registry.ts`, the local Verdaccio registry bootstrap/teardown scripts used by the e2e suite's Jest `globalSetup`/`globalTeardown`.
