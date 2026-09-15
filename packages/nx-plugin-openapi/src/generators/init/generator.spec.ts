// Nrwl
import { Tree, getProjects, readJson, readProjectConfiguration } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';

// Generator
import libraryGenerator from './generator';

describe('init schematic', () => {
  let appTree: Tree;

  beforeEach(() => {
    appTree = createTreeWithEmptyWorkspace();
  });

  it('should add openapi dep to package.json if not already present', async () => {
    await libraryGenerator(appTree, { skipBootstrap: true });
    const packageJson = readJson(appTree, '/package.json');

    expect(packageJson).toMatchObject({
      dependencies: {},
      devDependencies: {
        '@openapitools/openapi-generator-cli': expect.anything(),
      },
    });
  });

  it('should bootstrap a default api-spec/api-lib pair by default', async () => {
    await libraryGenerator(appTree);

    const projects = getProjects(appTree);
    expect(projects.has('api-spec')).toBe(true);
    expect(projects.has('api-client')).toBe(true);

    expect(appTree.exists('libs/api-spec/src/api-spec.openapi.yml')).toBe(true);

    const apiLib = readProjectConfiguration(appTree, 'api-client');
    expect(apiLib.targets?.['generate-sources'].options).toMatchObject({
      sourceSpecPathOrUrl: 'libs/api-spec/src/api-spec.openapi.yml',
    });
  });

  it('should bootstrap under custom names when provided', async () => {
    await libraryGenerator(appTree, { apiSpecName: 'petstore-spec', apiLibName: 'petstore-client' });

    const projects = getProjects(appTree);
    expect(projects.has('petstore-spec')).toBe(true);
    expect(projects.has('petstore-client')).toBe(true);
  });

  it('should not bootstrap when skipBootstrap is set', async () => {
    await libraryGenerator(appTree, { skipBootstrap: true });

    const projects = getProjects(appTree);
    expect(projects.has('api-spec')).toBe(false);
    expect(projects.has('api-client')).toBe(false);
  });

  it('should skip bootstrapping without failing if a project already exists', async () => {
    await libraryGenerator(appTree, { apiSpecName: 'api-spec', skipBootstrap: false });
    // Running it again should not throw, even though "api-spec" now already exists.
    await expect(libraryGenerator(appTree)).resolves.not.toThrow();
  });
});
