## Story

As a developer iterating on an OpenAPI contract and its generated client together, I want source regeneration to happen automatically when I save the spec file, so that I don't have to switch to a terminal and re-run the generator after every edit.

## ADDED Requirements

### Requirement: Watch local spec and regenerate on change

ACC1 - The system SHALL watch the resolved local spec file for an `api-lib` project's `watch-sources` target and regenerate sources when the file changes.

#### Scenario: Spec file saved triggers regeneration

S01

- **GIVEN** an `api-lib` project configured with a local `sourceSpecLib` and its `watch-sources` target running
- **WHEN** the source spec file is saved with a change
- **THEN** sources are regenerated to reflect the new spec

### Requirement: Debounce rapid successive spec saves

ACC2 - The system SHALL debounce spec file change events (default 300ms) so rapid successive saves trigger one regeneration, not one per save.

#### Scenario: Multiple saves within debounce window

S02

- **GIVEN** `watch-sources` is running against a local spec
- **WHEN** the spec file is saved multiple times within 300ms
- **THEN** only one regeneration run occurs after the debounce window elapses

### Requirement: Remote spec fails fast under watch

ACC3 - The system SHALL fail fast with a clear error, without starting a watch loop, when `watch-sources` is invoked against an `api-lib` configured with a remote spec.

#### Scenario: Watch invoked on remote-spec project

S03

- **GIVEN** an `api-lib` project configured with a remote (`isRemoteSpec`) spec URL
- **WHEN** the `watch-sources` target is run
- **THEN** the executor fails immediately with a clear error explaining remote specs aren't supported for watch mode
- **AND** no watch loop or file listener is started

### Requirement: Continuous watch target excluded from affected/CI runs

ACC4 - The `watch-sources` target SHALL be marked continuous so Nx excludes it from `affected`/CI-style batch runs.

#### Scenario: Affected test run does not invoke watch-sources

S04

- **GIVEN** a project with `watch-sources` registered as a continuous target
- **WHEN** `nx affected:test` (or a similar CI batch command) is run
- **THEN** `watch-sources` is not executed as part of that run

### Requirement: Generator registers watch-sources target for local-spec projects

ACC5 - The `api-lib` generator SHALL register a `watch-sources` target automatically for projects configured with a local spec, alongside `generate-sources`.

#### Scenario: Local-spec project gets watch-sources target

S05

- **GIVEN** the `api-lib` generator is run to scaffold a project with a local `sourceSpecLib`
- **WHEN** the generator completes
- **THEN** the generated `project.json` includes a `watch-sources` target wired to the `watch-api-lib-sources` executor, alongside `generate-sources`

#### Scenario: Remote-spec project does not get watch-sources target

S06

- **GIVEN** the `api-lib` generator is run to scaffold a project with a remote spec URL
- **WHEN** the generator completes
- **THEN** the generated `project.json` does not include a `watch-sources` target
