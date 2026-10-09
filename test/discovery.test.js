const assert = require('node:assert/strict');
const test = require('node:test');
const { servicesFromConfig } = require('../dist/parser.js');

test('discovers Nest application projects and excludes libraries', () => {
  const items = servicesFromConfig({ projects: {
    'auth-service': { type: 'application', root: 'apps/auth-service' },
    'notification-service': { type: 'application', root: 'apps/notification-service' },
    'shared': { type: 'library', root: 'libs/shared' }
  } }, '/workspace/nest-cli.json', 'backend');
  assert.deepEqual(items.map(i => i.name), ['auth-service', 'notification-service']);
  assert.deepEqual(items.map(i => i.project), ['auth-service', 'notification-service']);
});

test('discovers standard-mode Nest application without projects', () => {
  const items = servicesFromConfig({}, '/workspace/auth/nest-cli.json', 'auth');
  assert.equal(items.length, 1);
  assert.equal(items[0].name, 'auth');
  assert.equal(items[0].project, undefined);
});
