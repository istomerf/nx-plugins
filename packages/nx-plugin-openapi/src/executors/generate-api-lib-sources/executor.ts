import { ExecutorContext, logger } from '@nx/devkit';
import { deleteOutputDir } from '../../utils/delete-output-dir';
import { generateSources } from '../../utils/generate-sources';
import { GenerateApiLibSourcesExecutorSchema } from './schema';

export default async function runExecutor(
  options: GenerateApiLibSourcesExecutorSchema,
  context: ExecutorContext,
): Promise<{ success: boolean }> {
  const outputDir = options.outputDir
  const root = context.root;

  logger.info(`Deleting outputDir ${outputDir}...`);

  deleteOutputDir(root, outputDir);

  logger.info(`Done deleting outputDir ${outputDir}.`);

  await generateSources(options);

  return { success: true };
}
