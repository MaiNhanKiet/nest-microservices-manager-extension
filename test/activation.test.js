const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Module = require('node:module');

const disposable = { dispose() {} };
class EventEmitter {
  constructor() {
    this.listeners = new Set();
    this.event = listener => { this.listeners.add(listener); return disposable; };
  }
  fire(value) { for (const listener of this.listeners) listener(value); }
  dispose() { this.listeners.clear(); }
}

// Simulate the Extension Host's Webview messages. No browser UI is needed for these tests.
test('Webview View separates left toggle from name click and preserves terminal/restart actions', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nest-manager-webview-'));
  const configPath = path.join(root, 'nest-cli.json');
  fs.mkdirSync(path.join(root, 'media'), { recursive: true });
  fs.writeFileSync(path.join(root, 'media', 'webview.bundle.js'), '/* mocked browser bundle */');
  fs.writeFileSync(configPath, JSON.stringify({ projects: {
    api: { type: 'application', root: 'apps/api' },
    lib: { type: 'library', root: 'libs/lib' }
  }}));
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'test-backend' }));

  const providers = new Map();
  const commands = new Map();
  const executed = [];
  const shows = [];
  let starts = 0, stops = 0;

  class FakeTerminal {
    constructor(_service, notify) { this.notify = notify; }
    open() { starts++; this.notify('running'); }
    async stop() { stops++; this.notify('stopped'); }
    close() {}
  }

  const vscodeMock = {
    EventEmitter,
    Uri: { joinPath: (base, ...parts) => ({ fsPath: path.join(base.fsPath, ...parts) }) },
    window: {
      registerWebviewViewProvider(id, provider) { providers.set(id, provider); return disposable; },
      createTerminal(options) {
        let opened = false;
        return { show() { shows.push(options.name); if (!opened) { opened = true; options.pty.open(); } }, dispose() {} };
      },
      onDidCloseTerminal() { return disposable; },
      showInformationMessage: async message => message,
      showWarningMessage: async message => message,
      showErrorMessage: async message => { throw new Error(message); }
    },
    workspace: {
      isTrusted: true,
      workspaceFolders: [{ uri: { fsPath: root } }],
      async findFiles() { return [{ scheme: 'file', fsPath: configPath }]; },
      getConfiguration() { return { get: (_, def) => def }; },
      createFileSystemWatcher() { return { onDidCreate() { return disposable; }, onDidChange() { return disposable; }, onDidDelete() { return disposable; }, dispose() {} }; },
      onDidChangeWorkspaceFolders() { return disposable; }
    },
    commands: {
      registerCommand(name, fn) { commands.set(name, fn); return disposable; },
      async executeCommand(name) { executed.push(name); }
    }
  };

  const load = Module._load;
  Module._load = function(id, parent, isMain) {
    if (id === 'vscode') return vscodeMock;
    if (id === './terminal' && parent?.filename.endsWith('dist/extension.js')) {
      return { NestProcessTerminal: FakeTerminal };
    }
    return load.call(this, id, parent, isMain);
  };
  try {
    delete require.cache[require.resolve('../dist/extension.js')];
    delete require.cache[require.resolve('../dist/servicesWebview.js')];
    const { activate } = require('../dist/extension.js');
    const context = { subscriptions: [], extensionUri: { fsPath: root } };
    await activate(context);

    assert.ok(providers.has('nestjsServices.view'));
    assert.ok(providers.has('nestjsServices.explorerView'));
    const provider = providers.get('nestjsServices.view');
    let receive;
    const sent = [];
    const view = {
      visible: true,
      webview: {
        cspSource: 'vscode-webview://test',
        asWebviewUri: uri => `vscode-webview://test/${path.basename(uri.fsPath)}`, 
        postMessage(message) { sent.push(message); return Promise.resolve(true); },
        onDidReceiveMessage(fn) { receive = fn; return disposable; }
      },
      onDidDispose() { return disposable; },
      onDidChangeVisibility() { return disposable; }
    };
    provider.resolveWebviewView(view);
    assert.match(view.webview.html, /class="icon toolbar-action" id="refresh"/);
    assert.match(view.webview.html, /webview\.bundle\.js/);
    const browserJs = fs.readFileSync(path.join(__dirname, '..', 'media', 'webview.js'), 'utf8');
    assert.match(browserJs, /name\.addEventListener\('click'/);
    assert.match(browserJs, /createMorph/);
    assert.match(browserJs, /ListX/);
    assert.match(browserJs, /'toggle'/);
    await receive({ action: 'ready' });
    assert.equal(sent.at(-1).items.length, 1);
    assert.equal(sent.at(-1).items[0].status, 'stopped');

    const serviceId = sent.at(-1).items[0].id;
    await receive({ action: 'logs', id: serviceId });
    assert.equal(starts, 0, 'name click on stopped service cannot start process');
    assert.equal(shows.length, 0);

    await receive({ action: 'toggle', id: serviceId });
    assert.equal(starts, 1, 'only toggle starts stopped service');
    assert.equal(sent.at(-1).items[0].status, 'running');
    await receive({ action: 'logs', id: serviceId });
    assert.equal(starts, 1, 'clicking a running service does not restart it');
    assert.equal(shows.length, 2, 'logs opens existing terminal');

    await receive({ action: 'restart', id: serviceId });
    assert.equal(stops, 1);
    assert.equal(starts, 2);
    await receive({ action: 'toggle', id: serviceId });
    assert.equal(stops, 2);
    assert.equal(sent.at(-1).items[0].status, 'stopped');
    await receive({ action: 'toggle', id: '__unknown_id__' });
    assert.equal(starts, 2, 'invalid ID cannot execute commands');
    await receive({ action: 'restartAll' });
    assert.equal(stops, 2, 'removed Restart All message must not stop services');
    assert.equal(starts, 2, 'removed Restart All message must not start services');
    await commands.get('nestjsServices.open')();
    assert.deepEqual(executed, ['workbench.view.explorer', 'nestjsServices.explorerView.focus']);
    for (const item of context.subscriptions) item.dispose();
  } finally {
    Module._load = load;
    fs.rmSync(root, { recursive: true, force: true });
  }
});
