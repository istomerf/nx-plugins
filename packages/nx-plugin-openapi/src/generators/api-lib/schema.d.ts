export interface ApiLibGeneratorSchema {
  name: string;
  useDockerBuild?: boolean;
  client?: 'custom' | 'angular' | 'react' | 'vue' | 'node';
  generator?: string;
  tags?: string;
  directory?: string;
  importPath?: string;
  isRemoteSpec: boolean;
  sourceSpecUrl?: string;
  sourceSpecUrlAuthorizationHeaders?: string;
  sourceSpecLib?: string;
  sourceSpecFileRelativePath?: string;
  additionalProperties?: string;
  globalProperties?: string;
  skipFormat?: boolean;
}
