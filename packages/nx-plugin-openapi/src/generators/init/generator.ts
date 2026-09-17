import {
  GeneratorCallback,
  Tree,
  addDependenciesToPackageJson,
  formatFiles,
  getProjects,
  logger,
  names,
  runTasksInSerial,
} from '@nx/devkit';
import apiLibGenerator from '../api-lib/generator';
import apiSpecGenerator from '../api-spec/generator';
import { openapiGeneratorCliVersion } from '../../utils/versions';
import { resolveClientPreset } from './client-presets';
import { InitGeneratorSchema } from './schema';

const DEFAULT_API_SPEC_NAME = 'api-spec';
const DEFAULT_API_LIB_NAME = 'api-client';

export default async function (tree: Tree, schema: InitGeneratorSchema = {}) {
  const tasks: GeneratorCallback[] = [];

  const addDependenciesTask = addDependenciesToPackageJson(
    tree,
    {},
    { '@openapitools/openapi-generator-cli': openapiGeneratorCliVersion },
  );
  tasks.push(addDependenciesTask);

  if (!schema.skipBootstrap) {
    const bootstrapTask = await bootstrap(tree, schema);
    if (bootstrapTask) {
      tasks.push(bootstrapTask);
    }
  }

  if (!schema.skipFormat) {
    await formatFiles(tree);
  }

  return runTasksInSerial(...tasks);
}

async function bootstrap(tree: Tree, schema: InitGeneratorSchema): Promise<GeneratorCallback | undefined> {
  const apiSpecName = schema.apiSpecName || DEFAULT_API_SPEC_NAME;
  const apiLibName = schema.apiLibName || DEFAULT_API_LIB_NAME;
  const apiSpecProjectName = names(apiSpecName).fileName;
  const apiLibProjectName = names(apiLibName).fileName;

  const projects = getProjects(tree);
  if (projects.has(apiSpecProjectName) || projects.has(apiLibProjectName)) {
    logger.warn(
      `Skipping bootstrap: a project named "${apiSpecProjectName}" or "${apiLibProjectName}" already exists. ` +
        'Pass --apiSpecName/--apiLibName to bootstrap under different names, or run the api-spec/api-lib generators directly.',
    );
    return undefined;
  }

  const tasks: GeneratorCallback[] = [];

  tasks.push(
    await apiSpecGenerator(tree, {
      name: apiSpecName,
      withSample: true,
      skipFormat: true,
    }),
  );

  const { generator, additionalProperties } = resolveClientPreset(schema.client);

  tasks.push(
    await apiLibGenerator(tree, {
      name: apiLibName,
      isRemoteSpec: false,
      apiGenerator: generator,
      additionalProperties,
      useDockerBuild: schema.useDockerBuild ?? false,
      sourceSpecLib: apiSpecProjectName,
      sourceSpecFileRelativePath: `src/${apiSpecName}.openapi.yml`,
      skipFormat: true,
    }),
  );

  logger.info(
    `Bootstrapped "${apiSpecProjectName}" (OpenAPI spec) and "${apiLibProjectName}" (generated client).\n` +
      `Run "nx run ${apiLibProjectName}:generate-sources" to generate the client sources.`,
  );

  return runTasksInSerial(...tasks);
}
