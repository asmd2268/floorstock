import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { topMedicines, topShortfalls, departmentFillRates, detectQuantityOutliers } from '../public/assets/js/core/analytics-engine.js';

const engine = fs.readFileSync(new URL('../public/assets/js/core/analytics-engine.js', import.meta.url), 'utf8');
const report = fs.readFileSync(new URL('../public/assets/js/modules/73-r676-analytics-quarterly-annual-reports.js', import.meta.url), 'utf8');

// Buckets are keyed by normalised medicine identity so two spellings of one
// medicine stop splitting their units; the readable spelling has to survive
// that change or every report would print the normalised key instead.
test('topMedicines reports the stored display name, not the bucket key', () => {
  const out = topMedicines({
    'paracetamol500mgtablet': { name: 'Paracetamol 500 mg Tablet', qty: 944, depts: { EMERGENCY: 944 } }
  }, 10);
  assert.equal(out[0].name, 'Paracetamol 500 mg Tablet');
  assert.equal(out[0].key, 'paracetamol500mgtablet');
  assert.equal(out[0].qty, 944);
});

test('a bucket written without a display name still renders something readable', () => {
  const out = topMedicines({ 'somekey': { qty: 3, depts: {} } }, 10);
  assert.equal(out[0].name, 'somekey');
});

test('medicine buckets are keyed through the shared normaliser, not the raw name', () => {
  assert.match(engine, /function medKey\(name\)/);
  assert.match(engine, /globalThis\.fsR17MedNorm/);
  assert.match(engine, /bucket\[key\] = \{ name: med\.name/);
  // The raw-name key was the defect; it must not come back.
  assert.doesNotMatch(engine, /bucket\[med\.name\]/);
});

test('spike rows carry a display label rather than the normalised key', () => {
  assert.match(engine, /medicine: medLabel\(med\)/);
  assert.doesNotMatch(engine, /medicine: med,/);
});

// A quarter nobody has lived through was compared against the one before it,
// producing "-100%" painted green -- in a dispensing report, a collapse to zero
// is never good news and a future quarter is not a collapse at all.
test('the quarterly table stops at the current quarter and never colours a fall green', () => {
  const fn = report.slice(report.indexOf('function renderQuarterTable'), report.indexOf('function renderDeptBars'));
  assert.match(fn, /currentQuarter/);
  assert.match(fn, /q <= lastQuarter/);
  assert.match(fn, /In progress \/ جارٍ/);
  assert.match(fn, /not started yet \/ لم تبدأ بعد/);
  assert.doesNotMatch(fn, /#10b981/);
});

test('the running quarter is excluded from the trend baseline', () => {
  const fn = report.slice(report.indexOf('function renderQuarterTable'), report.indexOf('function renderDeptBars'));
  assert.match(fn, /if \(!partial\) prev = st\.units;/);
});

// Print fidelity: browsers drop backgrounds and repeat nothing unless told.
test('report stylesheets keep colour, repeat headers and align figures on paper', () => {
  assert.match(report, /print-color-adjust:exact/);
  assert.match(report, /thead\{display:table-header-group\}/);
  assert.match(report, /font-variant-numeric:tabular-nums/);
  // Striping must never repaint rows that carry a semantic colour.
  assert.doesNotMatch(report, /[^)]tbody tr:nth-child\(even\)/);
});

// ── Short supply, fill rate, and quantity hygiene ──────────────────────────

test('short-supplied medicines rank by units missing, not by percentage', () => {
  const stats = { shortfalls: {
    big:   { name: 'Oxytocin 5U/ml', requested: 1000, served: 100, short: 900, depts: { DELIVERY: 900 } },
    small: { name: 'Rare item',      requested: 3,    served: 0,   short: 3,   depts: { ICU: 3 } },
    ok:    { name: 'Fully supplied', requested: 50,   served: 50,  short: 0,   depts: {} }
  } };
  const out = topShortfalls(stats);
  // 3-of-3 is 0% filled and 900-of-1000 is 10%, so a percentage sort would put
  // the stray order first; units short is what a purchasing decision needs.
  assert.deepEqual(out.map(m => m.name), ['Oxytocin 5U/ml', 'Rare item']);
  assert.equal(out[0].fillRate, 10);
});

test('departments are listed worst-served first and ones that asked for nothing are omitted', () => {
  const stats = { departments: {
    ER:  { requested: 100, served: 99,  fillRate: 99 },
    ICU: { requested: 200, served: 100, fillRate: 50 },
    OPD: { requested: 0,   served: 0,   fillRate: null }
  } };
  const out = departmentFillRates(stats);
  assert.deepEqual(out.map(d => d.dept), ['ICU', 'ER']);
  assert.equal(out[0].short, 100);
});

// detectQuantityOutliers reaches the medicine resolver, which reads window.
function withWindow(fn) {
  const had = 'window' in globalThis, prev = globalThis.window;
  globalThis.window = { gd: () => [{ id: 'd1', name: 'EMERGENCY' }], S: { g: () => [] } };
  try { return fn(); } finally { if (had) globalThis.window = prev; else delete globalThis.window; }
}
const dispensedRow = (qty) => ({ deptId: 'd1', fulfilledAt: '2026-03-01T00:00:00Z', dispensed: [{ name: 'Paracetamol 500 mg Tablet', qty }] });

test('a mistyped quantity is flagged against the medicine\'s own history', () => {
  const found = withWindow(() => detectQuantityOutliers([10,12,11,9,10,13,10,11,12,1200].map(dispensedRow)));
  assert.equal(found.length, 1);
  assert.equal(found[0].qty, 1200);
  assert.equal(found[0].typical, 11);
});

test('ordinary variation is not flagged', () => {
  assert.equal(withWindow(() => detectQuantityOutliers([10,12,11,9,10,13,10,11,12,20].map(dispensedRow))).length, 0);
});

test('a medicine without enough history is left alone', () => {
  // "Normal" is meaningless on five entries; guessing there would cost trust.
  assert.equal(withWindow(() => detectQuantityOutliers([10,10,10,10,9999].map(dispensedRow))).length, 0);
});

test('a perfectly uniform history still catches a wild value', () => {
  // MAD is 0 here, which would make every robust score infinite; the
  // multiple-of-normal test has to carry the decision instead.
  assert.equal(withWindow(() => detectQuantityOutliers([5,5,5,5,5,5,5,5,100].map(dispensedRow))).length, 1);
});

test('small everyday quantities do not produce a flood of flags', () => {
  assert.equal(withWindow(() => detectQuantityOutliers([1,2,1,1,2,1,2,1,3].map(dispensedRow))).length, 0);
});

test('archived monthly rows are excluded from quantity checks', () => {
  // One synthetic row standing for a whole month has no per-entry quantity to judge.
  const rows = [10,12,11,9,10,13,10,11,12].map(dispensedRow);
  rows.push(Object.assign(dispensedRow(5000), { __aggregated: true }));
  assert.equal(withWindow(() => detectQuantityOutliers(rows)).length, 0);
});

test('requested-vs-dispensed is matched per medicine, never as two grand totals', () => {
  const engine = fs.readFileSync(new URL('../public/assets/js/core/analytics-engine.js', import.meta.url), 'utf8');
  assert.match(engine, /const wantByMed = \{\}, gotByMed = \{\}/);
  assert.match(engine, /Math\.min\(gotByMed\[key\] \|\| 0, want\)/);
});
