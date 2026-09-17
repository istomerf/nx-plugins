# Handoff: generate-api-lib-sources-unit-tests

**TL;DR:** The tests are written and passing. Nothing is broken in this
change. It's paused only because its test fixture is shared with another
session's concurrent `watch-mode` work, which has taken over stabilizing
that shared file. Waiting on their ping. See `STATUS.md` for full detail.

## Resume checklist (once the other session confirms the fixture is stable)

1. Re-read `packages/nx-plugin-openapi/src/test-support/fake-cli.ts` and
   `global-setup.ts`/`global-teardown.ts` to see what, if anything, changed.
2. Re-run `packages/nx-plugin-openapi/src/executors/generate-api-lib-sources/executor.spec.ts`
   on its own first (`pnpm nx test nx-plugin-openapi --testFile=executor.spec.ts`)
   to confirm it still passes against whatever the other session landed.
3. Run the whole package: `pnpm nx test nx-plugin-openapi` and
   `pnpm nx lint nx-plugin-openapi`. Both should be clean once
   `watch-api-lib-sources/executor.spec.ts` is fixed up on their end too.
4. Confirm no mocking crept in:
   `grep -r "jest.mock" packages/nx-plugin-openapi/src/executors/generate-api-lib-sources/`
   should return nothing (ACC1 / tasks.md V3).
5. Check off tasks.md A1-A9 (already done, just not recorded) and decide on
   A10 (COMMIT): the work is already in the other session's commit
   `cf65ec5` - decide whether that's sufficient or this change should still
   produce its own commit.
6. Update `.speccraft.yaml`'s `flow` to `phase: Verify` via
   `speccraft record-flow`, then continue the `/scx:full` cycle: verify -\>
   auto-fix loop (if needed) -\> final report. `/scx:archive` afterward.

## Don't touch until the other session pings back

- `packages/nx-plugin-openapi/src/test-support/fake-cli.ts`
- `packages/nx-plugin-openapi/src/test-support/global-setup.ts`
- `packages/nx-plugin-openapi/src/test-support/global-teardown.ts`
- `packages/nx-plugin-openapi/jest.config.ts`

## Where the real content lives

- Implementation: `packages/nx-plugin-openapi/src/executors/generate-api-lib-sources/executor.spec.ts`
- Design rationale + the Jest-sandboxing finding: `design.md`
- Task breakdown: `tasks.md`
- Full narrative + cross-session log: `STATUS.md`
