/**
 * Shared logic for publishing the plugin to a local Verdaccio registry —
 * used both by the standalone `pnpm local-publish` script (manual testing)
 * and by the e2e suite's Jest globalSetup/globalTeardown.
 */
import { startLocalRegistry } from '@nx/js/plugins/jest/local-registry';
import { execSync } from 'child_process';
import { releasePublish, releaseVersion } from 'nx/release';

export const REGISTRY_URL = 'http://localhost:4873';

const LOCAL_REGISTRY_TARGET = 'root:local-registry';
const STORAGE = './tmp/local-registry/storage';

export interface PublishToLocalRegistryOptions {
  tag: string;
  version: string;
  /** Build the plugin before publishing. Skip when the caller's task graph already builds it (e.g. via `dependsOn: ["^build"]`). */
  build?: boolean;
}

export async function publishToLocalRegistry({ tag, version, build = true }: PublishToLocalRegistryOptions) {
  if (build) {
    execSync('pnpm nx run nx-plugin-openapi:build', { stdio: 'inherit' });
  }

  const stopLocalRegistry = await startLocalRegistry({
    localRegistryTarget: LOCAL_REGISTRY_TARGET,
    storage: STORAGE,
    verbose: false,
  });

  const { workspaceVersion } = await releaseVersion({
    specifier: version,
    stageChanges: false,
    gitCommit: false,
    gitTag: false,
    firstRelease: true,
    versionActionsOptionsOverrides: { skipLockFileUpdate: true },
  });

  await releasePublish({ tag, firstRelease: true });

  return { workspaceVersion, stopLocalRegistry };
}
