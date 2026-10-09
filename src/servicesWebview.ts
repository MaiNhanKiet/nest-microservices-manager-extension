import * as crypto from 'node:crypto';
import { existsSync } from 'node:fs';
import * as vscode from 'vscode';
import type { NestService } from './discovery';
import type { ProcessStatus } from './terminal';

export interface ServiceActions {
  list(): NestService[];
  status(id: string): ProcessStatus;
  refresh(): Promise<void>;
  start(service: NestService): Promise<void>;
  stop(service: NestService): Promise<void>;
  restart(service: NestService): Promise<void>;
  logs(service: NestService): void;
  startAll(): Promise<void>;
  stopAll(): Promise<void>;
}

type Message = { action?: string; id?: string };

export class ServicesWebviewProvider implements vscode.WebviewViewProvider {
  private readonly views = new Set<vscode.WebviewView>();
  private scanning = true;
  private scanError: string | null = null;

  constructor(
    private readonly actions: ServiceActions,
    private readonly extensionUri: vscode.Uri
  ) {}

  resolveWebviewView(view: vscode.WebviewView): void {
    this.views.add(view);
    view.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, 'media')]
    };
    view.webview.html = this.html(view.webview);
    view.onDidDispose(() => this.views.delete(view));
    view.onDidChangeVisibility(() => {
      if (view.visible) this.send(view);
    });
    view.webview.onDidReceiveMessage((data: Message) => this.handle(data, view));
    this.send(view);
  }

  update(): void {
    for (const view of this.views) this.send(view);
  }

  setScanning(scanning: boolean, error: string | null = null): void {
    this.scanning = scanning;
    this.scanError = error;
    this.update();
  }

  private send(view: vscode.WebviewView): void {
    void view.webview.postMessage({
      type: 'services',
      scanning: this.scanning,
      scanError: this.scanError,
      items: this.actions.list().map(service => ({
        id: service.id,
        name: service.name,
        status: this.actions.status(service.id)
      }))
    });
  }

  private async handle(data: Message, view: vscode.WebviewView): Promise<void> {
    if (!data || typeof data.action !== 'string') return;

    try {
      if (data.action === 'ready') { this.send(view); return; }
      if (data.action === 'refresh') { await this.actions.refresh(); return; }
      if (data.action === 'openFolder') {
        // Native folder picker; opening the selected folder reloads the host window.
        const folders = await vscode.window.showOpenDialog({
          canSelectFolders: true,
          canSelectFiles: false,
          canSelectMany: false,
          openLabel: 'Open NestJS Backend'
        });
        if (folders?.length) {
          await vscode.commands.executeCommand('vscode.openFolder', folders[0]);
        }
        return;
      }
      if (data.action === 'startAll') { await this.actions.startAll(); return; }
      if (data.action === 'stopAll') { await this.actions.stopAll(); return; }
      if (typeof data.id !== 'string') return;

      const service = this.actions.list().find(item => item.id === data.id);
      if (!service) return;
      const status = this.actions.status(service.id);
      switch (data.action) {
        case 'toggle':
          if (status === 'stopped') await this.actions.start(service);
          else await this.actions.stop(service);
          break;
        case 'logs':
          if (status !== 'stopped') this.actions.logs(service);
          break;
        case 'restart':
          if (status !== 'stopped') await this.actions.restart(service);
          break;
      }
    } catch (err) {
      void vscode.window.showErrorMessage(`NestJS Services: ${String(err)}`);
    } finally {
      this.update();
    }
  }

  private html(webview: vscode.Webview): string {
    const nonce = crypto.randomBytes(16).toString('base64');
    const bundleUri = vscode.Uri.joinPath(this.extensionUri, 'media', 'webview.bundle.js');
    // The extension host can compile without the separate browser bundle.
    // Never show a silently empty panel when that bundle is missing.
    if (!existsSync(bundleUri.fsPath)) {
      return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${nonce}';">
<style nonce="${nonce}">
body { margin: 0; padding: 18px 13px; color: var(--vscode-foreground); background: transparent;
font: 12px/1.6 var(--vscode-font-family); text-align: center; }
.title { font-weight: 600; margin-bottom: 5px; }
.detail { color: var(--vscode-descriptionForeground); margin-bottom: 12px; }
code { display: block; padding: 8px; margin: 8px auto; text-align: left;
background: var(--vscode-editorWidget-background, #292929); border-radius: 5px; }
</style></head><body><div class="title">NestJS Services UI is not built yet</div>
<div class="detail">The browser bundle is missing. Run these commands in the extension project, then reload the Extension Development Host.</div>
<code>npm install<br>npm run compile</code>
<div class="detail">Expected file: media/webview.bundle.js</div></body></html>`;
    }
    const scriptUri = webview.asWebviewUri(bundleUri);
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}' ${webview.cspSource};">
<style nonce="${nonce}">
:root { --run: #22c55e; --stop: #ef4444; }
* { box-sizing: border-box; }
body { margin: 0; color: var(--vscode-foreground); background: transparent;
  font-family: var(--vscode-font-family); font-size: var(--vscode-font-size); }
.toolbar { display: flex; align-items: center; justify-content: space-between;
  min-height: 30px; padding: 3px 5px 4px 9px; gap: 4px; }
.heading { font-weight: 600; font-size: 11px; letter-spacing: .3px;
  overflow: hidden; white-space: nowrap; text-overflow: ellipsis; opacity: .8; }
.buttons, .row-actions { display: flex; align-items: center; flex-shrink: 0; }
button { appearance: none; background: transparent; color: var(--vscode-foreground);
  border: 0; border-radius: 4px; padding: 2px 4px; cursor: pointer; font: inherit; }
button:hover { background: var(--vscode-toolbar-hoverBackground, var(--vscode-list-hoverBackground)); }
button:focus-visible { outline: 1px solid var(--vscode-focusBorder); outline-offset: -1px; }
button:disabled { opacity: .35; cursor: default; }
.icon { width: 23px; height: 23px; display: inline-flex; align-items: center; justify-content: center; }
.icon svg { width: 15px; height: 15px; display: block; }
.run { color: var(--run) !important; }
.stop { color: var(--stop) !important; }
.toolbar-action { color: #ffffff !important; }
.service-toggle { transition: color 180ms ease; }
.items { padding: 0 3px; }
.items[hidden] { display: none !important; }
.row { position: relative; display: flex; align-items: center; width: 100%; min-height: 23px;
  border-radius: 3px; padding-left: 5px; gap: 2px; background: transparent;
  transition: background-color 120ms ease; }
/* Active: only the selected row is highlighted, with no left accent bar. */
.row.selected { background: rgba(34, 197, 94, .08); }
/* Hover: temporary emphasis on the hovered row. The selected row stays highlighted. */
.row:hover { background: var(--vscode-list-hoverBackground, rgba(255, 255, 255, .10)); }
.row.selected:hover { background: rgba(34, 197, 94, .14); }
.row > .service-name:hover, .row > .service-toggle:hover { background: transparent; }
.service-name { min-width: 0; flex: 1; text-align: left; white-space: nowrap;
  overflow: hidden; text-overflow: ellipsis; padding: 2px 3px; }
.row-actions { gap: 0; }
.row-actions button { opacity: 0; pointer-events: none; }
/* Keep actions accessible to keyboard focus, without lingering after mouse clicks. */
.row:hover .row-actions button, .row:has(:focus-visible) .row-actions button {
  opacity: 1; pointer-events: auto;
}
.row-actions button:disabled { opacity: 0 !important; pointer-events: none; }
/* Empty / error state when the workspace has no services. */
.scan-state { display: flex; align-items: center; flex-direction: column; gap: 7px;
  text-align: center; padding: 16px 10px 12px; }
.scan-state[hidden] { display: none !important; }
.scan-art { display: grid; place-items: center; width: 58px; height: 58px;
  border-radius: 16px; background: var(--vscode-editorWidget-background, rgba(128,128,128,.09));
  color: var(--vscode-descriptionForeground); }
.scan-art svg { width: 32px; height: 32px; stroke: currentColor; }
.scan-state[data-phase="error"] .scan-art { color: #ef4444; }
.scan-title { font-size: 12px; font-weight: 600; }
.scan-description { color: var(--vscode-descriptionForeground); font-size: 11px;
  line-height: 1.5; max-width: 275px; }
.scan-actions { display: flex; align-items: center; justify-content: center; gap: 7px; margin-top: 3px; }
.scan-actions button { padding: 5px 9px; font-size: 11px;
  background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground);
  border-radius: 4px; }
.scan-actions button:hover { background: var(--vscode-button-secondaryHoverBackground); }
@media (prefers-reduced-motion: reduce) { .service-toggle { transition: none; } }
</style>
</head>
<body>
<div class="toolbar">
  <span class="heading">MICROSERVICES</span>
  <div class="buttons">
    <button class="icon toolbar-action" id="refresh" aria-label="Refresh" title="Refresh"></button>
    <button class="icon toolbar-action" id="startAll" aria-label="Start All Services" title="Start All Services"></button>
    <button class="icon toolbar-action" id="stopAll" aria-label="Stop All Services" title="Stop All Services"></button>
  </div>
</div>
<div class="scan-state" id="scan-state" data-phase="empty" role="status">
  <div class="scan-art" id="scan-art" aria-hidden="true"></div>
  <div class="scan-title" id="scan-title">No NestJS services found</div>
  <div class="scan-description" id="scan-description">Open the backend folder containing nest-cli.json, check its projects, or click Refresh.</div>
  <div class="scan-actions" id="scan-actions">
    <button id="scan-refresh" type="button">Refresh</button>
    <button id="scan-folder" type="button">Open Folder</button>
  </div>
</div>
<div class="items" id="items"></div>
<script nonce="${nonce}" src="${scriptUri}"></script>
<script nonce="${nonce}">
  // Gracefully report browser startup failures (missing/corrupted scripts, errors).
  setTimeout(() => {
    if (window.__nestjsServicesUiReady) return;
    const title = document.getElementById('scan-title');
    const desc = document.getElementById('scan-description');
    if (title) title.textContent = 'Unable to load NestJS Services UI';
    if (desc) desc.textContent = 'Open Developer Tools for errors, then run npm install and npm run compile in the extension folder.';
  }, 3000);
</script>
</body>
</html>`;
  }
}
