import * as vscode from 'vscode';
import { discoverServices, type NestService } from './discovery';
import { NestProcessTerminal, type ProcessStatus } from './terminal';
import { ServicesWebviewProvider } from './servicesWebview';

interface Session {
  pty: NestProcessTerminal;
  terminal: vscode.Terminal;
  status: ProcessStatus;
}

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const sessions = new Map<string, Session>();
  let services: NestService[] = [];
  let provider: ServicesWebviewProvider;
  let refreshRunning = false;
  let refreshAgain = false;
  let watchReadyAt = 0;
  const statusOf = (id: string): ProcessStatus => sessions.get(id)?.status ?? 'stopped';

  function requireTrust(): boolean {
    if (vscode.workspace.isTrusted) return true;
    void vscode.window.showWarningMessage('Trust this workspace before running NestJS services.');
    return false;
  }

  async function refresh(): Promise<void> {
    // Watcher events during startup would otherwise start a second scan,
    // flash the top progress bar, and then hide it.
    if (refreshRunning) {
      refreshAgain = true;
      return;
    }
    refreshRunning = true;
    provider.setScanning(true);
    let errorMessage: string | null = null;
    try {
      do {
        refreshAgain = false;
        errorMessage = null;
        try {
          services = await discoverServices();
        } catch (error) {
          services = [];
          errorMessage = 'Unable to scan this workspace. Check the folder and try again.';
          console.error('[NestJS Service Manager] Service discovery failed:', error);
        }
      } while (refreshAgain);
      provider.setScanning(false, errorMessage);
    } finally {
      refreshRunning = false;
    }
  }

  async function start(service: NestService): Promise<void> {
    if (!requireTrust()) return;
    const existing = sessions.get(service.id);
    if (existing && existing.status !== 'stopped') {
      existing.terminal.show(false);
      return;
    }
    if (existing) {
      sessions.delete(service.id);
      existing.terminal.dispose();
    }
    const pty = new NestProcessTerminal(service, status => {
      const session = sessions.get(service.id);
      if (session?.pty === pty) {
        session.status = status;
        provider.update();
      }
    });
    const terminal = vscode.window.createTerminal({ name: `Nest: ${service.name}`, pty });
    sessions.set(service.id, { pty, terminal, status: 'starting' });
    provider.update();
    terminal.show(true);
  }

  async function stop(service: NestService): Promise<void> {
    const current = sessions.get(service.id);
    if (current) await current.pty.stop();
    provider.update();
  }

  async function restart(service: NestService): Promise<void> {
    await stop(service);
    await start(service);
  }

  async function stopAll(): Promise<void> {
    await Promise.all([...sessions.values()].map(session => session.pty.stop()));
    provider.update();
  }

  function logs(service: NestService): void {
    const current = sessions.get(service.id);
    if (current && current.status !== 'stopped') current.terminal.show(false);
  }

  provider = new ServicesWebviewProvider({
    list: () => services,
    status: statusOf,
    refresh,
    start,
    stop,
    restart,
    logs,
    startAll: async () => { for (const service of services) await start(service); },
    stopAll
  }, context.extensionUri);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('nestjsServices.view', provider, {
      webviewOptions: { retainContextWhenHidden: true }
    }),
    vscode.window.registerWebviewViewProvider('nestjsServices.explorerView', provider, {
      webviewOptions: { retainContextWhenHidden: true }
    }),
    vscode.commands.registerCommand('nestjsServices.open', async () => {
      await vscode.commands.executeCommand('workbench.view.explorer');
      await vscode.commands.executeCommand('nestjsServices.explorerView.focus');
    }),
    vscode.commands.registerCommand('nestjsServices.diagnostics', async () => {
      await refresh();
      const folders = vscode.workspace.workspaceFolders?.map(f => f.uri.fsPath) ?? [];
      const msg = `NestJS Service Manager is active. Workspace: ${folders.join(', ') || '(none)'}. Applications detected: ${services.length}.`;
      await vscode.window.showInformationMessage(msg);
    }),
    vscode.commands.registerCommand('nestjsServices.refresh', refresh),
    vscode.commands.registerCommand('nestjsServices.start', start),
    vscode.commands.registerCommand('nestjsServices.stop', stop),
    vscode.commands.registerCommand('nestjsServices.restart', restart),
    vscode.commands.registerCommand('nestjsServices.logs', logs),
    vscode.commands.registerCommand('nestjsServices.startAll', async () => {
      for (const service of services) await start(service);
    }),
    vscode.commands.registerCommand('nestjsServices.stopAll', stopAll),
    vscode.window.onDidCloseTerminal(terminal => {
      for (const [id, session] of sessions) {
        if (session.terminal === terminal) {
          void session.pty.stop();
          sessions.delete(id);
          provider.update();
          break;
        }
      }
    })
  );

  const watcher = vscode.workspace.createFileSystemWatcher('**/nest-cli.json');
  const onWatch = () => {
    if (Date.now() < watchReadyAt) return;
    void refresh();
  };
  context.subscriptions.push(watcher);
  watcher.onDidCreate(onWatch, undefined, context.subscriptions);
  watcher.onDidChange(onWatch, undefined, context.subscriptions);
  watcher.onDidDelete(onWatch, undefined, context.subscriptions);
  context.subscriptions.push(vscode.workspace.onDidChangeWorkspaceFolders(() => void refresh()));
  await refresh();
  watchReadyAt = Date.now() + 1500;
  console.info(`[NestJS Service Manager] Webview activated, detected ${services.length} applications`);

  context.subscriptions.push({ dispose: () => {
    for (const session of sessions.values()) {
      void session.pty.stop();
      session.terminal.dispose();
    }
    sessions.clear();
  }});
}

export function deactivate(): void { /* Disposables handle cleanup. */ }
