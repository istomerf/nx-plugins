import { watch } from 'chokidar';

export interface WatchSpecFileOptions {
  debounceMs?: number;
}

export interface WatchHandle {
  /** Stops watching and releases the underlying file watcher. */
  close(): Promise<void>;
}

/**
 * Watches a single spec file and invokes `onChange` on each debounced change.
 * A change that arrives while `onChange` is still running is not dropped: it
 * collapses into exactly one trailing rerun, scheduled once the in-flight run
 * finishes, so overlapping runs never happen and the last saved state is
 * always eventually reflected.
 */
export function watchSpecFile(
  specPath: string,
  onChange: () => void | Promise<void>,
  { debounceMs = 300 }: WatchSpecFileOptions = {},
): WatchHandle {
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;
  let running = false;
  let rerunQueued = false;

  const runOnChange = async () => {
    running = true;
    try {
      await onChange();
    } catch {
      // The onChange handler is responsible for reporting its own failures;
      // a failed run must not crash the watcher or stop it from reacting to
      // the next change.
    } finally {
      running = false;
      if (rerunQueued) {
        rerunQueued = false;
        await runOnChange();
      }
    }
  };

  const dispatch = () => {
    if (running) {
      rerunQueued = true;
      return;
    }
    void runOnChange();
  };

  const scheduleDispatch = () => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(() => {
      debounceTimer = undefined;
      dispatch();
    }, debounceMs);
  };

  const watcher = watch(specPath, { ignoreInitial: true });
  watcher.on('change', scheduleDispatch);

  return {
    close: async () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = undefined;
      }
      await watcher.close();
    },
  };
}
