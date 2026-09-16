export interface ClientPreset {
  generator: string;
  additionalProperties?: string;
}

export const CLIENT_PRESETS: Record<string, ClientPreset> = {
  angular: {
    generator: 'typescript-angular',
    additionalProperties: 'ngVersion=17.0.0,providedInRoot=true',
  },
  react: {
    generator: 'typescript-axios',
    additionalProperties: 'supportsES6=true,withInterfaces=true',
  },
  vue: {
    generator: 'typescript-fetch',
    additionalProperties: 'supportsES6=true,withSeparateModelsAndApi=true',
  },
  node: {
    generator: 'typescript-node',
    additionalProperties: 'supportsES6=true',
  },
};

const DEFAULT_GENERATOR = 'typescript-fetch';

export function resolveClientPreset(client: string | undefined): { generator: string; additionalProperties?: string } {
  const preset = client && client !== 'custom' ? CLIENT_PRESETS[client] : undefined;

  return {
    generator: preset?.generator ?? DEFAULT_GENERATOR,
    additionalProperties: preset?.additionalProperties,
  };
}
