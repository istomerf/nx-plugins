/**
 * This script starts a local registry for e2e testing purposes.
 * It is meant to be called in jest's globalSetup.
 */
import { publishToLocalRegistry } from './local-registry';

export default async () => {
  const { stopLocalRegistry } = await publishToLocalRegistry({
    tag: 'e2e',
    version: '0.0.0-e2e',
    // the e2e target's `dependsOn: ["^build"]` already builds the plugin first
    build: false,
  });

  // @ts-expect-error
  global.stopLocalRegistry = stopLocalRegistry;
};
