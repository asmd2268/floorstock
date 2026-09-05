import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { topMedicines } from '../public/assets/js/core/analytics-engine.js';

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
