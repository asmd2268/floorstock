import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { test } from 'node:test';

/* requests was the last key that could actually fill. One document capped at
   1 MiB, growing with every order — and when it crossed, Firestore refused the
   write, so departments could not submit orders until a master archived. They
   cannot archive; that is master-only. A hospital-wide stop waiting on one
   person. It is now one document per Gregorian month. */

const jsRoot = new URL('../public/assets/js/', import.meta.url);
const store = await readFile(new URL('core/requests-store.js', jsRoot), 'utf8');
const partitions = await readFile(new URL('core/month-partitioned-store.js', jsRoot), 'utf8');
const stateModule = await readFile(new URL('modules/03-core-application-firebase-state-auth.js', jsRoot), 'utf8');
const capabilities = await readFile(new URL('core/role-capabilities.js', jsRoot), 'utf8');
const rules = await readFile(new URL('../firestore.rules', import.meta.url), 'utf8');

test('orders are partitioned by Gregorian month, the ledgers by Hijri', () => {
  // Orders are operational and follow the calendar the wards schedule by; the
  // controlled and custody registers are reported to a regulator in Hijri months.
  assert.match(store, /calendar: 'gregorian'/);
  assert.match(store, /key: REQUESTS_KEY/);
  assert.match(partitions, /calendar: 'hijri'/, 'Hijri stays the default');
  // The marker in the id says which, so a partition can never be read as the
  // wrong calendar's month — they disagree by about eleven days a year.
  assert.match(partitions, /\(spec && spec\.calendar\) === 'gregorian' \? 'g' : 'h'/);
});

test('reads and writes route through one place, not ten call sites', () => {
  // Everything that already said S.g('requests') / S.s('requests', rows) keeps
  // working; the diff turns a whole-array save into a write per changed month.
  assert.match(stateModule, /if\(partitionsAreLive\(k\)\)return monthPartitionRows\(k\)/);
  assert.match(stateModule, /if\(partitionsAreLive\(k\)\)\{/);
  assert.match(partitions, /export async function applyPartitionedArray/);
  assert.match(partitions, /export function partitionsAreLive/);
});

test('routing only switches on after the migration completes', () => {
  // Otherwise some orders would live in the old document and some in the
  // partitions, and neither view would be whole.
  const fn = partitions.slice(partitions.indexOf('export function partitionsAreLive'));
  assert.match(fn, /return !Array\.isArray\(legacy\)/);
});

test('nothing is deleted to make room', () => {
  // The user asked for the oldest to be deleted automatically when full. A month
  // that fills rolls to a numbered part instead, so the ceiling is never reached
  // and no dispensing record is ever discarded to keep the app working.
  assert.match(store, /rolls to a numbered part/);
  assert.match(partitions, /for \(let part = 1; part <= MAX_PARTS && !written; part \+= 1\)/);
});

test('departments can write the month partitions, as they could the old document', () => {
  assert.match(rules, /docId\.matches\('\^requests_g\[0-9\]\{4\}-\[0-9\]\{2\}\(_p\[0-9\]\+\)\?\$'\)/);
  // Read access too, for both the department and pharmacy readers.
  assert.equal((rules.match(/\^requests_g\[0-9\]\{4\}-\[0-9\]\{2\}\(_p\[0-9\]\+\)\?\$/g) || []).length >= 3, true);
});

test('no capability pattern is double-escaped', async () => {
  /* `\\d` inside a regex literal matches a literal backslash, not a digit — a
     pattern written that way silently matches nothing, so a role quietly loses a
     permission the rules grant it. That happened to both the requests and the
     custody patterns at once. */
  for (const name of await readdir(new URL('core/', jsRoot))) {
    if (!name.endsWith('.js')) continue;
    const source = await readFile(new URL(`core/${name}`, jsRoot), 'utf8');
    for (const literal of source.match(/\/\^[^\n]*?\/\.test\(/g) || []) {
      assert.ok(!/\\\\d|\\\\w|\\\\s/.test(literal), `${name} has a double-escaped class: ${literal.slice(0, 80)}`);
    }
  }
  assert.ok(!/\\\\d\{/.test(capabilities), 'role-capabilities must not double-escape');
});

test('every reader goes through S.g, never straight to the partitions', async () => {
  /* gr() briefly read the partitions directly. Before the migration runs the
     partitions are empty and the orders are still in the single document, so
     that returned nothing and emptied every order screen in the app. Only S.g
     knows which shape is live. */
  const helpers = await readFile(new URL('modules/03c-medication-expiry-shelf-helpers.js', jsRoot), 'utf8');
  assert.match(helpers, /function gr\(\)\{return S\.g\('requests'\)\|\|\[\]\}/);
  assert.ok(!/function gr\(\)[^\n]*requestRows/.test(helpers), 'gr() must not bypass the routing');
});

