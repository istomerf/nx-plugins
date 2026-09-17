// Third Parties
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { delimiter, join } from 'path';

/**
 * Env vars the fake CLI script reads to decide its own behavior, and that it
 * writes the arguments it received into. Set these on `process.env` (restored
 * by `FakeCliHandle.restore()`) to control a given test's outcome.
 */
export const FAKE_CLI_ENV = {
  ARGS_FILE: 'FAKE_CLI_ARGS_FILE',
  EXIT_CODE: 'FAKE_CLI_EXIT_CODE',
  STDOUT: 'FAKE_CLI_STDOUT',
  STDERR: 'FAKE_CLI_STDERR',
} as const;

const FAKE_CLI_SCRIPT = [
  '#!/usr/bin/env bash',
  'set -uo pipefail',
  'if [ -n "${FAKE_CLI_STDOUT:-}" ]; then echo "$FAKE_CLI_STDOUT"; fi',
  'if [ -n "${FAKE_CLI_STDERR:-}" ]; then echo "$FAKE_CLI_STDERR" >&2; fi',
  'if [ -n "${FAKE_CLI_ARGS_FILE:-}" ]; then printf \'%s\\n\' "$@" > "$FAKE_CLI_ARGS_FILE"; fi',
  'exit "${FAKE_CLI_EXIT_CODE:-0}"',
  '',
].join('\n');

const ENV_KEYS = Object.values(FAKE_CLI_ENV);

export interface FakeCliHandle {
  /** Absolute path to the file the fake script writes its received argv into. */
  argsFile: string;
  /** The captured argv from the most recent invocation, one entry per line. */
  readCapturedArgs(): string[];
  /** Restores `process.env` and removes the temp bin dir. */
  restore(): void;
}

/**
 * Creates a temp bin directory containing an executable fake CLI script for
 * each given command name (e.g. "npx", "docker"), and prepends that directory
 * to `process.env.PATH` so a real `spawn(command, ...)` resolves to the fake
 * script instead of the real binary - no mocking of cross-spawn/child_process.
 */
export function installFakeCli(commands: string[]): FakeCliHandle {
  const binDir = mkdtempSync(join(tmpdir(), 'fake-cli-bin-'));
  const argsFile = join(binDir, 'captured-args.txt');

  for (const command of commands) {
    const scriptPath = join(binDir, command);
    writeFileSync(scriptPath, FAKE_CLI_SCRIPT);
    chmodSync(scriptPath, 0o755);
  }

  const originalEnv = captureEnv(['PATH', ...ENV_KEYS]);

  process.env.PATH = `${binDir}${delimiter}${process.env.PATH ?? ''}`;
  process.env[FAKE_CLI_ENV.ARGS_FILE] = argsFile;

  return {
    argsFile,
    readCapturedArgs: () =>
      existsSync(argsFile)
        ? readFileSync(argsFile, 'utf-8').split('\n').filter(Boolean)
        : [],
    restore: () => {
      restoreEnv(originalEnv);
      rmSync(binDir, { recursive: true, force: true });
    },
  };
}

/**
 * Points `process.env.PATH` at an empty temp directory only (no fallback to
 * the real PATH), so any command spawned by name is unresolvable - used to
 * exercise the real spawn-level `error` (ENOENT) event without mocking.
 */
export function installEmptyPath(): { restore(): void } {
  const emptyDir = mkdtempSync(join(tmpdir(), 'fake-cli-empty-path-'));
  const originalEnv = captureEnv(['PATH']);

  process.env.PATH = emptyDir;

  return {
    restore: () => {
      restoreEnv(originalEnv);
      rmSync(emptyDir, { recursive: true, force: true });
    },
  };
}

function captureEnv(keys: string[]): Map<string, string | undefined> {
  return new Map(keys.map((key) => [key, process.env[key]]));
}

function restoreEnv(snapshot: Map<string, string | undefined>): void {
  for (const [key, value] of snapshot) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}
