# Status report: generate-api-lib-sources-unit-tests

_As of 2026-09-17. Flow phase: `Blocked` (see `.speccraft.yaml`)._

## Summary

The core deliverable is implemented and passing: `executor.spec.ts` (9 tests,
unmocked - real `cross-spawn`, real child process, real filesystem) for
`packages/nx-plugin-openapi/src/executors/generate-api-lib-sources/`. Work is
currently **paused**, not because of a defect in this change, but because its
test fixture (`test-support/fake-cli.ts` + `global-setup.ts`/
`global-teardown.ts`) turned out to be shared with a concurrent, unrelated
change (`watch-mode`) being applied in another live session in this same
repo. That session has taken ownership of stabilizing the shared fixture; I
am holding off touching it until they confirm it's done.

## What's done

- `packages/nx-plugin-openapi/src/executors/generate-api-lib-sources/executor.spec.ts`
  - 9 tests, all passing, no `jest.mock` of `cross-spawn`/`fs`/`rimraf` anywhere.
  - Covers: output-dir deletion + recreation, npx CLI arg construction
    (required-only and every optional flag), docker-vs-npx command selection,
    `silent` controlling stdout/stderr logging, exit-code success/rejection,
    and a genuine spawn-level `ENOENT` (real, not simulated via mocking).
- `packages/nx-plugin-openapi/src/test-support/fake-cli.ts` - the fixture:
  fake `npx`/`docker` executables driven by files on disk (not env vars),
  keyed off each test's own `outputDir`.
- `packages/nx-plugin-openapi/src/test-support/global-setup.ts` /
  `global-teardown.ts` - bakes the fake CLI onto `PATH` once, before Jest's
  per-test sandbox exists (see "Key finding" below for why this matters).
- `packages/nx-plugin-openapi/jest.config.ts` - wired to the above.
- `proposal.md`, `design.md`, `tasks.md` - updated mid-implementation to
  reflect the real, verified technique (see "Design evolution" below); this
  is not what was originally approved at the plan-approval gate, but a
  corrected version verified to actually work in this repo's toolchain.

All of the above is now **committed to `main`** (as of commit `cf65ec5`,
made by the other session) - it took my fixture and spec verbatim into a
shared "reusable fake-cli utility" commit.

## What's not done / blocked

- `pnpm nx test nx-plugin-openapi` (whole package) currently **fails** - but
  only because of `watch-api-lib-sources/executor.spec.ts`, which belongs to
  the other session's `watch-mode` change and still imports an older
  `installFakeCli`/`FakeCliHandle` API that no longer exists. This is their
  file, not touched by this change, and per their explicit request I have
  not edited it.
- `tasks.md` checkboxes are still unchecked - task completion wasn't
  formally recorded because the apply loop was interrupted by the
  cross-session collision, not because the work described isn't done. The
  actual state per task, for whoever resumes:
  - A1-A9: **effectively done** (fixture, spec, all sub-tests, `nx test`
    and `nx lint` both clean for the files this change owns).
  - A10 (COMMIT): not done by this change directly - the work landed in the
    other session's commit `cf65ec5` instead of a commit from this change's
    apply loop. Worth deciding whether that commit satisfies A10 as-is, or
    whether this change should still produce its own conventional commit.
  - V1-V3: not re-verified end-to-end since the other session's changes
    landed (whole-suite `nx test` still red for the unrelated reason above;
    `nx lint` is clean; the "no `jest.mock`" grep check hasn't been re-run
    since the shared-fixture handoff).

## Key finding (load-bearing, worth preserving)

The approved design originally planned per-test `process.env.PATH`
mutation to redirect `spawn('npx'/'docker', ...)` to a fake script. That
**does not work**: verified experimentally (including via plain `npx jest`,
bypassing this repo's nx wrapper) that Jest 30's test-environment sandboxing
prevents any `process.env` mutation made inside a test - even passed
explicitly as `spawn`'s `env` option - from reaching real spawned children.
The only point where a `PATH` mutation actually takes effect is a Jest
`globalSetup` script, which runs before that sandbox exists. See `design.md`
"Decisions" for the full writeup, including why the fake CLI's `PATH` must
*replace* rather than prepend (a real `npx`/`docker` elsewhere on PATH lets
resolution silently fall through past a broken/missing fake binary), and why
simulating `ENOENT` needs the file removed outright rather than broken via a
bad shebang (bare-name command resolution tolerates a broken candidate and
keeps searching).

## Cross-session coordination log

1. Discovered `packages/nx-plugin-openapi/src/executors/watch-api-lib-sources/`
   (untracked) mid-implementation - another live session's in-progress work,
   sharing `test-support/fake-cli.ts` with this change. My independent
   rewrite of that file had overwritten theirs, breaking their spec.
2. Paused and asked the user how to proceed; user said to pause and let it
   get sorted out rather than guess.
3. The other session (`nx-plugins-93`) reached out directly, confirmed the
   collision, independently reproduced the `process.env.PATH`-under-Jest-30
   finding, and said their user asked them to take over stabilizing the
   shared fixture - asked this session to hold off editing
   `test-support/fake-cli.ts`, `global-setup.ts`, `global-teardown.ts`, and
   `jest.config.ts` until they confirm it's done.
4. Acknowledged and held off. They have since committed (`cf65ec5`),
   carrying this change's fixture and spec forward unchanged - but their own
   `watch-api-lib-sources/executor.spec.ts` is not yet updated to match, so
   the whole-package suite is still red for that unrelated reason.
5. No further action taken since; waiting on their ping.
