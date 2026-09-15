# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

An Nx monorepo (pnpm workspaces) that publishes a single Nx plugin, `nx-plugin-openapi` — lets consumers keep OpenAPI spec files in Nx libs and auto-generate SDK/docs libs from them via `openapi-generator-cli`. Published as `@istomerf/nx-plugin-openapi` (note: internal generator/executor references, e2e tests, and `tsconfig.base.json` path mappings still use the legacy scope `@driimus/nx-plugin-openapi` — this is a known inconsistency, not a bug to silently "fix" mid-task).

Package manager is **pnpm** — use `pnpm`, not `npm`/`yarn`, for all installs and scripts. Node version is pinned in `.node-version` (`lts/krypton`).

## Commands

Run everything through Nx from the repo root.

```sh
pnpm i                                   # install deps

pnpm nx build nx-plugin-openapi          # build the plugin
pnpm nx test nx-plugin-openapi           # unit tests (Jest)
pnpm nx test nx-plugin-openapi --testFile=generator.spec.ts   # single test file
pnpm nx lint nx-plugin-openapi           # eslint

pnpm nx e2e nx-plugin-openapi-e2e        # full e2e suite (see below — slow)

pnpm nx affected:test                    # what CI runs on PRs
pnpm nx affected:e2e

pnpm nx run-many -t build                # what CI runs before release
```

There's no root-level test/build script in `package.json` — always go through `nx <target> <project>` or `nx run-many`/`nx affected`.

### e2e tests

`nx-plugin-openapi-e2e` (`packages/nx-plugin-openapi-e2e/tests/happy-path.spec.ts`) is a real end-to-end run, not mocked:

1. Jest `globalSetup` (`tools/scripts/start-local-registry.ts`) starts a local Verdaccio registry (`nx run root:local-registry`, port 4873, storage in `tmp/local-registry`), then `nx release`-publishes the plugin under the `e2e` dist-tag.
2. Each test scaffolds a throwaway Nx workspace under `tmp/nx-e2e/proj` via `create-nx-workspace`, installs the plugin from the local registry, then runs the plugin's generators/executor against it (including a Docker-build variant and a remote-spec variant).
3. `globalTeardown` stops the registry.

This needs network access (npm registry for scaffolding) and Docker for the docker-build case. Expect it to take minutes, not seconds.

## Architecture

Everything lives under `packages/nx-plugin-openapi/src/`, split into **generators** (scaffold workspace files/config) and one **executor** (does the actual codegen at build time):

- `generators/init` — hidden bootstrap generator; invoked internally by the other generators, not called directly by users.
- `generators/api-spec` — scaffolds a lib containing an OpenAPI spec file (optionally seeded from `files/src/__name__.openapi.yml__tmpl__`).
- `generators/api-lib` — scaffolds a lib configured to generate SDK/doc sources from an OpenAPI spec (local, i.e. from a `sourceSpecLib` in the same workspace, or remote via URL). It registers a `generate-sources` target on the new project wired to the `generate-api-lib-sources` executor, and updates `tsconfig.base.json` path mappings.
- `executors/generate-api-lib-sources` — the executor that `generate-sources` targets run. Deletes the project's output dir, then shells out to `openapi-generator-cli` (via `npx` normally, or via `docker run openapitools/openapi-generator-cli` when `useDockerBuild` is set), building CLI args from the executor schema (`generator`, `additionalProperties`, `globalProperties`, `typeMappings`, auth headers, ignore list, etc).

Generator/executor entry points are registered in `generators.json` / `executors.json` at the package root — schema shape for each lives alongside its `generator.ts`/`executor.ts` as `schema.json` (+ generated `schema.d.ts`).

`packages/nx-plugin-openapi/src/test/mockSpawn.ts` is the shared helper for stubbing `cross-spawn` in executor/generator unit tests instead of actually invoking `openapi-generator-cli`.

## Conventions

- Commit messages are enforced as Conventional Commits via commitlint (`commitlint.config.js`) through a Husky `commit-msg` hook — non-conforming commit messages will be rejected locally.
- Releases (`nx release`) use conventional-commits-based versioning and run automatically in `.github/workflows/publish.yml` on push to `main`; don't hand-bump versions in package.json.
- New/changed lib import paths go through `tsconfig.base.json`'s `compilerOptions.paths` — the `api-lib` generator manages this automatically for generated libs, but check it if you touch path aliasing by hand.
