import { resolveClientOptions } from './client-presets';

describe('resolveClientOptions', () => {
  it('defaults to typescript-fetch when no client or generator is given', () => {
    expect(resolveClientOptions(undefined, undefined, undefined)).toEqual({
      generator: 'typescript-fetch',
      additionalProperties: undefined,
    });
  });

  it('ignores presets when client is "custom"', () => {
    expect(resolveClientOptions('custom', undefined, undefined)).toEqual({
      generator: 'typescript-fetch',
      additionalProperties: undefined,
    });
  });

  it('resolves the generator and additionalProperties from a client preset', () => {
    expect(resolveClientOptions('angular', undefined, undefined)).toEqual({
      generator: 'typescript-angular',
      additionalProperties: 'ngVersion=17.0.0,providedInRoot=true',
    });
  });

  it('lets an explicit generator override the preset generator', () => {
    expect(resolveClientOptions('angular', 'typescript-fetch', undefined)).toEqual({
      generator: 'typescript-fetch',
      additionalProperties: 'ngVersion=17.0.0,providedInRoot=true',
    });
  });

  it('merges explicit additionalProperties on top of the preset, with explicit values winning on conflicts', () => {
    expect(resolveClientOptions('angular', undefined, 'providedInRoot=false,npmName=my-sdk')).toEqual({
      generator: 'typescript-angular',
      additionalProperties: 'ngVersion=17.0.0,providedInRoot=false,npmName=my-sdk',
    });
  });
});
