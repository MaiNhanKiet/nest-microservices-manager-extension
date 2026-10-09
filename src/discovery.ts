import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { servicesFromConfig, type NestService, type NestConfig } from './parser';
export type { NestService } from './parser';

/** Finds standard Nest projects and Nest CLI monorepos (not Nx-specific config). */
export async function discoverServices(): Promise<NestService[]> {
  const files = await vscode.workspace.findFiles(
    '**/nest-cli.json',
    '**/{node_modules,dist,build,.git,.turbo}/**',
    150
  );
  const found: NestService[] = [];
  for (const file of files) {
    if (file.scheme !== 'file') continue;
    try {
      const data = JSON.parse(await fs.readFile(file.fsPath, 'utf8')) as NestConfig;
      const root = path.dirname(file.fsPath);
      let packageName: string | undefined;
      try {
        const pkg = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8')) as { name?: string };
        packageName = pkg.name;
      } catch { /* Use directory name when package.json is missing. */ }
      found.push(...servicesFromConfig(data, file.fsPath, packageName));
    } catch (e) {
      console.warn(`[NestJS Service Manager] Unable to parse ${file.fsPath}:`, e);
    }
  }
  return found.sort((a, b) => a.name.localeCompare(b.name));
}
