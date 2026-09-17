// Nrwl
import { ExecutorContext, logger } from '@nx/devkit';

// Third Parties
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

// Fixture
import {
  createFakeCliScenario,
  FakeCliScenario,
  readFakeCliArgs,
  removeFakeCliBinary,
  setFakeCliExitCode,
  setFakeCliStderr,
  setFakeCliStdout,
} from '../../test-support/fake-cli';

// Executor
import runExecutor from './executor';
import { GenerateApiLibSourcesExecutorSchema } from './schema';

function createContext(root: string): ExecutorContext {
  return { root } as unknown as ExecutorContext;
}

function baseOptions(
  scenario: FakeCliScenario,
  overrides: Partial<GenerateApiLibSourcesExecutorSchema> = {},
): GenerateApiLibSourcesExecutorSchema {
  return {
    generator: 'typescript-fetch',
    outputDir: scenario.outputDir,
    sourceSpecPathOrUrl: 'libs/my-api/spec.openapi.yml',
    silent: true,
    ...overrides,
  };
}

describe('generate-api-lib-sources executor (unmocked - real spawn, real fs)', () => {
  let root: string;
  let scenario: FakeCliScenario;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'executor-spec-root-'));
    scenario = createFakeCliScenario();
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
    rmSync(scenario.scratchDir, { recursive: true, force: true });
    jest.restoreAllMocks();
  });

  it('resolves { success: true } via npx by default, and creates outputDir', async () => {
    const result = await runExecutor(baseOptions(scenario), createContext(root));

    expect(result).toEqual({ success: true });
    expect(existsSync(scenario.outputDir)).toBe(true);
  });

  it('deletes a pre-existing outputDir before generation and recreates it', async () => {
    mkdirSync(scenario.outputDir, { recursive: true });
    const markerFile = join(scenario.outputDir, 'stale-from-previous-run.txt');
    writeFileSync(markerFile, 'stale');

    await runExecutor(baseOptions(scenario), createContext(root));

    expect(existsSync(markerFile)).toBe(false);
    expect(existsSync(scenario.outputDir)).toBe(true);
  });

  it('builds the base npx CLI args from required options only', async () => {
    const options = baseOptions(scenario);

    await runExecutor(options, createContext(root));

    expect(readFakeCliArgs(scenario)).toEqual([
      'openapi-generator-cli',
      'generate',
      '-i',
      options.sourceSpecPathOrUrl,
      '-g',
      options.generator,
      '-o',
      options.outputDir,
    ]);
  });

  it('appends each optional CLI flag only when provided', async () => {
    const ignoreList = ['.gitignore', '.openapi-generator'];
    const options = baseOptions(scenario, {
      additionalProperties: 'npmName=@proj/my-api',
      sourceSpecUrlAuthorizationHeaders: 'Authorization:Bearer%20token',
      typeMappings: 'DateTime=Date',
      globalProperties: 'modelDocs=false',
      ignoreList,
    });

    await runExecutor(options, createContext(root));

    expect(readFakeCliArgs(scenario)).toEqual([
      'openapi-generator-cli',
      'generate',
      '-i',
      options.sourceSpecPathOrUrl,
      '-g',
      options.generator,
      '-o',
      options.outputDir,
      '--additional-properties',
      options.additionalProperties,
      '--auth',
      options.sourceSpecUrlAuthorizationHeaders,
      '--type-mappings',
      options.typeMappings,
      '--global-property',
      options.globalProperties,
      '--openapi-generator-ignore-list',
      ignoreList.join(),
    ]);
  });

  it('invokes docker instead of npx when useDockerBuild is set', async () => {
    const options = baseOptions(scenario, { useDockerBuild: true });

    await runExecutor(options, createContext(root));

    expect(readFakeCliArgs(scenario)).toEqual([
      'run',
      '--rm',
      '-v',
      `${process.cwd()}:/local:rw`,
      '-w',
      '/local',
      'openapitools/openapi-generator-cli',
      'generate',
      '-i',
      options.sourceSpecPathOrUrl,
      '-g',
      options.generator,
      '-o',
      options.outputDir,
    ]);
  });

  describe('silent option', () => {
    beforeEach(() => {
      setFakeCliStdout(scenario, 'generator stdout line');
      setFakeCliStderr(scenario, 'generator stderr line');
    });

    it('suppresses stdout/stderr logging when silent is true', async () => {
      const infoSpy = jest.spyOn(logger, 'info');
      const errorSpy = jest.spyOn(logger, 'error');

      await runExecutor(baseOptions(scenario, { silent: true }), createContext(root));

      expect(infoSpy).not.toHaveBeenCalledWith(expect.stringContaining('generator stdout line'));
      expect(errorSpy).not.toHaveBeenCalledWith(expect.stringContaining('generator stderr line'));
    });

    it('logs stdout via logger.info and stderr via logger.error when not silent', async () => {
      const infoSpy = jest.spyOn(logger, 'info');
      const errorSpy = jest.spyOn(logger, 'error');

      await runExecutor(baseOptions(scenario, { silent: false }), createContext(root));

      expect(infoSpy).toHaveBeenCalledWith(expect.stringContaining('generator stdout line'));
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('generator stderr line'));
    });
  });

  it('rejects with the exit code when the CLI exits non-zero', async () => {
    setFakeCliExitCode(scenario, 5);

    await expect(runExecutor(baseOptions(scenario), createContext(root))).rejects.toBe(5);
  });

  it('rejects with a real spawn error when the command cannot be executed', async () => {
    const restore = removeFakeCliBinary('npx');

    try {
      await expect(runExecutor(baseOptions(scenario), createContext(root))).rejects.toMatchObject({
        code: 'ENOENT',
      });
    } finally {
      restore();
    }
  });
});
