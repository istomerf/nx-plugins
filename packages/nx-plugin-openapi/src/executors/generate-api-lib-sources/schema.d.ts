export interface GenerateApiLibSourcesExecutorSchema {
  generator: string;
  outputDir: string;
  sourceSpecPathOrUrl: string;
  useDockerBuild?: boolean;
  sourceSpecUrlAuthorizationHeaders?: string;
  additionalProperties?: string;
  globalProperties?: string;
  typeMappings?: string;
  silent?: boolean;
  ignoreList?: string[];
}
