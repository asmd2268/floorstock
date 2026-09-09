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

test('the crash carts go through it, and a missing transaction still saves', async () => {
  const persistence = await readFile(new URL('../public/assets/js/modules/49-asdh-final-persistence-actions-20260725.js', import.meta.url), 'utf8');
  assert.match(persistence, /saveRowsMerging\('crash_carts',repaired\.carts\)/);
  const merge = await readFile(new URL('../public/assets/js/core/row-merge-write.js', import.meta.url), 'utf8');
  // Refusing to save would be worse than the race it prevents.
  assert.match(merge, /if \(!ref \|\| !globalThis\.FB_DB\.runTransaction\) return globalThis\.S\.s\(key, nextRows\);/);
});
