import { resolveClientPreset } from './client-presets';

describe('resolveClientPreset', () => {
  it('resolves the angular preset', () => {
    expect(resolveClientPreset('angular')).toEqual({
      generator: 'typescript-angular',
      additionalProperties: 'ngVersion=17.0.0,providedInRoot=true',
    });
  });

  it('resolves the react preset', () => {
    expect(resolveClientPreset('react')).toEqual({
      generator: 'typescript-axios',
      additionalProperties: 'supportsES6=true,withInterfaces=true',
    });
  });

  it('resolves the vue preset', () => {
    expect(resolveClientPreset('vue')).toEqual({
      generator: 'typescript-fetch',
      additionalProperties: 'supportsES6=true,withSeparateModelsAndApi=true',
    });
  });

  it('resolves the node preset', () => {
    expect(resolveClientPreset('node')).toEqual({
      generator: 'typescript-node',
      additionalProperties: 'supportsES6=true',
    });
  });

  it('defaults to typescript-fetch with no additionalProperties for custom/unrecognized clients', () => {
    expect(resolveClientPreset('custom')).toEqual({
      generator: 'typescript-fetch',
      additionalProperties: undefined,
    });
  });

  it('defaults to typescript-fetch with no additionalProperties when client is undefined', () => {
    expect(resolveClientPreset(undefined)).toEqual({
      generator: 'typescript-fetch',
      additionalProperties: undefined,
    });
  });
});
