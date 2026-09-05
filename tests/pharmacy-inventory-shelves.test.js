import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const src = fs.readFileSync(new URL('../public/assets/js/modules/84-pharmacy-inventory.js', import.meta.url), 'utf8');

// Evaluate the real shipped source rather than a copy, so the test fails if the
// implementation changes. piShelfCmp is one line; piShelvesOf spans several.
function loadFn(name, re) {
  const m = re.exec(src);
  assert.ok(m, `${name} not found in the module source`);
  // eslint-disable-next-line no-eval
  return eval(`${m[0]}; ${name}`);
}
const piShelfCmp = loadFn('piShelfCmp', /^function piShelfCmp\(.*$/m);
const piShelvesOf = loadFn('piShelvesOf', /^function piShelvesOf\(cab\)\{[\s\S]*?\n\}/m);

test('shelves sort A→Z and by number, not by raw string order', () => {
  assert.deepEqual(['E','D','C','B','A'].sort(piShelfCmp), ['A','B','C','D','E']);
  // Plain string order puts "Shelf 10" before "Shelf 2", which reads as a bug.
  assert.deepEqual(['Shelf 10','Shelf 2','Shelf 1'].sort(piShelfCmp), ['Shelf 1','Shelf 2','Shelf 10']);
  assert.deepEqual(['b','A','c'].sort(piShelfCmp), ['A','b','c']);
});

test('a hand-arranged cabinet keeps its order; older cabinets fall back to name order', () => {
  const ordered = { shelves: [{ name: 'C', order: 0 }, { name: 'A', order: 1 }, { name: 'B', order: 2 }] };
  assert.deepEqual(piShelvesOf(ordered).map(s => s.name), ['C', 'A', 'B']);
  const legacy = { shelves: [{ name: 'C' }, { name: 'A' }, { name: 'B' }] };
  assert.deepEqual(piShelvesOf(legacy).map(s => s.name), ['A', 'B', 'C']);
  assert.deepEqual(piShelvesOf(null), []);
});

test('saving a cabinet never returns without saying why', () => {
  const fn = /window\.piSaveCabinet=async function\(\)\{[\s\S]*?\n\};/.exec(src)[0];
  // Every early exit must carry a message. A bare `return;` here was the dead
  // Save button: it neither saved nor explained.
  assert.doesNotMatch(fn, /if\(!room\)return;/);
  assert.doesNotMatch(fn, /if\(!cab\)return;/);
  assert.match(fn, /if\(!room\)return piToast\(/);
  assert.match(fn, /if\(!cab\)return piToast\(/);
});

test('the cabinet dialog carries its own room and cabinet id', () => {
  // Reading these back from module-level UI state let a Save target a room the
  // dialog was not opened for.
  assert.match(src, /id="pi-cab-room"/);
  assert.match(src, /id="pi-cab-id"/);
  assert.match(src, /piE\('pi-cab-room'\)/);
  assert.match(src, /piE\('pi-cab-id'\)/);
});

test('the edit path can no longer report success without changing anything', () => {
  const fn = /window\.piSaveCabinet=async function\(\)\{[\s\S]*?\n\};/.exec(src)[0];
  // It used to wrap the mutation in `if(cab){...}` and fall through to
  // "Saved ✓" when the cabinet was missing.
  assert.doesNotMatch(fn, /if\(cab\)\{/);
});

test('duplicate shelf names are rejected', () => {
  // Medicine locations are re-matched to shelves by name on edit, so two
  // shelves sharing a name would collapse onto one id.
  const fn = /window\.piSaveCabinet=async function\(\)\{[\s\S]*?\n\};/.exec(src)[0];
  assert.match(fn, /dupShelf/);
});
