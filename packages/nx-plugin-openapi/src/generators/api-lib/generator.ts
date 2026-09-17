import {
  addProjectConfiguration,
  formatFiles,
  generateFiles,
  GeneratorCallback,
  getWorkspaceLayout,
  joinPathFragments,
  logger,
  names,
  offsetFromRoot,
  ProjectType,
  readNxJson,
  runTasksInSerial,
  Tree,
  updateJson,
} from '@nx/devkit';
import { join } from 'path';
import type { SetRequired } from 'type-fest';
import { GenerateApiLibSourcesExecutorSchema } from '../../executors/generate-api-lib-sources/schema';
import init from '../init/generator';
import { ApiLibGeneratorSchema } from './schema';

const projectType: ProjectType = 'library';

interface NormalizedSchema extends SetRequired<ApiLibGeneratorSchema, 'importPath' | 'apiGenerator'> {
  projectName: string;
  projectRoot: string;
  outputDir: string;
  projectRootApiSpecLib?: string;
  projectDirectory: string;
  parsedTags: string[];
}

export default async function (tree: Tree, schema: ApiLibGeneratorSchema) {
  const tasks: GeneratorCallback[] = [];

  const options = normalizeOptions(tree, schema);

  // Init
  const initTask = await init(tree, { skipBootstrap: true });
  tasks.push(initTask);

  // Add Project
  addProject(tree, options);

  // Create files
  createFiles(tree, options);

  // Update TS config
  updateTsConfig(tree, options);

  // Format
  if (!schema.skipFormat) {
    await formatFiles(tree);
  }

  return runTasksInSerial(...tasks);
}

function normalizeOptions(host: Tree, options: ApiLibGeneratorSchema): NormalizedSchema {
  const name = names(options.name).fileName;
  const projectDirectory = options.directory ? `${names(options.directory).fileName}/${name}` : name;
  const projectName = projectDirectory.replace(new RegExp('/', 'g'), '-');
  const { libsDir, npmScope } = Object.assign({ npmScope: '' }, getWorkspaceLayout(host));
  const projectRoot = joinPathFragments(`${libsDir}/${projectDirectory}`);
  const outputDir = projectRoot + '/openapi-generated-sources';
  const workspaceLayout = readNxJson(host)?.workspaceLayout ?? { libsDir: 'libs' };
  const projectRootApiSpecLib =
    !options.isRemoteSpec && options.sourceSpecLib ? `${workspaceLayout.libsDir}/${options.sourceSpecLib}` : undefined;
  const parsedTags = options.tags ? options.tags.split(',').map((s) => s.trim()) : [];
  const importPath = options.importPath || `@${npmScope}/${projectDirectory}`;

  return {
    ...options,
    apiGenerator: options.apiGenerator,
    additionalProperties: options.additionalProperties,
    importPath,
    projectName,
    projectRoot,
    outputDir,
    projectRootApiSpecLib,
    projectDirectory,
    parsedTags,
  };
}

const getExecutorOptions = (options: NormalizedSchema): GenerateApiLibSourcesExecutorSchema => {
  let sourceSpecPathOrUrl = [options.projectRootApiSpecLib, options.sourceSpecFileRelativePath].join('/');
  if (options.isRemoteSpec) {
    if (typeof options.sourceSpecUrl === 'string') {
      sourceSpecPathOrUrl = options.sourceSpecUrl;
    }
    else {
      throw new Error('sourceSpecUrl must be a string');
    }
  }
  const executorOptions: GenerateApiLibSourcesExecutorSchema = {
    useDockerBuild: options.useDockerBuild,
    generator: options.apiGenerator,
    outputDir: options.outputDir,
    sourceSpecPathOrUrl: sourceSpecPathOrUrl,
    additionalProperties: options.additionalProperties,
    globalProperties: options.globalProperties,
  };

  if (options.isRemoteSpec && options.sourceSpecUrlAuthorizationHeaders) {
    executorOptions.sourceSpecUrlAuthorizationHeaders = options.sourceSpecUrlAuthorizationHeaders;
  }

  return executorOptions;
};

const addProject = (host: Tree, options: NormalizedSchema) => {
  const executorOptions = getExecutorOptions(options);
  const isLocalSpec = !options.isRemoteSpec && !!options.sourceSpecLib;

  addProjectConfiguration(host, options.projectName, {
    root: options.projectRoot,
    sourceRoot: joinPathFragments(options.projectRoot, 'src'),
    projectType,
    targets: {
      'generate-sources': {
        executor: '@istomerf/nx-plugin-openapi:generate-api-lib-sources',
        options: executorOptions,
      },
      ...(isLocalSpec
        ? {
            'watch-sources': {
              executor: '@istomerf/nx-plugin-openapi:watch-api-lib-sources',
              options: executorOptions,
            },
          }
        : {}),
    },
    implicitDependencies: !options.isRemoteSpec && options.sourceSpecLib ? [options.sourceSpecLib] : undefined,
    tags: options.parsedTags,
  });
};

function createFiles(host: Tree, options: NormalizedSchema) {
  generateFiles(host, join(__dirname, './files'), options.projectRoot, {
    ...options,
    ...names(options.name),
    dot: '.',
    tmpl: '',
    offsetFromRoot: offsetFromRoot(options.projectRoot),
  });
}

function updateTsConfig(host: Tree, options: NormalizedSchema): void {
  if (!host.exists('tsconfig.base.json')) {
    return logger.debug('No tsconfig.base.json found, skipping update.');
  }

  updateJson(host, 'tsconfig.base.json', (json) => {
    const compilerOptions = json.compilerOptions;
    compilerOptions.paths = compilerOptions.paths || {};
    delete compilerOptions.paths[options.name];
    if (compilerOptions.paths[options.importPath]) {
      throw new Error(
        `You already have a library using the import path "${options.importPath}". Make sure to specify a unique one.`,
      );
    }

    const { libsDir } = getWorkspaceLayout(host);
    compilerOptions.paths[options.importPath] = [`${libsDir}/${options.projectDirectory}/src/index.ts`];

    return json;
  });
}
