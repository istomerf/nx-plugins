import { ExecutorContext } from '@nx/devkit';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { createFakeCliScenario, FakeCliScenario, readFakeCliArgs } from '../../test-support/fake-cli';
import runExecutor from './executor';
import { WatchApiLibSourcesExecutorSchema } from './schema';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(predicate: () => boolean, timeoutMs = 3000, intervalMs = 20): Promise<void> {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error('Timed out waiting for condition');
    }
    await sleep(intervalMs);
  }
}

function createContext(root: string): ExecutorContext {
  return { root } as unknown as ExecutorContext;
}

describe('watch-api-lib-sources executor (unmocked - real chokidar, real spawn, real fs)', () => {
  let workspaceRoot: string;
  let specPath: string;
  let scenario: FakeCliScenario;

  beforeEach(() => {
    workspaceRoot = mkdtempSync(join(tmpdir(), 'watch-api-lib-sources-'));
    specPath = join(workspaceRoot, 'spec.yml');
    writeFileSync(specPath, 'openapi: 3.0.0');
    scenario = createFakeCliScenario();
  });

  afterEach(() => {
    rmSync(workspaceRoot, { recursive: true, force: true });
    rmSync(scenario.scratchDir, { recursive: true, force: true });
  });

  function baseOptions(): WatchApiLibSourcesExecutorSchema {
    return {
      generator: 'typescript-fetch',
      outputDir: scenario.outputDir,
      sourceSpecPathOrUrl: specPath,
    };
  }

  it('fails fast without starting a watch loop when given a remote spec (S03)', async () => {
    const iterator = runExecutor(
      { ...baseOptions(), sourceSpecPathOrUrl: 'https://example.com/openapi.yml' },
      createContext(workspaceRoot),
    );

    const first = await iterator.next();
    expect(first.value).toEqual({ success: false });

    const second = await iterator.next();
    expect(second.done).toBe(true);

    // No watcher was started, so a spec file change must not invoke the fake CLI.
    await sleep(200);
    expect(readFakeCliArgs(scenario)).toEqual([]);
  });

  it('regenerates sources via the real CLI when the local spec file is saved (S01)', async () => {
    const iterator = runExecutor(baseOptions(), createContext(workspaceRoot));

    const first = await iterator.next();
    expect(first.value).toEqual({ success: true });

    await sleep(150); // let the watcher become ready before triggering a change
    writeFileSync(specPath, 'openapi: 3.0.1');

    await waitFor(() => readFakeCliArgs(scenario).length > 0);
    expect(readFakeCliArgs(scenario)).toEqual([
      'openapi-generator-cli',
      'generate',
      '-i',
      specPath,
      '-g',
      'typescript-fetch',
      '-o',
      scenario.outputDir,
    ]);

    // Stop the continuous task the same way Nx would (process signal), so the
    // underlying watcher releases its file handle before the test ends.
    process.emit('SIGTERM');
    await sleep(50);
  });
});
