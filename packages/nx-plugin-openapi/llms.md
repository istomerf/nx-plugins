# llms.md — agent instructions for `@istomerf/nx-plugin-openapi`

Operational reference for an AI coding agent using this Nx plugin inside a consumer workspace. For human-facing docs (install, rationale, examples) see `README.md` — this file is a decision-oriented cheat sheet: what to run, what each option does, and what breaks if you get it wrong.

## What this plugin does

Keeps an OpenAPI spec in one Nx lib (`api-spec`) and generates SDK/docs/server-stub source into another lib (`api-lib`) via `openapi-generator-cli`. Generation is a `generate-sources` target the agent must run explicitly — it is never wired into `build` automatically.

Three generators, one executor:

| Name | Kind | Purpose |
|---|---|---|
| `init` | generator | Bootstraps a working `api-spec` + `api-lib` pair in one shot. Also runs internally (with `skipBootstrap: true`) whenever `api-spec` or `api-lib` run standalone, to ensure `@openapitools/openapi-generator-cli` is a dev dependency. |
| `api-spec` | generator | Scaffolds a lib holding just an OpenAPI spec file. |
| `api-lib` | generator | Scaffolds a lib with a `generate-sources` target wired to a spec (local or remote) + registers a `tsconfig.base.json` path mapping. |
| `generate-api-lib-sources` | executor | Runs `openapi-generator-cli generate` (via `npx` or `docker`). Deletes `outputDir` first, every run. |

## Decision: which path to take

- **Consumer has no existing OpenAPI setup, just wants a working client fast** → run `init`. Do not hand-roll `api-spec` + `api-lib` calls for this case.
- **Consumer wants multiple `api-lib`s off one spec, custom naming/directories, or already has one half of the pair** → call `api-spec` and `api-lib` directly. `init` will skip scaffolding (with a warning, not an error) if a project named `apiSpecName`/`apiLibName` already exists — safe to call unconditionally as a guard, but prefer being explicit.
- **Spec lives at a URL, not in this workspace** → `api-lib` with `isRemoteSpec: true` + `sourceSpecUrl`. No `api-spec` lib needed.
- **Only need the `openapi-generator-cli` dev dependency present (no scaffolding)** → `init` with `skipBootstrap: true`.

## Commands

```sh
# One-shot bootstrap (creates api-spec + api-lib, wires them together)
nx generate @istomerf/nx-plugin-openapi:init [--client=<preset>] [--apiSpecName=x] [--apiLibName=y] [--useDockerBuild] [--skipBootstrap] [--skipFormat]

# Spec-only lib
nx generate @istomerf/nx-plugin-openapi:api-spec <name> [-d dir] [-t tags] [--withSample] [--skipFormat]

# SDK/docs lib from a local spec
nx generate @istomerf/nx-plugin-openapi:api-lib <name> -g <generator> -l <sourceSpecLib> -f <path/to/spec.yml> [-d dir] [-t tags] [--importPath] [--additionalProperties] [--globalProperties] [--useDockerBuild] [--skipFormat]

# SDK/docs lib from a remote spec
nx generate @istomerf/nx-plugin-openapi:api-lib <name> -g <generator> -r -u <specUrl> [-a "Header:value"] ...

# Actually generate/regenerate sources — never run automatically, run it explicitly after scaffolding or spec changes
nx run <api-lib-name>:generate-sources
```

`init`, `api-spec`, and `api-lib` are all Nx generators — they mutate the workspace Tree and must be run via `nx generate`, not invoked as plain functions outside an Nx generator context (except in this repo's own unit tests, which call the generator functions directly against an in-memory Tree — see `src/test/mockSpawn.ts` and the various `*.spec.ts` files for the pattern).

## `init` — options and behavior

| Option | Default | Notes |
|---|---|---|
| `apiSpecName` | `api-spec` | |
| `apiLibName` | `api-client` | |
| `client` | `custom` | `custom \| angular \| react \| vue \| node` — see preset table below. Only affects the *bootstrapped* `api-lib`; irrelevant if you call `api-lib` directly (pass `generator`/`additionalProperties` yourself there). |
| `useDockerBuild` | `false` | Passed straight through to the bootstrapped `api-lib`. |
| `skipBootstrap` | `false` | `true` → only ensures the `openapi-generator-cli` dev dependency, scaffolds nothing. This is exactly what `api-spec`/`api-lib` pass when they call `init` internally. |
| `skipFormat` | `false` | |

If a project already exists at `apiSpecName` or `apiLibName`, bootstrap is **skipped with a `logger.warn`, not thrown** — safe to call `init` speculatively, but check the log output rather than assuming scaffolding happened.

### Client presets (`client` option, resolved in `src/generators/init/client-presets.ts`)

| `client` | `generator` | `additionalProperties` |
|---|---|---|
| `angular` | `typescript-angular` | `ngVersion=17.0.0,providedInRoot=true` |
| `react` | `typescript-axios` | `supportsES6=true,withInterfaces=true` |
| `vue` | `typescript-fetch` | `supportsES6=true,withSeparateModelsAndApi=true` |
| `node` | `typescript-node` | `supportsES6=true` |
| `custom` / unset | `typescript-fetch` | *(none)* |

This mapping is intentional (by design), not a typo — treat `client-presets.ts` as the source of truth if any other doc in this repo appears to disagree with it. Preset resolution assumes an Nx v20+ workspace using `tsconfig.base.json` path mappings.

## `api-spec` — options

| Option | Alias | Default | Notes |
|---|---|---|---|
| `name` | — | *(required)* | Positional arg 0. |
| `directory` | `-d` | | |
| `tags` | `-t` | | Comma-separated, used for Nx lint boundaries. |
| `withSample` | | `false` | Seeds a full example spec (servers/paths/schemas) at `src/<name>.openapi.yml`. Without it, only a `.gitkeep` is written — the agent (or user) must add the real spec file itself. |
| `skipFormat` | | `false` | |

## `api-lib` — options

| Option | Alias | Notes |
|---|---|---|
| `name` | — | *(required, positional arg 0)* |
| `generator` | `-g` | *(required, no default)* — an `openapi-generator-cli` generator name, e.g. `typescript-fetch`. Must always be passed explicitly unless going through `init`'s `client` preset. |
| `directory` | `-d` | |
| `tags` | `-t` | |
| `importPath` | | Defaults to `@<npmScope>/<projectDirectory>`. Generator throws if the path is already claimed by another `tsconfig.base.json` path entry — surface that error rather than silently overwriting. |
| `isRemoteSpec` | `-r` | Default `false`. |
| `sourceSpecUrl` | `-u` | Required when `isRemoteSpec: true`. |
| `sourceSpecUrlAuthorizationHeaders` | `-a` | URL-encoded `name:value`, comma-separated for multiple. Only used when remote. |
| `sourceSpecLib` | `-l` | Required when *not* remote — name of the workspace lib holding the spec. |
| `sourceSpecFileRelativePath` | `-f` | Required when *not* remote — path to the spec file relative to `sourceSpecLib`'s project root, e.g. `src/api-spec.openapi.yml`. |
| `additionalProperties` | | `--additional-properties` passthrough, comma-separated `key=value`. |
| `globalProperties` | | `--global-property` passthrough, comma-separated `key=value`. |
| `useDockerBuild` | | Default `false`. |
| `skipFormat` | | Default `false`. |

Side effects beyond the target project itself:
- When `isRemoteSpec: false` and `sourceSpecLib` is set, the new project's `implicitDependencies` includes `sourceSpecLib` — don't duplicate that with a manual `dependsOn`.
- `tsconfig.base.json` gets a new `compilerOptions.paths[importPath]` entry pointing at `<projectRoot>/src/index.ts`.
- The `generate-sources` target is registered with the `@istomerf/nx-plugin-openapi:generate-api-lib-sources` executor; `outputDir` is fixed to `<projectRoot>/openapi-generated-sources` — not configurable via `api-lib` options (edit `project.json` directly if a different path is truly needed).

## `generate-api-lib-sources` executor — options

Normally set by `api-lib`, but relevant when hand-editing a `project.json` target or debugging a failed run:

| Option | Default | Notes |
|---|---|---|
| `sourceSpecPathOrUrl` | — | Workspace-root-relative path, or a URL. |
| `outputDir` | — | **Deleted and recreated on every run.** Never hand-write files here. |
| `generator` | `typescript-angular` | Only relevant if omitted by hand — `api-lib` always sets this explicitly. |
| `additionalProperties` / `globalProperties` / `typeMappings` | — | Comma-separated `key=value` passthroughs to the CLI. |
| `sourceSpecUrlAuthorizationHeaders` | — | Maps to `--auth`. |
| `ignoreList` | — | String array, joined and passed as `--openapi-generator-ignore-list`. |
| `useDockerBuild` | `false` | Swaps `npx openapi-generator-cli` for `docker run openapitools/openapi-generator-cli`, mounting CWD at `/local`. **Run `nx run <lib>:generate-sources` from the workspace root** in this mode — relative paths resolve against the mounted directory. |
| `silent` | `false` | Suppresses stdout/stderr from the spawned process — turn off when debugging a failed generation. |

Exit behavior: non-zero exit from the underlying CLI process rejects the executor promise (surfaces as a failed Nx task) — don't treat "task failed" as ambiguous, check the streamed `[stderr]:` lines in the log for the actual `openapi-generator-cli` error.

## Preconditions to check before running any of this

- Java 8+ on PATH (for the default `npx` path) **or** Docker running (for `useDockerBuild: true`). If neither is available, generation will fail at the spawn step with a clear command-not-found — don't waste turns retrying the same generator invocation.
- Nx workspace using `@nx/workspace` >= 20 and < 24. `client` presets additionally assume `tsconfig.base.json` exists.
- If scaffolding into an existing project name, expect `init` to no-op with a warning rather than fail — check for the warning in generator output, not just exit code, to know whether scaffolding actually happened.

## Common agent mistakes to avoid

- Forgetting to run `nx run <lib>:generate-sources` after `api-lib`/`init` scaffolding — the lib exists but has no generated sources yet, and any import from it will fail to resolve until this runs.
- Re-running `generate-sources` and being surprised that hand edits inside `outputDir` vanished — that directory is fully derived, wiped every run by design.
- Passing `--client` to `api-lib` directly — it's an `init`-only option; `api-lib` takes `--generator`/`--additionalProperties` directly instead.
- Omitting `-g/--generator` on `api-lib` — there's no default, the generator call will fail its schema validation immediately.
- Using `useDockerBuild` while running `generate-sources` from somewhere other than the workspace root — paths won't resolve inside the container mount.
