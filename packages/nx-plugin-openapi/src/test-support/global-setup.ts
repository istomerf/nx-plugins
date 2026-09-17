// Third Parties
import { chmodSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

// Fixture
import { FAKE_CLI_BIN_DIR_MARKER_FILE, FAKE_CLI_COMMANDS, GOOD_FAKE_CLI_SCRIPT } from './fake-cli';

/**
 * Replaces PATH with a fake `npx`/`docker` bin dir once, before any test
 * file's Jest sandbox exists. Per-test `process.env.PATH` mutation does not
 * reach spawned children under this project's Jest/Node setup (see
 * design.md) - this runs in Jest's own orchestrating process, so the
 * mutation is a real `setenv` that worker processes inherit at fork time.
 *
 * PATH is replaced, not prepended: a real `npx`/`docker` elsewhere on PATH
 * would let command resolution silently fall through past a deliberately
 * broken/missing fake binary (used to test the spawn-error path), instead of
 * failing the way a genuinely unresolvable command should.
 */
export default async function globalSetup(): Promise<void> {
  const binDir = mkdtempSync(join(tmpdir(), 'nx-plugin-openapi-fake-cli-'));

  for (const command of FAKE_CLI_COMMANDS) {
    const scriptPath = join(binDir, command);
    writeFileSync(scriptPath, GOOD_FAKE_CLI_SCRIPT);
    chmodSync(scriptPath, 0o755);
  }

  writeFileSync(FAKE_CLI_BIN_DIR_MARKER_FILE, binDir);
  process.env.PATH = binDir;
}
