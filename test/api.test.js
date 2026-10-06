'use strict';

// Smoke tests for the HTTP API, run against the demo player so they never
// touch the Spotify app or any real devices.  Run with: npm test
process.env.DEMO = '1';

const test   = require('node:test');
const assert = require('node:assert/strict');
const fs     = require('node:fs');
const path   = require('node:path');
const vm     = require('node:vm');
const app    = require('../server');

let base;
let server;

test.before(() => new Promise((resolve) => {
  server = app.listen(0, () => {
    base = `http://127.0.0.1:${server.address().port}`;
    resolve();
  });
}));

test.after(() => new Promise((resolve) => server.close(resolve)));

async function call(method, url, body) {
  const res = await fetch(base + url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

test('pages are served', async () => {
  for (const page of ['/', '/classic.html', '/spotify-modern.html']) {
    const res = await fetch(base + page);
    assert.equal(res.status, 200, page);
  }
  const html = await (await fetch(base + '/')).text();
  assert.match(html, /json-polyfill\.js[\s\S]*dashboard\.js/, 'polyfill loads before dashboard.js');
});

test('demo player reports a playing track', async () => {
  assert.deepEqual((await call('GET', '/api/auth/status')).body, { running: true });
  const { status, body } = await call('GET', '/api/player/state');
  assert.equal(status, 200);
  assert.equal(typeof body.track.name, 'string');
  assert.ok(body.durationMs > 0);
  assert.ok(body.progressMs >= 0 && body.progressMs <= body.durationMs);
});

test('player controls change the demo state', async () => {
  const before = (await call('GET', '/api/player/state')).body;

  await call('POST', '/api/player/next');
  const after = (await call('GET', '/api/player/state')).body;
  assert.notEqual(after.track.id, before.track.id);

  await call('POST', '/api/player/pause');
  assert.equal((await call('GET', '/api/player/state')).body.isPlaying, false);

  await call('POST', '/api/player/volume', { volumePercent: 40 });
  await call('POST', '/api/player/shuffle', { state: true });
  await call('POST', '/api/player/repeat', { state: 'context' });
  await call('POST', '/api/player/seek', { positionMs: 1000 });
  const s = (await call('GET', '/api/player/state')).body;
  assert.equal(s.volume, 40);
  assert.equal(s.shuffleState, true);
  assert.equal(s.repeatState, 'context');
  assert.equal(s.progressMs, 1000);
});

test('player rejects bad input', async () => {
  assert.equal((await call('POST', '/api/player/volume', { volumePercent: 150 })).status, 400);
  assert.equal((await call('POST', '/api/player/seek', {})).status, 400);
  assert.equal((await call('POST', '/api/player/shuffle', { state: 'yes' })).status, 400);
  assert.equal((await call('POST', '/api/player/repeat', { state: 'sometimes' })).status, 400);
});

test('home devices toggle and unknown devices 404', async () => {
  const start = (await call('GET', '/api/home/state')).body;
  const res = await call('POST', '/api/home/desk/toggle');
  assert.deepEqual(res.body, { device: 'desk', on: !start.desk });
  assert.equal((await call('POST', '/api/home/desk/set', { on: false })).body.on, false);
  assert.equal((await call('POST', '/api/home/toaster/toggle')).status, 404);
});

test('json-polyfill.js matches native JSON in an engine without JSON', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'public', 'json-polyfill.js'), 'utf8');
  const ctx = vm.createContext({});
  vm.runInContext('delete this.JSON;', ctx);
  vm.runInContext(src, ctx);

  const samples = [
    { volumePercent: 30 }, { state: true }, { positionMs: 120000 }, null, 'text', 5, [],
    { s: 'a"b\\c\n\u0001é', list: [1, null, undefined, 'x'], skip: undefined, nan: NaN },
  ];
  for (const value of samples) {
    ctx.value = value;
    assert.equal(vm.runInContext('JSON.stringify(value)', ctx), JSON.stringify(value));
  }
  const parsed = vm.runInContext('JSON.parse(\'{"a":[1,{"b":null}],"c":"x"}\')', ctx);
  assert.equal(JSON.stringify(parsed), '{"a":[1,{"b":null}],"c":"x"}');
});
