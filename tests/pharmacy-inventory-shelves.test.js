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

// ── Cabinet grid and the one-page A4 map ───────────────────────────────────
// The cabinet is a grid: each shelf is one row of it, split into cells, and the
// shelves need not match. Same shape as the controlled-pharmacy storage map.

const piParseShelfLine = loadFn('piParseShelfLine', /^function piParseShelfLine\([\s\S]*?\n\}/m);
const piShelfCells = loadFn('piShelfCells', /^function piShelfCells\(.*$/m);

test('the "x N" suffix splits a shelf into cells and tolerates junk', () => {
  assert.deepEqual(piParseShelfLine('A x 4'), { name: 'A', cells: 4 });
  assert.deepEqual(piParseShelfLine('B×6'), { name: 'B', cells: 6 });
  assert.deepEqual(piParseShelfLine('Shelf 2 * 3'), { name: 'Shelf 2', cells: 3 });
  // No suffix is a single-cell shelf, so old cabinets keep working.
  assert.deepEqual(piParseShelfLine('C'), { name: 'C', cells: 1 });
  // A count of zero would render a shelf with nothing in it.
  assert.deepEqual(piParseShelfLine('Fridge x0'), { name: 'Fridge', cells: 1 });
  // Clamped, so one typo cannot produce a thousand-column row.
  assert.equal(piParseShelfLine('D x 99').cells, 40);
  // A line that is only a suffix is a name, not a broken count.
  assert.deepEqual(piParseShelfLine('x 5'), { name: 'x 5', cells: 1 });
});

test('a shelf with no recorded cell count still has one cell', () => {
  assert.equal(piShelfCells({}), 1);
  assert.equal(piShelfCells({ cells: 0 }), 1);
  assert.equal(piShelfCells({ cells: 6 }), 6);
});

test('the map never silently drops a medicine that does not fit', () => {
  const fn = /window\.piPrintCabinetMap=function[\s\S]*?\n\};/m.exec(src)[0];
  // Cells are overflow:hidden, so a crowded cell used to just stop showing
  // medicines. On a pharmacy map that is worse than an ugly page.
  assert.match(fn, /chipCap/);
  assert.match(fn, /hidden>0\?'<span class="mchip more">/);
  assert.match(fn, /list\.slice\(0,chipCap\)/);
});

test('a medicine is only drawn in a cell someone actually recorded', () => {
  const fn = /window\.piPrintCabinetMap=function[\s\S]*?\n\};/m.exec(src)[0];
  // Anything without a cell goes to the footer rather than being placed by guess.
  assert.match(fn, /unplaced\.push/);
  assert.match(fn, /c>0&&c<=piShelfCells\(sh\)/);
});

test('the map is one A4 page whatever the shelf count', () => {
  const fn = /window\.piPrintCabinetMap=function[\s\S]*?\n\};/m.exec(src)[0];
  assert.match(fn, /@page\{size:A4 portrait/);
  assert.match(fn, /overflow:hidden/);
  // Rows share the remaining height, so three shelves and twelve both fill one sheet.
  assert.match(fn, /\.srow\{flex:1 1 0/);
});

test('bilingual labels are bidi-isolated', () => {
  const fn = /window\.piPrintCabinetMap=function[\s\S]*?\n\};/m.exec(src)[0];
  // "4 shelves / أرفف" beside "Storage / مستودع" interleaves into nonsense otherwise.
  assert.match(fn, /<bdi>/);
});

test('the map button and the shelf-cell picker are allowlisted for the CSP bridge', () => {
  const bridge = fs.readFileSync(new URL('../public/assets/js/modules/59-r664-security-complete-runtime.js', import.meta.url), 'utf8');
  // An inline handler the bridge does not know is a dead button.
  assert.match(bridge, /piPrintCabinetMap/);
  assert.match(bridge, /piLocShelfChanged/);
});

test('a location remembers which cell it sits in', () => {
  assert.match(src, /cell:cell>0\?cell:null/);
  assert.match(src, /piLocRowHtml\(rooms,val,l\.expiry\|\|'',l\.cell\|\|''\)/);
});
