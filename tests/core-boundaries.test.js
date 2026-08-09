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
