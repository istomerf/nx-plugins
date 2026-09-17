// Third Parties
import { spawn } from 'cross-spawn';

// Fixture
import { FAKE_CLI_ENV, FakeCliHandle, installEmptyPath, installFakeCli } from './fake-cli';

describe('fake-cli fixture', () => {
  let fakeCli: FakeCliHandle;

  afterEach(() => {
    fakeCli?.restore();
    delete process.env[FAKE_CLI_ENV.EXIT_CODE];
    delete process.env[FAKE_CLI_ENV.STDOUT];
    delete process.env[FAKE_CLI_ENV.STDERR];
  });

  it('resolves the fake script on PATH and captures the args it received', async () => {
    fakeCli = installFakeCli(['npx']);

    const exitCode = await spawnAndWaitForExit('npx', ['generate', '-i', 'spec.yml']);

    expect(exitCode).toBe(0);
    expect(fakeCli.readCapturedArgs()).toEqual(['generate', '-i', 'spec.yml']);
  });

  it('honors the configured exit code', async () => {
    fakeCli = installFakeCli(['npx']);
    process.env[FAKE_CLI_ENV.EXIT_CODE] = '7';

    const exitCode = await spawnAndWaitForExit('npx', []);

    expect(exitCode).toBe(7);
  });

  it('is unresolvable when the PATH is pointed at an empty directory', async () => {
    const emptyPath = installEmptyPath();

    try {
      await expect(spawnAndWaitForError('npx', [])).resolves.toMatchObject({ code: 'ENOENT' });
    } finally {
      emptyPath.restore();
    }
  });
});

function spawnAndWaitForExit(command: string, args: string[]): Promise<number | null> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'ignore' });
    child.on('error', reject);
    child.on('exit', (code) => resolve(code));
  });
}

function spawnAndWaitForError(command: string, args: string[]): Promise<NodeJS.ErrnoException> {
  return new Promise((resolve) => {
    const child = spawn(command, args, { stdio: 'ignore' });
    child.on('error', resolve);
  });
}
