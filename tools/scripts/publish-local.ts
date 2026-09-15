/**
 * Builds the plugin, starts a local Verdaccio registry, and publishes the
 * built package to it so it can be installed into another workspace for
 * manual testing (same registry/publish flow the e2e suite automates, run
 * standalone and left running instead of torn down after the tests).
 *
 * Usage: pnpm local-publish
 * The registry keeps running in the foreground until you press Ctrl+C.
 */
import { startLocalRegistry } from '@nx/js/plugins/jest/local-registry';
import { execSync } from 'child_process';
import { releasePublish, releaseVersion } from 'nx/release';

const REGISTRY_URL = 'http://localhost:4873';
const PUBLISH_TAG = 'local';

async function main() {
  execSync('pnpm nx run nx-plugin-openapi:build', { stdio: 'inherit' });

  const stopLocalRegistry = await startLocalRegistry({
    localRegistryTarget: 'root:local-registry',
    storage: './tmp/local-registry/storage',
    verbose: false,
  });

  const { workspaceVersion } = await releaseVersion({
    specifier: process.env.LOCAL_PUBLISH_VERSION ?? '0.0.0-local',
    stageChanges: false,
    gitCommit: false,
    gitTag: false,
    firstRelease: true,
    versionActionsOptionsOverrides: { skipLockFileUpdate: true },
  });

  await releasePublish({ tag: PUBLISH_TAG, firstRelease: true });

  console.log(`\nPublished @istomerf/nx-plugin-openapi@${workspaceVersion} to ${REGISTRY_URL} (tag: ${PUBLISH_TAG}).`);
  console.log('Install it into another workspace with:');
  console.log(`  npm install @istomerf/nx-plugin-openapi@${PUBLISH_TAG} --registry=${REGISTRY_URL}\n`);
  console.log('Registry is running in the foreground — press Ctrl+C to stop it.');

  await new Promise<void>((resolve) => {
    process.on('SIGINT', resolve);
    process.on('SIGTERM', resolve);
  });

  stopLocalRegistry();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
