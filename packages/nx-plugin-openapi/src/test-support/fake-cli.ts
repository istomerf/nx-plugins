// Third Parties
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

/**
 * Points every worker process at the fake `npx`/`docker` bin dir created by
 * `global-setup.ts` - per-test `process.env.PATH` mutation does not reach
 * spawned children under this project's Jest/Node setup (see design.md), so
 * the PATH mutation happens once, before Jest's test-environment sandbox
 * exists, and this file only points at where it put things.
 */
export const FAKE_CLI_BIN_DIR_MARKER_FILE = join(tmpdir(), 'nx-plugin-openapi-fake-cli-dir.txt');

const CONTROL_FILE = {
  exitCode: 'fake-cli-exit-code',
  stdout: 'fake-cli-stdout',
  stderr: 'fake-cli-stderr',
  args: 'fake-cli-args.txt',
} as const;

export const FAKE_CLI_COMMANDS = ['npx', 'docker'] as const;
export type FakeCliCommand = (typeof FAKE_CLI_COMMANDS)[number];

/**
 * A working fake CLI: finds its own `-o <outputDir>` argv (always present -
 * executor.ts appends it for both the npx and docker branches), and uses
 * `outputDir`'s parent directory as a per-test scratch dir to read/write
 * control and args-capture files. `outputDir` itself gets deleted by
 * `deleteOutputDir` at the start of every run, so control files must live in
 * its parent, not inside it.
 *
 * Uses only bash builtins (parameter expansion, `$(< file)`, `printf`) - not
 * external tools like `dirname`/`cat` - because `global-setup.ts` replaces
 * PATH entirely with the fake-cli bin dir, so nothing else would resolve.
 */
export const GOOD_FAKE_CLI_SCRIPT = [
  // Absolute path, not `/usr/bin/env bash`: same reason, `env` couldn't
  // resolve `bash` with PATH replaced.
  '#!/bin/bash',
  'set -uo pipefail',
  'output_dir=""',
  'prev=""',
  'for arg in "$@"; do',
  '  if [ "$prev" = "-o" ]; then output_dir="$arg"; fi',
  '  prev="$arg"',
  'done',
  'scratch_dir="${output_dir%/*}"',
  `printf '%s\\n' "$@" > "$scratch_dir/${CONTROL_FILE.args}"`,
  `if [ -f "$scratch_dir/${CONTROL_FILE.stdout}" ]; then printf '%s' "$(< "$scratch_dir/${CONTROL_FILE.stdout}")"; fi`,
  `if [ -f "$scratch_dir/${CONTROL_FILE.stderr}" ]; then printf '%s' "$(< "$scratch_dir/${CONTROL_FILE.stderr}")" >&2; fi`,
  'exit_code=0',
  `if [ -f "$scratch_dir/${CONTROL_FILE.exitCode}" ]; then exit_code="$(< "$scratch_dir/${CONTROL_FILE.exitCode}")"; fi`,
  'exit "$exit_code"',
  '',
].join('\n');

export interface FakeCliScenario {
  /** Holds `outputDir` plus this test's control/args-capture files. */
  scratchDir: string;
  /** Passed as `options.outputDir` - a fresh, not-yet-existing subdirectory of `scratchDir`. */
  outputDir: string;
}

/** Creates a fresh, isolated scratch dir + outputDir pair for one test. */
export function createFakeCliScenario(): FakeCliScenario {
  const scratchDir = mkdtempSync(join(tmpdir(), 'executor-spec-'));
  return { scratchDir, outputDir: join(scratchDir, 'output') };
}

export function setFakeCliExitCode(scenario: FakeCliScenario, exitCode: number): void {
  writeFileSync(join(scenario.scratchDir, CONTROL_FILE.exitCode), String(exitCode));
}

export function setFakeCliStdout(scenario: FakeCliScenario, content: string): void {
  writeFileSync(join(scenario.scratchDir, CONTROL_FILE.stdout), content);
}

export function setFakeCliStderr(scenario: FakeCliScenario, content: string): void {
  writeFileSync(join(scenario.scratchDir, CONTROL_FILE.stderr), content);
}

export function readFakeCliArgs(scenario: FakeCliScenario): string[] {
  const argsFile = join(scenario.scratchDir, CONTROL_FILE.args);
  return existsSync(argsFile) ? readFileSync(argsFile, 'utf-8').split('\n').filter(Boolean) : [];
}

function fakeCliBinDir(): string {
  return readFileSync(FAKE_CLI_BIN_DIR_MARKER_FILE, 'utf-8');
}

/**
 * Temporarily removes the shared fake `command` binary, to exercise a real
 * spawn-level `error` event: `global-setup.ts` replaces PATH entirely (rather
 * than prepending it), so with the file gone there is nothing left for
 * command resolution to fall through to - a genuinely unresolvable command,
 * no PATH tricks or mocking involved. Scoped to `executor.spec.ts` only: the
 * binary is shared for the whole test run, and this is safe only because
 * Jest runs one file's tests serially.
 */
export function removeFakeCliBinary(command: FakeCliCommand): () => void {
  const scriptPath = join(fakeCliBinDir(), command);
  rmSync(scriptPath);
  return () => {
    writeFileSync(scriptPath, GOOD_FAKE_CLI_SCRIPT);
    chmodSync(scriptPath, 0o755);
  };
}
