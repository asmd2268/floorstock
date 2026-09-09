import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import { rowIntent, applyIntent } from '../public/assets/js/core/row-merge-write.js';

/* crash_carts is one document holding every trolley, and every caller reads all
   of them, changes one, and writes them all back. Two pharmacists working on two
   different trolleys at the same moment therefore overwrote each other: the
   second save carried the first's cart as it looked when that page loaded. No
   error, nobody told, the cart simply says something different tomorrow. */

const cart = (id, seal) => ({ id, seal, items: [{ id: 'm1', qty: 2 }] });

test('a save is the caller’s intent, not their whole snapshot', () => {
  const read = [cart('a', '111'), cart('b', '222')];
  const saving = [cart('a', '111'), { ...cart('b', '999') }];
  const intent = rowIntent(read, saving);
  assert.deepEqual(intent.added, []);
  assert.deepEqual(intent.changed.map((row) => row.id), ['b']);
  assert.deepEqual(intent.removed, []);
});

test('someone else’s edit survives a save that never touched it', () => {
  // Both pages loaded the same two carts. One changes cart b; meanwhile cart a
  // has been corrected by someone else and the server already holds that.
  const read = [cart('a', '111'), cart('b', '222')];
  const saving = [cart('a', '111'), cart('b', '999')];
  const serverNow = [cart('a', 'CORRECTED'), cart('b', '222')];
  const merged = applyIntent(serverNow, rowIntent(read, saving));
  assert.equal(merged.find((row) => row.id === 'a').seal, 'CORRECTED', 'the other edit must survive');
  assert.equal(merged.find((row) => row.id === 'b').seal, '999', 'this edit must land');
});

test('adding and removing carry across too, without duplicating', () => {
  const read = [cart('a', '1')];
  const saving = [cart('a', '1'), cart('c', '3')];
  const serverNow = [cart('a', '1'), cart('b', '2')];
  const merged = applyIntent(serverNow, rowIntent(read, saving)).map((row) => row.id).sort();
  assert.deepEqual(merged, ['a', 'b', 'c']);

  const removing = rowIntent([cart('a', '1'), cart('b', '2')], [cart('a', '1')]);
  assert.deepEqual(applyIntent([cart('a', '1'), cart('b', '2')], removing).map((row) => row.id), ['a']);
  // A row already added by the server is not appended a second time.
  const readd = rowIntent([], [cart('b', '2')]);
  assert.deepEqual(applyIntent([cart('b', '2')], readd).map((row) => row.id), ['b']);
});

test('the merge lives in the one writer, not at the call sites', async () => {
  /* S.s decides, from one list of keys, whether a save is a diff or a plain
     write — so no caller has to know, and none can forget. */
  const stateModule = await readFile(new URL('../public/assets/js/modules/03-core-application-firebase-state-auth.js', import.meta.url), 'utf8');
  assert.match(stateModule, /if\(Array\.isArray\(v\)&&isRowMergedKey\(k\)\)\{/);
  assert.match(stateModule, /saveRowsMerging\(k,v,\{fallback:function\(\)\{return fsStatePlainSet\(k,v\)\}\}\)/);
  const persistence = await readFile(new URL('../public/assets/js/modules/49-asdh-final-persistence-actions-20260725.js', import.meta.url), 'utf8');
  assert.match(persistence, /S\.s\('crash_carts',repaired\.carts\)/);
});

test('the keys that merge are the shared lists, and the fallback cannot recurse', async () => {
  const { isRowMergedKey } = await import('../public/assets/js/core/row-merged-keys.js');
  for (const key of ['crash_carts', 'departments', 'controlled_catalog', 'meds_icu', 'expiry_icu', 'shelves_icu']) {
    assert.equal(isRowMergedKey(key), true, key);
  }
  // A settings map or a single object nobody edits in parallel keeps the plain write.
  for (const key of ['theme', 'req_windows', 'controlled_warehouse', 'facility_logo']) {
    assert.equal(isRowMergedKey(key), false, key);
  }
  const merge = await readFile(new URL('../public/assets/js/core/row-merge-write.js', import.meta.url), 'utf8');
  // Refusing to save would be worse than the race it prevents — but the fallback
  // must be the plain write, not S.s, which would come straight back here.
  assert.match(merge, /if \(!ref \|\| !globalThis\.FB_DB\.runTransaction\) return fallback\(\);/);
  assert.match(merge, /if \(typeof fallback !== 'function'\) throw new Error/);
});
