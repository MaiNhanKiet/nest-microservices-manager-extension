import * as fs from 'node:fs';
import * as path from 'node:path';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import * as vscode from 'vscode';
import type { NestService } from './discovery';

export type ProcessStatus = 'starting' | 'running' | 'stopped';

function resolveNestCli(root: string): string | undefined {
  const local = path.join(root, 'node_modules', '@nestjs', 'cli', 'bin', 'nest.js');
  if (fs.existsSync(local)) return local;
  try {
    return require.resolve('@nestjs/cli/bin/nest.js', { paths: [root] }) as string;
  } catch {
    return undefined;
  }
}

function killTree(pid: number): void {
  if (process.platform === 'win32') {
    const killer = spawn('taskkill', ['/PID', String(pid), '/T', '/F'], { windowsHide: true });
    killer.on('error', () => { try { process.kill(pid); } catch { /* Exited */ } });
  } else {
    try { process.kill(-pid, 'SIGTERM'); }
    catch { try { process.kill(pid, 'SIGTERM'); } catch { /* Exited */ } }
  }
}

/** Native Cursor terminal displaying stdout/stderr from a real Node child process. */
export class NestProcessTerminal implements vscode.Pseudoterminal {
  private readonly writes = new vscode.EventEmitter<string>();
  readonly onDidWrite = this.writes.event;
  private child: ChildProcessWithoutNullStreams | undefined;
  private exited = true;
  private stopPending: Promise<void> | undefined;

  constructor(
    private readonly service: NestService,
    private readonly notify: (status: ProcessStatus) => void
  ) {}

  open(): void {
    const bin = resolveNestCli(this.service.root);
    if (!bin) {
      this.write('Nest CLI not installed in this project. Run npm install (or your package manager install) first.\n');
      this.notify('stopped');
      return;
    }
    const settings = vscode.workspace.getConfiguration('nestjsServices');
    const nodePath = settings.get<string>('nodePath', 'node');
    const watch = settings.get<boolean>('watch', true);
    const args = [bin, 'start', ...(this.service.project ? [this.service.project] : []), ...(watch ? ['--watch'] : [])];
    this.write(`$ ${nodePath} ${args.map(a => JSON.stringify(a)).join(' ')}\n`);
    this.exited = false;
    this.notify('starting');
    const child = spawn(nodePath, args, {
      cwd: this.service.root,
      shell: false,
      windowsHide: true,
      detached: process.platform !== 'win32',
      env: process.env,
      stdio: 'pipe'
    });
    this.child = child;
    child.stdout.on('data', (chunk: Buffer) => this.write(chunk.toString('utf8')));
    child.stderr.on('data', (chunk: Buffer) => this.write(chunk.toString('utf8')));
    child.once('spawn', () => this.notify('running'));
    child.once('error', err => this.write(`Failed to start: ${err.message}\nCheck Settings → NestJS Service Manager → Node Path.\n`));
    child.once('close', (code, signal) => {
      this.exited = true;
      this.child = undefined;
      this.write(`\n[Process exited: ${signal ?? code ?? 'unknown'}]\n`);
      this.notify('stopped');
    });
  }

  close(): void { void this.stop(); }

  handleInput(input: string): void {
    if (input.includes('\u0003')) { void this.stop(); return; }
    if (this.child && !this.child.stdin.destroyed) this.child.stdin.write(input);
  }

  async stop(): Promise<void> {
    if (this.exited || !this.child) return;
    if (this.stopPending) return this.stopPending;
    const child = this.child;
    this.stopPending = new Promise<void>(resolve => {
      const timeout = setTimeout(() => {
        if (!this.exited && child.pid) {
          if (process.platform === 'win32') killTree(child.pid);
          else { try { process.kill(-child.pid, 'SIGKILL'); } catch { /* Exited */ } }
        }
        resolve();
      }, 2500);
      child.once('close', () => { clearTimeout(timeout); resolve(); });
      if (child.pid) killTree(child.pid);
      else { try { child.kill(); } catch { /* Exited */ } }
    }).finally(() => { this.stopPending = undefined; });
    return this.stopPending;
  }

  private write(message: string): void {
    this.writes.fire(message.replace(/\r?\n/g, '\r\n'));
  }
}
