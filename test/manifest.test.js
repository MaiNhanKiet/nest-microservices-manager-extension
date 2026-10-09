const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));

test('activity bar container has a valid ID and valid icon', () => {
  for (const container of manifest.contributes.viewsContainers.activitybar) {
    assert.match(container.id, /^[A-Za-z0-9_-]+$/);
    assert.ok(fs.existsSync(path.join(__dirname, '..', container.icon)));
    assert.ok(manifest.contributes.views[container.id]);
  }
});

test('both draggable locations register Webview Views', () => {
  const views = manifest.contributes.views;
  for (const view of [
    views.nestjsServicesContainer.find(v => v.id === 'nestjsServices.view'),
    views.explorer.find(v => v.id === 'nestjsServices.explorerView')
  ]) {
    assert.ok(view);
    assert.equal(view.type, 'webview');
    assert.ok(manifest.activationEvents.includes(`onView:${view.id}`) ||
              manifest.activationEvents.includes('onStartupFinished'));
  }
  assert.equal(manifest.contributes.menus, undefined, 'old Tree View action menus must be removed');
  assert.ok(manifest.contributes.commands.some(c => c.command === 'nestjsServices.open'));
});

test('Webview bundle declares Lucide/Morphicons dependencies and distinct toolbar icons', () => {
  assert.ok(manifest.dependencies.lucide);
  assert.ok(manifest.dependencies.morphicons);
  assert.ok(manifest.devDependencies.esbuild);
  assert.match(manifest.scripts.compile, /esbuild media\/webview\.js/);
  const browser = fs.readFileSync(path.join(__dirname, '..', 'media', 'webview.js'), 'utf8');
  assert.match(browser, /from 'morphicons\/dom'/);
  assert.match(browser, /morph\.morphTo/);
  assert.match(browser, /toolbar\('refresh', RefreshCw/);
  assert.match(browser, /toolbar\('startAll', ListVideo/);
  assert.match(browser, /toolbar\('stopAll', ListX/);
  assert.doesNotMatch(browser, /ListRestart|restartAll/);
  const host = fs.readFileSync(path.join(__dirname, '..', 'src', 'servicesWebview.ts'), 'utf8');
  assert.match(host, /\.toolbar-action \{ color: #ffffff !important/);
  assert.match(host, /class="icon toolbar-action" id="refresh"/);
  assert.match(host, /class="icon toolbar-action" id="startAll"/);
  assert.match(host, /class="icon toolbar-action" id="stopAll"/);
  assert.match(host, /id="refresh"[\s\S]*id="startAll"[\s\S]*id="stopAll"/);
  assert.doesNotMatch(host, /restartAll/);
  assert.match(host, /webview\.bundle\.js/);
});


test('only the selected row is active and has no left accent bar', () => {
  const host = fs.readFileSync(path.join(__dirname, '..', 'src', 'servicesWebview.ts'), 'utf8');
  assert.match(host, /\.row\.selected \{ background:/);
  assert.doesNotMatch(host, /\.row\.running \{ background:/);
  assert.doesNotMatch(host, /\.row\.running::before/);
  assert.doesNotMatch(host, /\.row\.selected \{ box-shadow:/);
  assert.match(host, /\.row:hover \{ background:/);
  assert.match(host, /\.row\.selected:hover \{ background:/);
  assert.doesNotMatch(host, /\.items:hover \.row\.selected:not\(:hover\)/);
  assert.match(host, /\.row > \.service-name:hover, \.row > \.service-toggle:hover \{ background: transparent; \}/);
  const browser = fs.readFileSync(path.join(__dirname, '..', 'media', 'webview.js'), 'utf8');
  assert.match(browser, /entry\.row\.classList\.toggle\('running', running\)/);
  assert.match(browser, /const selected = id === selectedId/);
});

test('panel has visible startup state, browser error fallback and refresh progress', () => {
  const host = fs.readFileSync(path.join(__dirname, '..', 'src', 'servicesWebview.ts'), 'utf8');
  const browser = fs.readFileSync(path.join(__dirname, '..', 'media', 'webview.js'), 'utf8');
  assert.match(host, /existsSync\(bundleUri\.fsPath\)/);
  assert.match(host, /NestJS Services UI is not built yet/);
  assert.match(host, /id="scan-state" data-phase="empty" role="status"/);
  assert.match(host, /No NestJS services found/);
  assert.doesNotMatch(host, /id="scan-progress"/);
  assert.doesNotMatch(host, /Discovering services/);
  assert.match(host, /Unable to load NestJS Services UI/);
  assert.match(browser, /showEmptyState\('empty'\)/);
  assert.doesNotMatch(browser, /scan-progress|Discovering services|initialSettled/);
  assert.match(browser, /window\.__nestjsServicesUiReady = true/);
});


test('v01 uses semantic version and a single selected active row', () => {
  assert.equal(manifest.version, '0.1.0');
  const host = fs.readFileSync(path.join(__dirname, '..', 'src', 'servicesWebview.ts'), 'utf8');
  const browser = fs.readFileSync(path.join(__dirname, '..', 'media', 'webview.js'), 'utf8');
  assert.doesNotMatch(host, /\.row\.running::before/);
  assert.doesNotMatch(host, /\.row\.running \{ background:/);
  assert.match(host, /\.row\.selected \{ background:/);
  assert.match(host, /\.row:hover \{ background:/);
  assert.doesNotMatch(host, /\.items:hover \.row\.selected:not\(:hover\)/);
  assert.match(browser, /entry\.row\.classList\.toggle\('running', running\)/);
  assert.match(browser, /entry\.row\.classList\.toggle\('selected', selected\)/);
});
