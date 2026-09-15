# nx-plugins

[![npm version](https://img.shields.io/npm/v/@istomerf/nx-plugin-openapi.svg)](https://www.npmjs.com/package/@istomerf/nx-plugin-openapi)

This monorepo publishes [`@istomerf/nx-plugin-openapi`](./packages/nx-plugin-openapi) — an Nx plugin for keeping OpenAPI spec files in Nx libs and auto-generating SDK/docs libs from them via [`openapi-generator-cli`](https://github.com/OpenAPITools/openapi-generator-cli).

```sh
npm install -D @istomerf/nx-plugin-openapi
nx generate @istomerf/nx-plugin-openapi:init
```

`init` bootstraps a working `api-spec` + `api-lib` pair out of the box — run `nx run api-client:generate-sources` right after and you have a real generated TypeScript client.

See **[packages/nx-plugin-openapi/README.md](./packages/nx-plugin-openapi/README.md)** for full usage docs: generators, options, client presets, and the `generate-sources` executor.

## Repository layout

- `packages/nx-plugin-openapi` — the plugin's source, generators, and executor.
- `packages/nx-plugin-openapi-e2e` — end-to-end tests that scaffold a real Nx workspace and exercise the published plugin against it.

## Contributing

This is a standard Nx + pnpm workspace. See [CLAUDE.md](./CLAUDE.md) for the commands used to build, test, lint, and run e2e tests.
