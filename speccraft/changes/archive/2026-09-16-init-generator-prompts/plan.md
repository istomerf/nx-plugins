## GOAL
`nx generate @istomerf/nx-plugin-openapi:init` currently has no `x-prompt` entries in its schema, so running it interactively silently applies every default (apiSpecName `api-spec`, apiLibName `api-client`, client `custom`, useDockerBuild `false`) with zero visibility into what's being set up. Add `x-prompt`s (pre-filled with the existing defaults) to the init generator's schema so a user running the bare command is walked through the bootstrap options and can accept every default with Enter, or override any of them, to get a working api-spec/api-lib pair fast. No new options, no behavior change to the generator itself — only interactive visibility into the options that already exist.

## CONSTRAINTS
- generator: init only. api-spec and api-lib generators/schemas are untouched — their own `x-prompt`s already exist and are irrelevant here since `init` invokes them as plain function calls, not via `nx generate`, so those prompts never fire from within `init`.
- no-tsconfig-changes: this change does not touch path aliasing; tsconfig.base.json is unaffected.
- no-new-options: only add `x-prompt` (and, for `client`, an `x-prompt` list) to existing schema properties — no new schema properties, no default value changes.
- skipBootstrap-and-skipFormat-unprompted: `skipBootstrap` is an internal-only flag (set by api-spec/api-lib when they call init programmatically) and `skipFormat` is a low-value utility flag — neither should get an `x-prompt`, matching the convention already used for `skipFormat` in api-spec/api-lib schemas.
- x-prompt-is-CLI-only: confirmed via existing code (init/generator.ts calls `apiSpecGenerator`/`apiLibGenerator` as direct function calls) that Nx's `x-prompt` mechanism only triggers when a generator is invoked through the `nx generate` CLI parser — programmatic calls bypass it entirely, so adding prompts to `init`'s schema cannot cause api-spec/api-lib's own prompts, or double-prompting, to fire.

## INTERFACES
- I1 schema: `packages/nx-plugin-openapi/src/generators/init/schema.json` — add `x-prompt` to `apiSpecName`, `apiLibName`, `client` (list-style, mirroring api-lib's `client` prompt), and `useDockerBuild`, each defaulting to its current schema default.

## RESEARCH
- R1/x-prompt-scope/Nx's x-prompt mechanism is parsed by the CLI's generate command against supplied schema before invoking the generator factory; direct/programmatic factory calls (as init/generator.ts:31 does for api-spec and api-lib) never trigger it:packages/nx-plugin-openapi/src/generators/init/generator.ts:44-79
- R2/existing-prompt-convention/api-lib's `client` property already defines the list-style x-prompt shape (message/type/items) to mirror for init's own `client` prompt:packages/nx-plugin-openapi/src/generators/api-lib/schema.json:23-39

## INVARIANTS
- IV1: Running `nx generate @istomerf/nx-plugin-openapi:init` interactively prompts for apiSpecName, apiLibName, client, and useDockerBuild, each pre-filled with the existing default, and accepting all defaults reproduces today's non-interactive bootstrap output exactly — check: `packages/nx-plugin-openapi/src/generators/init/generator.spec.ts` (existing tests already assert default-bootstrap behavior; schema/prompt changes don't touch generator.ts logic so no new assertions are needed for the bootstrap outcome itself).
- IV2: `skipBootstrap` and `skipFormat` remain un-prompted (no `x-prompt` added), so internal programmatic invocations from api-spec/api-lib generators are unaffected — check: manual schema review against `packages/nx-plugin-openapi/src/generators/init/schema.json` diff (no test needed; these are schema-only, non-runtime-branching properties).
- IV3: `schema.d.ts` for init stays in sync with `schema.json` (no shape change, only `x-prompt` additions which don't affect TS types) — check: `pnpm nx build nx-plugin-openapi` (schema type-gen/build step) succeeds with no diff needed to `schema.d.ts`.

## Implementation Tasks
- [x] Add `x-prompt` to `apiSpecName` in `packages/nx-plugin-openapi/src/generators/init/schema.json` ("What name would you like to use for the sample API spec lib?") -> satisfies: I1
- [x] Add `x-prompt` to `apiLibName` ("What name would you like to use for the sample API lib?") -> satisfies: I1
- [x] Add list-style `x-prompt` to `client`, mirroring api-lib's client prompt items (custom/angular/react/vue/node) -> satisfies: I1, R2
- [x] Add `x-prompt` to `useDockerBuild` ("Should the build occur inside of a docker container?") -> satisfies: I1
- [x] Run `pnpm nx build nx-plugin-openapi` and `pnpm nx test nx-plugin-openapi` to confirm the schema/build/tests are unaffected -> satisfies: IV1, IV3
- [x] Manually confirm no `x-prompt` was added to `skipBootstrap`/`skipFormat` -> satisfies: IV2
