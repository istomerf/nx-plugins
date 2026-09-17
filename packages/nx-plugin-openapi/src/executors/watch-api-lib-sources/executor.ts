import { ExecutorContext, logger } from '@nx/devkit';
import { generateSources } from '../../utils/generate-sources';
import { watchSpecFile } from '../../utils/watch-spec-file';
import { WatchApiLibSourcesExecutorSchema } from './schema';

const REMOTE_SPEC_PATTERN = /^https?:\/\//;

export default async function* runExecutor(
  options: WatchApiLibSourcesExecutorSchema,
  _context: ExecutorContext,
): AsyncGenerator<{ success: boolean }> {
  const { sourceSpecPathOrUrl } = options;

  if (REMOTE_SPEC_PATTERN.test(sourceSpecPathOrUrl)) {
    logger.error(
      `watch-api-lib-sources does not support remote specs. "${sourceSpecPathOrUrl}" looks like a URL - watch mode only works against a local spec file.`,
    );
    yield { success: false };
    return;
  }

  const handle = watchSpecFile(sourceSpecPathOrUrl, async () => {
    logger.info(`Spec file changed, regenerating sources for ${sourceSpecPathOrUrl}...`);
    try {
      await generateSources(options);
      logger.info(`Done regenerating sources for ${sourceSpecPathOrUrl}.`);
    } catch (err) {
      logger.error(`Failed to regenerate sources for ${sourceSpecPathOrUrl}: ${err}`);
    }
  });

  const stopWatching = () => {
    void handle.close();
  };
  process.once('SIGINT', stopWatching);
  process.once('SIGTERM', stopWatching);

  yield { success: true };

  // Keep this continuous task alive; Nx stops it by terminating the process.
  await new Promise<never>(() => undefined);
}
