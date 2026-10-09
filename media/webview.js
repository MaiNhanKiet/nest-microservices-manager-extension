// Browser-side code bundled locally by esbuild; no CDN or React required.
import {
  Play, Square, ListVideo, ListX,
  RefreshCw, SquareTerminal, RotateCcw,
  FolderOpen, CircleAlert
} from 'lucide';
import { createMorph } from 'morphicons/dom';

const vscode = acquireVsCodeApi();
const NS = 'http://www.w3.org/2000/svg';
const root = document.getElementById('items');
const entries = new Map();
let selectedId = null;
const scanBox = document.getElementById('scan-state');
const scanArt = document.getElementById('scan-art');
const scanTitle = document.getElementById('scan-title');
const scanDescription = document.getElementById('scan-description');
const scanRefresh = document.getElementById('scan-refresh');
const scanFolder = document.getElementById('scan-folder');
let scanError = null;

scanRefresh.addEventListener('click', () => post('refresh'));
scanFolder.addEventListener('click', () => post('openFolder'));

function post(action, id) {
  vscode.postMessage(id === undefined ? { action } : { action, id });
}

function createSvg(iconNode) {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '16');
  svg.setAttribute('height', '16');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');

  // Lucide supplies the icon geometry, not hand-written SVG strings.
  for (const [tag, attrs] of iconNode) {
    const child = document.createElementNS(NS, tag);
    for (const [key, value] of Object.entries(attrs)) {
      if (key !== 'key' && value !== undefined) {
        child.setAttribute(key, String(value));
      }
    }
    svg.appendChild(child);
  }
  return svg;
}

function button(icon, className, title, action, disabled = false) {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = `icon ${className}`;
  el.title = title;
  el.setAttribute('aria-label', title);
  el.disabled = disabled;
  el.appendChild(createSvg(icon));
  el.addEventListener('click', event => {
    event.stopPropagation();
    action();
  });
  return el;
}

function toolbar(id, icon, title, action) {
  const el = document.getElementById(id);
  el.title = title;
  el.setAttribute('aria-label', title);
  el.appendChild(createSvg(icon));
  el.addEventListener('click', () => post(action));
}

toolbar('refresh', RefreshCw, 'Refresh', 'refresh');
toolbar('startAll', ListVideo, 'Start All Services', 'startAll');
toolbar('stopAll', ListX, 'Stop All Services', 'stopAll');

function showEmptyState(phase) {
  const visible = phase !== 'hidden';
  scanBox.hidden = !visible;
  root.hidden = visible;
  if (!visible) return;
  scanBox.dataset.phase = phase;
  scanArt.replaceChildren(createSvg(phase === 'error' ? CircleAlert : FolderOpen));
  scanTitle.textContent = phase === 'error'
    ? 'Unable to scan workspace' : 'No NestJS services found';
  scanDescription.textContent = phase === 'error'
    ? scanError
    : 'Open the backend folder containing nest-cli.json, check its projects, or click Refresh.';
}

function updateScanState(hasServices) {
  showEmptyState(hasServices ? 'hidden' : (scanError ? 'error' : 'empty'));
}

function makeRow(service) {
  const row = document.createElement('div');
  row.className = 'row';

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'icon service-toggle';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '16');
  svg.setAttribute('height', '16');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(NS, 'path');
  svg.appendChild(path);
  toggle.appendChild(svg);

  const running = service.status !== 'stopped';
  const morph = createMorph(path, running ? Square : Play, {
    reducedMotion: 'user'
  });
  toggle.addEventListener('click', event => {
    event.stopPropagation();
    post('toggle', service.id);
  });
  row.appendChild(toggle);

  const name = document.createElement('button');
  name.type = 'button';
  name.className = 'service-name';
  name.addEventListener('click', () => {
    selectedId = service.id;
    markSelected();
    // Clicking the name NEVER starts or stops a service.
    if (entries.get(service.id)?.running) post('logs', service.id);
  });
  row.appendChild(name);

  const actions = document.createElement('div');
  actions.className = 'row-actions';
  const logs = button(SquareTerminal, '', 'Show Service Logs',
    () => post('logs', service.id));
  const restart = button(RotateCcw, '', 'Restart Service',
    () => post('restart', service.id));
  actions.append(logs, restart);
  row.appendChild(actions);

  const entry = { row, toggle, name, logs, restart, morph, running };
  entries.set(service.id, entry);
  updateRow(entry, service, true);
  return entry;
}

function updateRow(entry, service, initial = false) {
  const running = service.status !== 'stopped';
  if (!initial && running !== entry.running) {
    // Existing DOM/path is reused, so Morphicons can actually animate.
    entry.morph.morphTo(running ? Square : Play, 'snappy');
  }
  entry.running = running;
  entry.row.classList.toggle('running', running);
  entry.toggle.classList.toggle('run', !running);
  entry.toggle.classList.toggle('stop', running);
  entry.toggle.title = running ? `Stop ${service.name}` : `Run ${service.name}`;
  entry.toggle.setAttribute('aria-label', entry.toggle.title);
  entry.name.textContent = service.name;
  entry.name.title = running ? `Open terminal: ${service.name}` : `${service.name} (stopped)`;
  entry.logs.disabled = !running;
  entry.restart.disabled = !running;
}

function markSelected() {
  for (const [id, entry] of entries) {
    const selected = id === selectedId;
    entry.row.classList.toggle('selected', selected);
    if (selected) entry.name.setAttribute('aria-current', 'true');
    else entry.name.removeAttribute('aria-current');
  }
}

function render(services) {
  const seen = new Set();
  const scrollTop = root.scrollTop;
  for (const service of services) {
    seen.add(service.id);
    const entry = entries.get(service.id) ?? makeRow(service);
    updateRow(entry, service);
    root.appendChild(entry.row); // Reorder without destroying DOM/morph controller.
  }
  for (const [id, entry] of entries) {
    if (!seen.has(id)) {
      entry.morph.destroy();
      entry.row.remove();
      entries.delete(id);
    }
  }
  if (selectedId !== null && !seen.has(selectedId)) selectedId = null;
  markSelected();
  root.scrollTop = scrollTop;
  updateScanState(services.length > 0);
}

window.addEventListener('message', event => {
  const data = event.data;
  if (data?.type === 'services' && Array.isArray(data.items)) {
    scanError = typeof data.scanError === 'string' ? data.scanError : null;
    render(data.items);
    // Mark ready only after a message was successfully rendered.
    window.__nestjsServicesUiReady = true;
  }
});

showEmptyState('empty');
post('ready');
