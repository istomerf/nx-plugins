# OpenAPI Plugin for Nx

[![npm version](https://img.shields.io/npm/v/@istomerf/nx-plugin-openapi.svg)](https://www.npmjs.com/package/@istomerf/nx-plugin-openapi)
[![License](https://img.shields.io/npm/l/@istomerf/nx-plugin-openapi.svg)](https://www.npmjs.com/package/@istomerf/nx-plugin-openapi)

Keep your OpenAPI spec files in Nx libs, and auto-generate SDK/docs libs from them.

## 🧐 What is it?

A plugin for organizing OpenAPI spec files in libraries. You get one lib holding the spec file, and one (or more) other libs that generate an SDK, server stub, or docs from it — all wired up as regular Nx targets so the generation step fits into your normal build/CI pipeline.

Source generation itself is delegated to [`openapi-generator-cli`](https://github.com/OpenAPITools/openapi-generator-cli), so this plugin supports any generator that tool supports (TypeScript clients, Java, Go, HTML docs, server stubs, ...).

## 💡 How to install

```sh
npm install -D @istomerf/nx-plugin-openapi
```

(or `pnpm add -D` / `yarn add -D`)

### Prerequisites

- An Nx workspace using `@nx/workspace` >= 20 and < 24.
- **Java 8+** installed locally, since `openapi-generator-cli` runs as a Java process by default — **or** **Docker**, if you'd rather run the generator in a container (see `useDockerBuild` below) instead of installing Java.

Installing the plugin automatically adds `@openapitools/openapi-generator-cli` as a dev dependency the first time you run one of its generators (via the `init` generator — see below).

## 🧰 Usage

### Quick start: bootstrap out of the box

The fastest way to get going is `init`, which scaffolds a working `api-spec` lib and `api-lib` in one shot, already wired together:

```sh
nx generate @istomerf/nx-plugin-openapi:init
```

```
UPDATE package.json
UPDATE nx.json
CREATE libs/api-spec/src/api-spec.openapi.yml
CREATE libs/api-client/README.md
UPDATE tsconfig.base.json
```

Then generate the client sources:

```sh
nx run api-client:generate-sources
```

That's it — `libs/api-client` now has a real generated TypeScript client for the sample spec, importable as `@<npmScope>/api-client`. Swap `libs/api-spec/src/api-spec.openapi.yml` for your own spec and re-run `generate-sources` whenever it changes.

`init` accepts the same `client` (`custom`/`angular`/`react`/`vue`/`node`) and `useDockerBuild` options as `api-lib` (see [Client presets](#client-presets)), plus `apiSpecName`/`apiLibName` to bootstrap under different project names:

```sh
nx generate @istomerf/nx-plugin-openapi:init --client=react --apiSpecName=petstore-spec --apiLibName=petstore-client
```

If a project named `apiSpecName` or `apiLibName` already exists, `init` skips scaffolding (logging a warning) rather than overwriting it — safe to re-run. Pass `--skipBootstrap` to only ensure `@openapitools/openapi-generator-cli` is installed, without creating any libs.

### Building it up manually

If you'd rather add libs one at a time — e.g. to point multiple `api-lib`s at the same spec, or fully control naming and directories — use `api-spec` and `api-lib` directly instead of `init`:

#### 1. Create a lib for an API spec file

```sh
nx generate @istomerf/nx-plugin-openapi:api-spec my-service-api-spec --withSample
```

```
CREATE libs/my-service-api-spec/src/my-service-api-spec.openapi.yml
UPDATE nx.json
```

Drop your own `.yml`/`.json` OpenAPI spec into that lib (replacing the sample spec if you scaffolded one with `--withSample`). `--withSample` seeds the lib with a complete example spec — `servers`, full CRUD `paths`, and `components.schemas` with typed attributes — so you can see exactly what feeds the `api-lib` generator below (`paths` become SDK methods, `schemas` become generated models/interfaces, `servers` becomes the client's default base URL).

#### 2. Create a lib that generates an SDK from it

```sh
nx generate @istomerf/nx-plugin-openapi:api-lib my-service-api-client \
  --client=react \
  --sourceSpecLib=my-service-api-spec \
  --sourceSpecFileRelativePath=src/my-service-api-spec.openapi.yml
```

```
UPDATE nx.json
CREATE libs/my-service-api-client/README.md
UPDATE tsconfig.base.json
```

This registers a `generate-sources` target on the new project, pointed at the spec lib you created in step 1, and adds a `@myorg/my-service-api-client` path mapping to `tsconfig.base.json` so the (not-yet-generated) sources are importable right away.

#### 3. Generate (or regenerate) the sources

```sh
nx run my-service-api-client:generate-sources
```

Run this again whenever the spec file changes — locally, or as a step in CI (e.g. wired up via `dependsOn` on the consuming project's `build` target, or as its own scheduled/CI job). It's not run automatically on every build.

### Using a remote spec instead

You don't need a local `api-spec` lib — point `api-lib` at a URL instead:

```sh
nx generate @istomerf/nx-plugin-openapi:api-lib my-service-api-client \
  --client=react \
  --isRemoteSpec \
  --sourceSpecUrl=https://petstore.swagger.io/v2/swagger.json
```

Add `--sourceSpecUrlAuthorizationHeaders` if the spec endpoint needs auth — a URL-encoded `name:value` string, comma-separated for multiple headers, e.g. `--sourceSpecUrlAuthorizationHeaders="Authorization:Bearer%20some-token"`.

## ✍️ Generators

### `init`

Bootstraps a working `api-spec` + `api-lib` pair in one shot (see [Quick start](#quick-start-bootstrap-out-of-the-box)), and ensures `@openapitools/openapi-generator-cli` is a dev dependency. Also invoked internally by `api-spec`/`api-lib` (with `skipBootstrap: true`) to keep that dependency present — you don't need to run it yourself just for that.

| Option           | Description                                                                                     | Default     |
| ------------------ | --------------------------------------------------------------------------------------------------- | :-----------: |
| `apiSpecName`     | Name of the sample `api-spec` lib to bootstrap                                                     | `api-spec`  |
| `apiLibName`      | Name of the sample `api-lib` to bootstrap                                                          | `api-client` |
| `client`          | Framework preset for the bootstrapped `api-lib` — see [Client presets](#client-presets)             | `custom`    |
| `useDockerBuild`  | Have the bootstrapped `api-lib` run the generator via Docker instead of `npx`                       | `false`     |
| `skipBootstrap`   | Only ensure `@openapitools/openapi-generator-cli` is installed, without scaffolding any libs         | `false`     |
| `skipFormat`      | Skip running Prettier on generated files                                                            | `false`     |

If a project named `apiSpecName` or `apiLibName` already exists, bootstrapping is skipped (with a warning) instead of touching that project.

### `api-spec`

Scaffolds a lib that just holds an OpenAPI spec file.

| Option        | Alias | Description                                     | Default |
| -------------- | :---: | ------------------------------------------------ | :-----: |
| `name`         |       | Project name (required)                          |         |
| `directory`    | `-d`  | Directory to place the project in                |         |
| `tags`         | `-t`  | Comma-separated Nx tags (for lint boundaries)     |         |
| `withSample`   |       | Seed the lib with a complete sample spec file (servers, CRUD paths, models)  | `false` |
| `skipFormat`   |       | Skip running Prettier on generated files          | `false` |

### `api-lib`

Scaffolds a lib whose `generate-sources` target runs `openapi-generator-cli` against a spec.

| Option                              | Alias | Description                                                                                    |    Default    |
| ------------------------------------ | :---: | ------------------------------------------------------------------------------------------------ | :------------: |
| `name`                               |       | Project name (required)                                                                          |               |
| `directory`                          | `-d`  | Directory to place the project in                                                                |               |
| `tags`                               | `-t`  | Comma-separated Nx tags (for lint boundaries)                                                    |               |
| `importPath`                         |       | Import path for the lib, e.g. `@myorg/my-lib`                                                     | `@<npmScope>/<dir>` |
| `client`                             |       | Framework preset: `custom`, `angular`, `react`, `vue`, `node` — see [Client presets](#client-presets) |    `custom`    |
| `generator`                          | `-g`  | An `openapi-generator-cli` generator name (e.g. `typescript-fetch`). Overrides the generator implied by `client` |  see below   |
| `isRemoteSpec`                       | `-r`  | The spec file lives at a URL rather than in a workspace lib                                       |    `false`    |
| `sourceSpecUrl`                      | `-u`  | URL of the remote spec file (when `isRemoteSpec`)                                                |               |
| `sourceSpecUrlAuthorizationHeaders`  | `-a`  | URL-encoded `name:value` auth headers for the remote spec, comma-separated                       |               |
| `sourceSpecLib`                      | `-l`  | Name of the workspace lib containing the spec file (when not `isRemoteSpec`)                     |               |
| `sourceSpecFileRelativePath`         | `-f`  | Path to the spec file, relative to the `sourceSpecLib` project root                               |               |
| `additionalProperties`               |       | Generator `--additional-properties`, comma-separated `key=value` pairs — merged over (and overriding) any preset defaults | |
| `globalProperties`                   |       | Generator `--global-property`, comma-separated `key=value` pairs                                 |               |
| `useDockerBuild`                     |       | Run the generator via `docker run openapitools/openapi-generator-cli` instead of `npx` — no local Java needed, but Docker is | `false` |
| `skipFormat`                         |       | Skip running Prettier on generated files                                                         |    `false`    |

If neither `client` nor `generator` is set, the generator defaults to `typescript-fetch`.

#### Client presets

`client` pre-selects a generator and sensible `additionalProperties` for a target framework, so you don't have to look them up yourself:

| `client`   | Generator            | Default `additionalProperties`                          |
| ---------- | --------------------- | --------------------------------------------------------- |
| `angular`  | `typescript-angular`  | `ngVersion=17.0.0,providedInRoot=true`                     |
| `react`    | `typescript-fetch`    | `supportsES6=true,withInterfaces=true`                     |
| `vue`      | `typescript-axios`    | `supportsES6=true,withSeparateModelsAndApi=true`           |
| `node`     | `typescript-node`     | `supportsES6=true`                                         |
| `custom`   | *(none — set `generator` yourself)* |                                              |

Any `additionalProperties` you pass explicitly are merged on top of the preset's — matching keys override the preset value, everything else from the preset is kept. Passing `--generator` always overrides the generator implied by `client`, even if `client` is also set.

Note: `client`/preset support is currently limited to Nx v20+ workspaces using `tsconfig.base.json` path mappings (the same constraint the generator relies on for wiring up imports).

## ⚙️ `generate-api-lib-sources` executor

This is the executor behind every `generate-sources` target that `api-lib` creates. You normally configure it through the `api-lib` generator's prompts/flags rather than by hand, but its full option set is available if you want to tweak a project's `generate-sources` target directly (e.g. in `project.json`):

| Option                              | Description                                                                 |     Default      |
| ------------------------------------ | ------------------------------------------------------------------------------ | :---------------: |
| `sourceSpecPathOrUrl`                | Path (relative to the workspace root) or URL of the source spec file            |                   |
| `outputDir`                         | Where the generated sources are written; **fully deleted and recreated** on every run |                   |
| `generator`                          | The `openapi-generator-cli` generator to use                                    | `typescript-angular` |
| `additionalProperties`               | `--additional-properties`, comma-separated `key=value` pairs                     |                   |
| `globalProperties`                   | `--global-property`, comma-separated `key=value` pairs                          |                   |
| `typeMappings`                       | `--type-mappings`, e.g. to map `DateTime` to `Date`                              |                   |
| `sourceSpecUrlAuthorizationHeaders`  | `--auth` value for remote specs                                                 |                   |
| `ignoreList`                         | Entries to pre-populate `.openapi-generator-ignore` with                        |                   |
| `useDockerBuild`                     | Run via Docker instead of `npx openapi-generator-cli`                           |      `false`      |
| `silent`                             | Suppress the generator's stdout/stderr                                          |      `false`      |

Every run **deletes `outputDir` first**, then invokes the generator — so treat that directory as fully derived output, never commit hand-written files into it.

### Docker build mode

With `useDockerBuild: true`, the executor shells out to `docker run openapitools/openapi-generator-cli` instead of `npx openapi-generator-cli`, mounting your current working directory into the container. This means:

- You don't need Java installed locally — only Docker.
- Run `generate-sources` from the workspace root (or wherever your paths are expected to resolve from), since that's the directory that gets mounted.

## Supported generators

This plugin supports any generator `openapi-generator-cli` supports. Browse the full list, along with every generator's own `additionalProperties`, here: https://openapi-generator.tech/docs/generators

Global properties (spec validation, model/api generation toggles, etc.) are documented here: https://openapi-generator.tech/docs/globals

## 🙏 Acknowledgements

Many thanks to every project and every person taken inspiration from, but especially:

- [@vsavkin](https://github.com/vsavkin) for [@nrwl/react](https://github.com/nrwl/nx/tree/master/packages/react)
- [@ericwooley](https://github.com/ericwooley) for [his own @ericwooley/openapi-sdk](https://github.com/ericwooley/openapi-sdk)
- [@tinesoft](https://github.com/tinesoft) for inspiring a first spin at Nx plugin development with the release of their [@nxrocks/nx-spring-boot](https://github.com/tinesoft/nxrocks)
