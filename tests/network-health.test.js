import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createNetworkHealth, NET_MODE_KEY, NET_HOLD_MS, SERVER_WAIT_MS, SAVE_WAIT_MS } from '../public/assets/js/core/network-health.js';

function memoryStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), _m: m };
}
function fakeClock() {
  let t = 1_000_000;
  const timers = [];
  return {
    now: () => t,
    setTimeout: (fn, ms) => { const id = timers.length + 1; timers.push({ id, fn, at: t + ms, live: true }); return id; },
    clearTimeout: (id) => { const x = timers.find((y) => y.id === id); if (x) x.live = false; },
    advance(ms) { t += ms; timers.filter((x) => x.live && x.at <= t).forEach((x) => { x.live = false; x.fn(); }); }
  };
}
const make = (extra) => {
  const clock = fakeClock(); const storage = memoryStorage(); const warnings = [];
  const net = createNetworkHealth(Object.assign({ storage, now: clock.now, setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout, warn: (...a) => warnings.push(a) }, extra));
  return { clock, storage, net, warnings };
};

test('a device that has shown no trouble keeps auto-detect and never gets long polling forced', () => {
  const { net } = make();
  assert.deepEqual(net.transportSettings(), { experimentalAutoDetectLongPolling: true });
});

test('the two long-polling options are never set together (Firestore rejects that)', () => {
  const { net } = make();
  net.trouble('x');
  const s = net.transportSettings();
  assert.equal(Object.keys(s).length, 1);
  assert.deepEqual(s, { experimentalForceLongPolling: true });
});

test('trouble is remembered across page loads, and a fresh load of the same device uses long polling', () => {
  const { net, storage, clock } = make();
  net.trouble('slow-save');
  const reloaded = createNetworkHealth({ storage, now: clock.now, setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout });
  assert.deepEqual(reloaded.transportSettings(), { experimentalForceLongPolling: true });
});

test('after a week the device tries auto-detect again', () => {
  const { net, clock } = make();
  net.trouble('slow-save');
  clock.advance(NET_HOLD_MS - 1000);
  assert.equal(net.longPollingActive(), true);
  clock.advance(2000);
  assert.deepEqual(net.transportSettings(), { experimentalAutoDetectLongPolling: true });
});

test('a server that never answers marks the device; one that answers in time does not', () => {
  const slow = make();
  slow.net.expectServer();
  slow.clock.advance(SERVER_WAIT_MS + 1);
  assert.equal(slow.net.longPollingActive(), true);

  const fast = make();
  fast.net.expectServer();
  fast.clock.advance(3000);
  fast.net.serverReached();
  fast.clock.advance(SERVER_WAIT_MS * 2);
  assert.equal(fast.net.longPollingActive(), false);
});

test('being offline is not a weak connection', () => {
  const { net, clock } = make({ isOnline: () => false });
  net.expectServer();
  clock.advance(SERVER_WAIT_MS + 1);
  assert.equal(net.longPollingActive(), false);
});

test('a save that is never acknowledged marks the device; a quick save does not', () => {
  const stuck = make();
  stuck.net.watchSave(new Promise(() => {}));
  stuck.clock.advance(SAVE_WAIT_MS + 1);
  assert.equal(stuck.net.longPollingActive(), true);

  const quick = make();
  quick.net.watchSave(Promise.resolve());
  return Promise.resolve().then(() => {
    quick.clock.advance(SAVE_WAIT_MS * 2);
    assert.equal(quick.net.longPollingActive(), false);
  });
});

test('a network failure marks the device, a permission failure does not', async () => {
  const net1 = make();
  await net1.net.watchSave(Promise.reject({ code: 'unavailable' })).catch(() => {});
  await Promise.resolve();
  assert.equal(net1.net.longPollingActive(), true);

  const net2 = make();
  await net2.net.watchSave(Promise.reject({ code: 'permission-denied' })).catch(() => {});
  await Promise.resolve();
  assert.equal(net2.net.longPollingActive(), false);
});

test('storage that throws never breaks start-up', () => {
  const broken = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  const net = createNetworkHealth({ storage: broken, warn: () => {} });
  assert.deepEqual(net.transportSettings(), { experimentalAutoDetectLongPolling: true });
  assert.equal(net.trouble('x'), false);
});
