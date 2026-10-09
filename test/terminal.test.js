const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Module = require('node:module');

const originalLoad = Module._load;
class EventEmitter {
  constructor() { this.listeners = new Set(); this.event = f => {this.listeners.add(f);return {dispose:()=>this.listeners.delete(f)}}; }
  fire(data) {for (const fn of this.listeners) fn(data);}
}
Module._load = function (id, parent, isMain) {
  if (id === 'vscode') return { EventEmitter, workspace: { getConfiguration: () => ({get: (name, fallback) => fallback}) } };
  return originalLoad.call(this, id, parent, isMain);
};
const { NestProcessTerminal } = require('../dist/terminal.js');
Module._load = originalLoad;

async function waitFor(predicate, ms = 4000) {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > ms) throw new Error('timed out');
    await new Promise(r => setTimeout(r, 25));
  }
}

test('starts and stops a local Nest CLI application process', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nest-svc-'));
  try {
    const bin = path.join(dir, 'node_modules', '@nestjs', 'cli', 'bin');
    fs.mkdirSync(bin, { recursive: true });
    fs.writeFileSync(path.join(bin, 'nest.js'), "console.log('fake nest start'); process.on('SIGTERM',()=>process.exit(0)); setInterval(()=>{},1000);\n");
    const status = [];
    let output = '';
    const pty = new NestProcessTerminal({root:dir,name:'mock',id:'mock',configPath:path.join(dir,'nest-cli.json')}, s=>status.push(s));
    pty.onDidWrite(text=>output+=text);
    pty.open();
    await waitFor(()=>status.includes('running'));
    await waitFor(()=>output.includes('fake nest start'));
    await pty.stop();
    await waitFor(()=>status.at(-1)==='stopped');
    assert.ok(output.includes('Process exited'));
  } finally {fs.rmSync(dir, {recursive:true, force:true});}
});
