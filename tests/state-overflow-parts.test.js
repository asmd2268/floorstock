import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import { estimateDocBytes, estimateValueBytes } from '../public/assets/js/core/firestore-doc-size.js';
import {
  splitForOverflow,
  overflowProbeKeys,
  overflowPartKey,
  OVERFLOW_SPLIT_BYTES,
  OVERFLOW_PROBE_BYTES,
} from '../public/assets/js/core/overflow-parts-store.js';
import { baseStateKey } from '../public/assets/js/core/partitioned-key-names.js';

/* Every time a record filled up, it was handled after the fact, for that one key,
   by whoever noticed the gauge. This is the general form: no state key has a
   ceiling, so "the record filled up and everything stopped" cannot happen to a
   key nobody thought about in advance. */

const jsRoot = new URL('../public/assets/js/', import.meta.url);

test('size is measured the way Firestore measures, not with JSON', () => {
  /* JSON pays for quotes, colons, commas and braces that never reach the
     database. That overstatement is how a document was reported at 120.4% of
     1 MiB — a number that cannot exist, since the write that created it would
     have been refused. */
  const rows = Array.from({ length: 500 }, (_, index) => ({ id: `r${index}`, name: 'Metoprolol 1mg/ml Ampoule', qty: 5 }));
  assert.ok(estimateDocBytes(rows) < JSON.stringify(rows).length);
  // The documented rules: string is its UTF-8 length + 1, number is 8, bool 1.
  assert.equal(estimateValueBytes('abc'), 4);
  assert.equal(estimateValueBytes(12345), 8);
  assert.equal(estimateValueBytes(true), 1);
  assert.equal(estimateValueBytes(null), 1);
  // Arabic is multi-byte and must be counted in bytes, not characters.
  assert.equal(estimateValueBytes('مخزون'), 11);
});

test('a value that fits is written as one document, exactly as before', () => {
  const small = [{ id: 'a' }, { id: 'b' }];
  assert.deepEqual(splitForOverflow(small), [small]);
  assert.equal(overflowPartKey('notes', 1), 'notes');
  assert.equal(overflowPartKey('notes', 3), 'notes_p3');
});

test('an array too large is continued into numbered documents, losing nothing', () => {
  const rows = Array.from({ length: 400 }, (_, index) => ({ id: `r${index}`, blob: 'x'.repeat(4000) }));
  const chunks = splitForOverflow(rows);
  assert.ok(chunks.length > 1, 'the value must be spread, not refused');
  chunks.forEach((chunk) => assert.ok(estimateDocBytes(chunk) <= OVERFLOW_SPLIT_BYTES));
  assert.deepEqual(chunks.flat(), rows, 'every row survives the split, in order');
});

test('an object too large is split by entry and rejoins to itself', () => {
  const map = {};
  for (let index = 0; index < 400; index += 1) map[`dept_${index}`] = { meds: 'x'.repeat(4000) };
  const chunks = splitForOverflow(map);
  assert.ok(chunks.length > 1);
  assert.deepEqual(Object.assign({}, ...chunks), map);
});

test('a continuation is only looked for behind a document big enough to have one', () => {
  /* Parts are only ever created when a document is near full, so a small
     document provably has none — which is why the ordinary session pays no
     extra read for this. */
  assert.deepEqual(overflowProbeKeys({ notes: [{ id: 'a' }] }), []);
  const big = { notes: [{ blob: 'x'.repeat(OVERFLOW_PROBE_BYTES + 1024) }] };
  assert.deepEqual(overflowProbeKeys(big), ['notes_p2']);
  // Walking on: a full part implies the next one may exist.
  const walked = { notes: big.notes, notes_p2: big.notes };
  assert.deepEqual(overflowProbeKeys(walked), ['notes_p3']);
  // The split threshold must exceed the probe threshold, or a written part could
  // be too small to be looked for.
  assert.ok(OVERFLOW_SPLIT_BYTES > OVERFLOW_PROBE_BYTES);
});

test('a continuation carries the permissions of the key it continues', async () => {
  assert.equal(baseStateKey('notes_p2'), 'notes');
  assert.equal(baseStateKey('requests_g2026-09_p2'), 'requests');
  assert.equal(baseStateKey('meds_icu'), 'meds_icu');
  const rules = await readFile(new URL('../firestore.rules', import.meta.url), 'utf8');
  assert.match(rules, /docId\.matches\('\^\.\*_p\[0-9\]\+\$'\) \? docId\.split\('_p\[0-9\]\+\$'\)\[0\] : docId/);
});

test('reads and writes route through the one owner, not the call sites', async () => {
  const stateModule = await readFile(new URL('modules/03-core-application-firebase-state-auth.js', jsRoot), 'utf8');
  assert.match(stateModule, /if\(hasOverflowParts\(k\)\)return joinOverflowParts\(k\)/);
  assert.match(stateModule, /writeWithOverflow\(k,v,function\(docId,chunk\)/);
  // The old advice sent every oversize failure to the Requests page, whatever
  // the record was.
  assert.ok(!/archive old orders from the Requests page/i.test(stateModule));
});

test('the month stores keep their own parts, so no row is joined twice', () => {
  /* A month partition and the audit trail already end in _pN and already
     concatenate their own parts. Joining them here as well would return every
     one of those rows a second time. */
  globalThis.S = { cache: {
    'controlled_moves_h1447-03': [{ id: 'a' }],
    'controlled_moves_h1447-03_p2': [{ id: 'b' }],
    'audit_log_2026-09': [{ id: 'c' }],
    'audit_log_2026-09_p2': [{ id: 'd' }],
    notes: [{ id: 'e' }],
    notes_p2: [{ id: 'f' }],
  } };
  const { overflowPartKeysInCache } = globalThis;
  assert.deepEqual(overflowPartKeysInCache('controlled_moves_h1447-03'), []);
  assert.deepEqual(overflowPartKeysInCache('audit_log_2026-09'), []);
  assert.deepEqual(overflowPartKeysInCache('notes'), ['notes_p2']);
  delete globalThis.S;
});
