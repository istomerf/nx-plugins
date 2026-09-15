export interface InitGeneratorSchema {
  skipBootstrap?: boolean;
  apiSpecName?: string;
  apiLibName?: string;
  client?: 'custom' | 'angular' | 'react' | 'vue' | 'node';
  useDockerBuild?: boolean;
  skipFormat?: boolean;
}
