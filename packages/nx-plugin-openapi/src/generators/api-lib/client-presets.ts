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
    generator: 'typescript-fetch',
    additionalProperties: 'supportsES6=true,withInterfaces=true',
  },
  vue: {
    generator: 'typescript-axios',
    additionalProperties: 'supportsES6=true,withSeparateModelsAndApi=true',
  },
  node: {
    generator: 'typescript-node',
    additionalProperties: 'supportsES6=true',
  },
};

const DEFAULT_GENERATOR = 'typescript-fetch';

function parseProperties(value?: string): Map<string, string> {
  const entries = (value ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [key, ...rest] = entry.split('=');
      return [key, rest.join('=')] as [string, string];
    });

  return new Map(entries);
}

function mergeProperties(base?: string, overrides?: string): string | undefined {
  const merged = parseProperties(base);
  for (const [key, value] of parseProperties(overrides)) {
    merged.set(key, value);
  }

  return merged.size ? Array.from(merged, ([key, value]) => `${key}=${value}`).join(',') : undefined;
}

export function resolveClientOptions(
  client: string | undefined,
  explicitGenerator: string | undefined,
  additionalProperties: string | undefined,
): { generator: string; additionalProperties?: string } {
  const preset = client && client !== 'custom' ? CLIENT_PRESETS[client] : undefined;

  return {
    generator: explicitGenerator || preset?.generator || DEFAULT_GENERATOR,
    additionalProperties: mergeProperties(preset?.additionalProperties, additionalProperties),
  };
}
