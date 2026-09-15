export interface GenerateApiLibSourcesExecutorSchema {
  generator: string;
  outputDir: string | "typescript-angular" | "spring";
  sourceSpecPathOrUrl: string;
  useDockerBuild?: boolean;
  sourceSpecUrlAuthorizationHeaders?: string;
  additionalProperties?: string;
  globalProperties?: string;
  typeMappings?: string;
  silent?: boolean;
  ignoreList?: string[];
}
