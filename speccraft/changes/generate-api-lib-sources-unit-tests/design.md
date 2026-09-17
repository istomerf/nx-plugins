## Context

`executor.ts` (see proposal.md - Impact) does two things: deletes/creates `outputDir` on the real filesystem via `deleteOutputDir`/`mkdirSync`, then shells out via `cross-spawn` to either `npx openapi-generator-cli` or `docker run openapitools/openapi-generator-cli`, streaming stdout/stderr through `logger` and resolving/rejecting based on the child's exit code and `error` event.

No test infra for this executor exists yet. The one referenced in CLAUDE.md/speccraft context (`src/test/mockSpawn.ts`) does not exist in the repo, and the user explicitly wants tests that don't mock `cross-spawn` anyway, so it's not being created.

## Goals / Non-Goals

**Goals:**
- Exercise the real `cross-spawn` → real child process → real exit code/error-event path, not a jest mock of it.
- Exercise real filesystem behavior (`rimraf`, `mkdirSync`) against real temp directories.
- Keep tests hermetic: no network access, no dependency on a real `openapi-generator-cli` install or a running Docker daemon.

**Non-Goals:**
- Testing that `openapi-generator-cli` itself produces correct generated sources - that's the e2e suite's job (`nx-plugin-openapi-e2e`).
- Testing Docker image behavior - only that the executor invokes `docker` with the right args when `useDockerBuild` is set.
- Reintroducing or wiring up the stale `mockSpawn.ts` reference.

## Decisions

### Decision: How to test spawn behavior without mocking `cross-spawn`

| Option | Real subprocess/exit-code semantics exercised | Network/Docker dependency | Determinism |
|---|---|---|---|
| PATH-shadowed fake `npx`/`docker`, baked in via Jest `globalSetup` (chosen) | Yes - real `spawn`, real child process, real stdio/exit-code plumbing | None | Full - fake script controls exit code/output via files on disk |
| PATH-shadowed fake CLI, `process.env.PATH` mutated per-test (originally planned) | Yes, in theory | None | **Unusable** - see below |
| `jest.mock('cross-spawn')` | No | None | Full, but explicitly ruled out by the ask |
| Invoke the real `openapi-generator-cli`/Docker | Yes | Requires network + Docker | Low, slow - this is what the e2e suite already does |

**Superseded finding:** per-test `process.env.PATH` mutation (the original plan) does not work with this project's Jest 30 + Node 26 (`lts/krypton`) combination. Verified experimentally (including with `npx jest` directly, bypassing this repo's nx wrapper): Jest's test-environment sandboxing isolates a test's `process.env` from the real OS environment actually inherited by spawned children - neither an implicit `process.env.PATH` mutation nor an explicit `{ ...process.env, PATH: ... }` passed as `spawn`'s `env` option reaches the child. Children always see the true, unmodified environment. This reproduces with the exact `jest` binary this repo pins, so it isn't specific to any one machine.

**Chosen approach:** mutate `process.env.PATH` exactly once, in a Jest `globalSetup` script. `globalSetup` runs in Jest's own orchestrating process *before* any test-environment sandbox exists and before worker processes are forked, so the mutation is a real, OS-level `setenv` that worker processes (each a real `fork`) inherit at birth - unaffected by the later per-test sandboxing. Verified with a standalone proof-of-concept using this repo's exact pinned `jest` binary: a child spawned by bare command name inside a test resolved to a fake script whose path was baked in by `globalSetup`.

Because the PATH mutation now happens once for the whole test run (not per test), per-test behavior (exit code, stdout/stderr, args-under-test) can't be conveyed via env vars anymore either - it's carried through plain files instead (see below), since filesystem I/O is real and unaffected by the sandboxing that blocks env propagation.

### Decision: Fake script implementation and per-test control

One fixed fake-CLI bin directory for the whole test run (created by `globalSetup`, removed by `globalTeardown`), containing executable scripts named `npx` and `docker`. Both scripts:
- Parse their own `argv` for the `-o <outputDir>` flag that `executor.ts` always appends, and use `dirname(outputDir)` as a per-test "scratch dir" - since each test creates a fresh temp `outputDir` inside its own fresh temp scratch dir, this gives every test isolated control/output files with no IDs to plumb through env or args.
- Write the full `argv` they received to `<scratch>/fake-cli-args.txt`, so tests assert on constructed CLI args.
- If `<scratch>/fake-cli-stdout` / `fake-cli-stderr` exist, `cat` them to stdout/stderr; if `<scratch>/fake-cli-exit-code` exists, exit with that code (default `0`).

A test drives a scenario by writing those control files into its own scratch dir *before* calling `runExecutor` - real `fs.writeFileSync`, no mocking. Note `outputDir` itself gets deleted by `deleteOutputDir` at the start of every run, so control files live in its *parent* (the scratch dir), not inside it.

CI runs on `ubuntu-latest` only (see `.github/workflows/`) and local dev is macOS - both POSIX, so a Bash fake script needs no Windows fallback.

### Decision: Simulating a spawn-level `error` event

Pointing `PATH` at an empty directory (the original plan) doesn't reliably force `ENOENT`: a real `npx` and `docker` exist elsewhere on the real PATH on both CI and dev machines, so removing just the fake entry would fall through to the real ones - slow, networked, and non-hermetic (violates ACC3).

Verified working alternative: temporarily overwrite the shared fake script (`npx` or `docker`) with one whose shebang points at a nonexistent interpreter (`#!/nonexistent/bad-interpreter`), then restore the original afterward. The OS fails the `exec` itself (confirmed: raises `ENOENT` on the `spawn` call, not a nonzero exit), which is exactly the real `child.on('error', reject)` branch - no PATH tricks or mocking needed. Since the fake binary is shared process-wide, this swap only happens inside `executor.spec.ts`'s own tests (which Jest runs serially within one file) and is wrapped in `try/finally` so a failure can't leave the shared script broken for later tests.

### Decision: Filesystem for `outputDir`/`context.root`

Use `fs.mkdtempSync(path.join(os.tmpdir(), ...))` per test for both `context.root` and a scratch dir (holding `outputDir` as a subdirectory plus the control files above), so `deleteOutputDir`'s real `rimraf.sync` and `mkdirSync` run against real, disposable directories. One `rmSync(scratchDir, { recursive: true })` in `afterEach` cleans up both `outputDir` and its control files together.

## Risks / Trade-offs

- [Fake-script approach only proves the executor spawns/streams/handles-exit-codes correctly, not that real `openapi-generator-cli` output is handled downstream] → Already covered by the e2e suite; explicitly a non-goal here.
- [The fake bin dir is baked into `PATH` for the whole `nx-plugin-openapi` test run, not scoped per test] → Acceptable: no other spec in this project invokes `npx`/`docker` for real. `globalTeardown` removes it after the run; a crashed run can leave a stray temp dir (harmless, next run creates its own).
- [The `npx`/`docker` shebang-break trick mutates a file shared across the whole test run] → Scoped to `executor.spec.ts` only, wrapped in `try/finally`, and safe because Jest runs one file's tests serially - documented so it isn't copied into a context where that assumption doesn't hold.
- [`globalSetup`'s fixed marker-file path (`os.tmpdir()/nx-plugin-openapi-fake-cli-dir.txt`) could collide if two `nx test nx-plugin-openapi` runs execute concurrently on the same machine] → Low likelihood (not how this project is normally run); worst case is a stale temp dir, not a false test result.
- [Bash-script fixture isn't portable to Windows] → Acceptable: CI is Ubuntu-only and this is dev/test tooling, not shipped code.
