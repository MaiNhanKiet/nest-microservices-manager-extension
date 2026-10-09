import * as path from 'node:path';

export interface NestService {
  id: string;
  name: string;
  /** Folder containing the nest-cli.json and node_modules */
  root: string;
  /** Nest CLI project name. Undefined for standard-mode projects. */
  project?: string;
  configPath: string;
}

interface ProjectConfig {
  type?: string;
  root?: string;
}

export interface NestConfig {
  projects?: Record<string, ProjectConfig>;
}

/** Pure function; unit tested without a Cursor instance. */
export function servicesFromConfig(
  config: NestConfig,
  configPath: string,
  packageName?: string
): NestService[] {
  const root = path.dirname(configPath);
  const projects = config.projects;
  if (projects && Object.keys(projects).length > 0) {
    return Object.entries(projects)
      .filter(([, details]) => details?.type === 'application')
      .map(([project]) => ({
        id: `${configPath}::${project}`,
        name: project,
        root,
        project,
        configPath
      }));
  }
  const name = packageName || path.basename(root);
  return [{ id: `${configPath}::default`, name, root, configPath }];
}

