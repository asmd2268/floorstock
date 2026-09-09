import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { test } from 'node:test';

import { retiredStateKeys } from '../public/assets/js/core/retired-state-keys.js';

/* A removed feature takes its code with it but not its data. The document stays
   in floorstock_state, loads into every master session, and appears on the gauge
   with no action beside it, because the module that would have owned the action
   is gone — which is exactly how inventory_authoritative_rollback_backups_v1
   came to sit at 264 KB with nothing in the codebase referring to it. */

const jsRoot = new URL('../public/assets/js/', import.meta.url);

test('a key listed as retired really is unreferenced', async () => {
  /* The whole claim behind offering to delete one. If live code still names it,
     it is not retired — it belongs to the module that owns it. */
  const roots = ['core', 'modules'];
  const sources = [];
  for (const root of roots) {
    for (const name of await readdir(new URL(`${root}/`, jsRoot))) {
      if (!name.endsWith('.js') || name === 'retired-state-keys.js') continue;
      sources.push(await readFile(new URL(`${root}/${name}`, jsRoot), 'utf8'));
    }
  }
  const rules = await readFile(new URL('../firestore.rules', import.meta.url), 'utf8');
  assert.ok(retiredStateKeys().length >= 1);
  for (const key of retiredStateKeys()) {
    for (const source of sources) {
      assert.ok(!source.includes(key), `${key} is listed as retired but live code still names it`);
    }
    assert.ok(!rules.includes(key), `${key} is listed as retired but firestore.rules still names it`);
  }
});

test('deleting a retired record is the master’s decision, not automatic', async () => {
  const source = await readFile(new URL('core/retired-state-keys.js', jsRoot), 'utf8');
  assert.match(source, /uiConfirm/);
  assert.match(source, /Only Master can delete a retired record/);
  // Never wired into the automatic upkeep pass: this deletes, it does not trim.
  assert.ok(!/registerAutoMaintenance/.test(source));
});

test('the confirmation says what the record is and where a copy survives', async () => {
  const source = await readFile(new URL('core/retired-state-keys.js', jsRoot), 'utf8');
  assert.match(source, /Local Backups contain a copy of every state record/);
  assert.match(source, /inventory_authoritative_rollback_backups_v1/);
});
