import test from 'node:test';
import assert from 'node:assert/strict';

test('Firestore scope helpers keep tenant paths isolated', async () => {
  const scope = await import('../public/assets/js/core/firestore-scope.js');
  assert.equal(scope.tenantIdFromProfile({ tenantId: ' t1 ' }), 't1');
  assert.equal(scope.stateCollectionPath({ tenantId: 't1' }), 'tenants/t1/state');
  assert.equal(scope.stateCollectionPath({}), 'floorstock_state');
});

test('Firestore REST path helper encodes every segment', async () => {
  const paths = await import('../public/assets/js/core/firestore-rest-paths.js');
  assert.equal(paths.fsRestPath('a/b c'), 'a/b%20c');
  assert.equal(paths.fsRestPath('/a//b/'), 'a/b');
});

test('Firestore value codec preserves safe primitive representations', async () => {
  const codec = await import('../public/assets/js/core/firestore-value-codec.js');
  assert.deepEqual(codec.fsStateRestEncode(3), { integerValue: '3' });
  assert.deepEqual(codec.fsStateRestEncode(true), { booleanValue: true });
  assert.deepEqual(codec.fsStateRestEncode({ hidden: undefined }), { mapValue: { fields: {} } });
  assert.equal(codec.stateValueEqual({ a: 1 }, { a: 1 }), true);
});

test('promise timeout resolves and rejects deterministically', async () => {
  const { withTimeout } = await import('../public/assets/js/core/promise-timeout.js');
  assert.equal(await withTimeout(Promise.resolve('ok'), 50, 'late'), 'ok');
  await assert.rejects(() => withTimeout(new Promise(() => {}), 5, 'late'), /late/);
});

test('script loader deduplicates pending loads and retries failures', async () => {
  const scripts = [];
  globalThis.document = {
    createElement() {
      return { set src(value) { this.url = value; }, async: false };
    },
    head: { appendChild(script) { scripts.push(script); } },
  };
  const { loadScriptOnce } = await import('../public/assets/js/core/script-loader.js');
  const first = loadScriptOnce('unit', '/unit.js');
  const second = loadScriptOnce('unit', '/unit.js');
  assert.equal(first, second);
  assert.equal(scripts.length, 1);
  scripts[0].onload();
  await first;
  const failed = loadScriptOnce('retry', '/retry.js');
  scripts[1].onerror();
  await assert.rejects(failed, /library failed to load/);
  const retry = loadScriptOnce('retry', '/retry.js');
  assert.equal(scripts.length, 3);
  scripts[2].onload();
  await retry;
  delete globalThis.document;
});

test('login role policy accepts only supported operational roles', async () => {
  const policy = await import('../public/assets/js/core/auth-role-policy.js');
  assert.equal(policy.isSupportedLoginRole('department'), true);
  assert.equal(policy.isSupportedLoginRole('outpatient_pharmacy_supervisor'), true);
  assert.equal(policy.isSupportedLoginRole('master'), false);
  assert.equal(policy.isSupportedLoginRole('invalid'), false);
});

test('Firebase config remains bound to the FloorStock project', async () => {
  const config = await import('../public/assets/js/core/firebase-config.js');
  assert.equal(config.FIREBASE_CONFIG.projectId, 'floorstock-6ac2d');
  assert.equal(config.FIREBASE_CONFIG.authDomain, 'floorstock-6ac2d.firebaseapp.com');
});

test('Firestore SDK scope selects tenant or legacy state collection', async () => {
  const { stateCollectionRef } = await import('../public/assets/js/core/firestore-sdk-scope.js');
  const calls = [];
  const db = {
    collection(name) {
      calls.push(name);
      if (name === 'floorstock_state') return 'legacy-ref';
      return {
        doc(id) { calls.push(id); return { collection(child) { calls.push(child); return 'tenant-ref'; } }; },
      };
    },
  };
  assert.equal(stateCollectionRef(db, { tenantId: 't1' }), 'tenant-ref');
  assert.deepEqual(calls, ['tenants', 't1', 'state']);
  calls.length = 0;
  assert.equal(stateCollectionRef(db, {}), 'legacy-ref');
  assert.deepEqual(calls, ['floorstock_state']);
});
