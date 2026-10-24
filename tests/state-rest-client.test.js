import test from 'node:test';
import assert from 'node:assert/strict';
import { createStateRestClient, stateAppCheckToken } from '../public/assets/js/core/state-rest-client.js';

const noWait = () => Promise.resolve();

function client(overrides = {}) {
  const calls = [];
  const api = createStateRestClient({
    authToken: async () => 'id-token',
    appCheck: () => overrides.appCheck || null,
    fetchJson: async (url, options, timeout) => {
      calls.push({ url, options, timeout });
      return overrides.respond ? overrides.respond(url, calls.length) : { payload: {} };
    },
    restBase: () => 'https://fs/v1/docs',
    restPath: (id) => 'floorstock_state/' + id,
    apiKey: () => 'K E Y',
    wait: noWait,
  });
  return { api, calls };
}

test('app check: no instance or no getToken yields null and never throws', async () => {
  assert.equal(await stateAppCheckToken(null, noWait), null);
  assert.equal(await stateAppCheckToken({}, noWait), null);
});

test('app check: one retry, then the token; two failures give null', async () => {
  let n = 0;
  const flaky = { getToken: async () => { n += 1; if (n === 1) throw new Error('blip'); return { token: 'ac' }; } };
  assert.equal(await stateAppCheckToken(flaky, noWait), 'ac');
  assert.equal(n, 2);
  const warn = console.warn; console.warn = () => {};
  try {
    assert.equal(await stateAppCheckToken({ getToken: async () => ({}) }, noWait), null);
    assert.equal(await stateAppCheckToken({ getToken: async () => { throw new Error('x'); } }, noWait), null);
  } finally { console.warn = warn; }
});

test('request adds the bearer token, JSON type and the app check header when present', async () => {
  const { api, calls } = client({ appCheck: { getToken: async () => ({ token: 'ac' }) } });
  await api.request('https://x', { method: 'POST', headers: { A: '1' } }, 5000);
  assert.deepEqual(calls[0].options.headers, { A: '1', Authorization: 'Bearer id-token', 'Content-Type': 'application/json', 'X-Firebase-AppCheck': 'ac' });
  assert.equal(calls[0].timeout, 5000);
  const plain = client();
  await plain.api.request('https://x');
  assert.equal('X-Firebase-AppCheck' in plain.calls[0].options.headers, false);
  assert.equal(plain.calls[0].timeout, 12000);
});

test('listing follows pages, encodes the key and the token', async () => {
  const { api, calls } = client({ respond: (url, n) => ({ payload: n === 1 ? { documents: [{ a: 1 }], nextPageToken: 't/1' } : { documents: [{ a: 2 }] } }) });
  assert.deepEqual(await api.listCollection('users'), [{ a: 1 }, { a: 2 }]);
  assert.equal(calls[0].url, 'https://fs/v1/docs/floorstock_state/users?pageSize=300&key=K%20E%20Y');
  assert.match(calls[1].url, /&pageToken=t%2F1$/);
});

test('listing stops after the page limit', async () => {
  const { api } = client({ respond: () => ({ payload: { documents: [], nextPageToken: 'more' } }) });
  await assert.rejects(api.listCollection('users'), /safety limit/);
});
