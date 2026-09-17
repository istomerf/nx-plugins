import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { watchSpecFile, WatchHandle } from './watch-spec-file';

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

describe('watchSpecFile', () => {
  let dir: string;
  let specPath: string;
  let handle: WatchHandle | undefined;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'watch-spec-file-'));
    specPath = join(dir, 'spec.yml');
    writeFileSync(specPath, 'initial');
  });

  afterEach(async () => {
    await handle?.close();
    handle = undefined;
    rmSync(dir, { recursive: true, force: true });
  });

  it('invokes onChange when the spec file is saved', async () => {
    const onChange = jest.fn();
    handle = watchSpecFile(specPath, onChange, { debounceMs: 20 });
    await sleep(150); // let the watcher become ready before triggering a change

    writeFileSync(specPath, 'changed');

    await waitFor(() => onChange.mock.calls.length === 1);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('collapses multiple saves within the debounce window into a single run (S02)', async () => {
    const onChange = jest.fn();
    handle = watchSpecFile(specPath, onChange, { debounceMs: 100 });
    await sleep(150);

    writeFileSync(specPath, 'change-1');
    await sleep(20);
    writeFileSync(specPath, 'change-2');
    await sleep(20);
    writeFileSync(specPath, 'change-3');

    await waitFor(() => onChange.mock.calls.length >= 1);
    await sleep(300); // ensure no further trickle-in calls arrive
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('queues exactly one trailing rerun when a change arrives while onChange is still running', async () => {
    let releaseFirstRun: () => void = () => undefined;
    const firstRunGate = new Promise<void>((resolve) => {
      releaseFirstRun = resolve;
    });
    const onChange = jest.fn(async () => {
      if (onChange.mock.calls.length === 1) {
        await firstRunGate;
      }
    });

    handle = watchSpecFile(specPath, onChange, { debounceMs: 20 });
    await sleep(150);

    writeFileSync(specPath, 'change-1');
    await waitFor(() => onChange.mock.calls.length === 1);

    // Further saves arrive while the first run is still in-flight.
    writeFileSync(specPath, 'change-2');
    await sleep(20);
    writeFileSync(specPath, 'change-3');
    await sleep(150); // long enough for debounce to elapse while still blocked

    expect(onChange).toHaveBeenCalledTimes(1);

    releaseFirstRun();

    await waitFor(() => onChange.mock.calls.length === 2);
    await sleep(200);
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it('stops reacting to changes after close()', async () => {
    const onChange = jest.fn();
    handle = watchSpecFile(specPath, onChange, { debounceMs: 20 });
    await sleep(150);

    await handle.close();
    handle = undefined;

    writeFileSync(specPath, 'after-close');
    await sleep(200);

    expect(onChange).not.toHaveBeenCalled();
  });
});
