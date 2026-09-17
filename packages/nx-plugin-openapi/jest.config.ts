import type { Config } from 'jest';

module.exports = {
  displayName: 'nx-plugin-openapi',

  globals: {},
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]sx?$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.spec.json',
      },
    ],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  globalSetup: '<rootDir>/src/test-support/global-setup.ts',
  globalTeardown: '<rootDir>/src/test-support/global-teardown.ts',
  coverageDirectory: '../../coverage/packages/nx-plugin-openapi',
  preset: '../../jest.preset.js',
} satisfies Config;
