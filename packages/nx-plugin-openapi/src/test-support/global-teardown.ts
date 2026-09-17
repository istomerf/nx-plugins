// Third Parties
import { existsSync, readFileSync, rmSync, unlinkSync } from 'fs';

// Fixture
import { FAKE_CLI_BIN_DIR_MARKER_FILE } from './fake-cli';

export default async function globalTeardown(): Promise<void> {
  if (!existsSync(FAKE_CLI_BIN_DIR_MARKER_FILE)) {
    return;
  }

  const binDir = readFileSync(FAKE_CLI_BIN_DIR_MARKER_FILE, 'utf-8');
  rmSync(binDir, { recursive: true, force: true });
  unlinkSync(FAKE_CLI_BIN_DIR_MARKER_FILE);
}
