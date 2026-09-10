import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  pctChange, pctArrow, qLabel, svcSub, hoursLabel,
  renderKpis, renderMedTable, renderZeroDispense, renderQuarterTable,
} from '../public/assets/js/core/analytics-report-sections.js';

/* Sixth slice out of modules/73: the report's blocks. Statistics in, markup
   out — which is the only reason any of this can be tested. */

test('a change against nothing is no change at all', () => {
  /* A prior period of zero has no percentage: "+100% against nothing" is a
     number nobody can act on, and it used to be printed as one. */
  assert.equal(pctChange(10, 0), null);
  assert.equal(pctArrow(pctChange(10, 0)), '');
  assert.equal(pctChange(15, 10), 50);
  assert.equal(pctChange(5, 10), -50);
  assert.equal(pctChange(10, 10), 0);
});

test('the arrow says which way, and a flat period says so', () => {
  assert.match(pctArrow(12), /↑12%/);
  assert.match(pctArrow(-12), /↓12%/, 'a fall is shown as a fall, not as a negative rise');
  assert.match(pctArrow(0), /→ 0%/);
});

test('a measure is always shown with the sample it was computed over', () => {
  /* A period whose history is partly archived can only measure some of these.
     Showing the denominator makes a small sample visibly small. */
  assert.equal(svcSub(0, 'orders'), 'not recorded / غير مسجل');
  assert.equal(svcSub(7, 'orders'), 'over 7 orders');
});

test('turnaround is written in the unit that reads naturally at that scale', () => {
  assert.equal(hoursLabel(null), '—');
  assert.equal(hoursLabel(0.5), '30 min');
  assert.equal(hoursLabel(6.25), '6.3 h');
  assert.equal(hoursLabel(72), '3 d');
});

test('quarters are named in both languages', () => {
  assert.match(qLabel(1), /Q1/);
  assert.match(qLabel(1), /الأول/);
  assert.match(qLabel(4), /الرابع/);
});

const stats = (over = {}) => ({
  orders: 10, units: 100, departments: { icu: { zeroDispenseReqs: 0 } },
  service: { fillRate: 0.99, medianTurnaroundHours: 4, onTimeRate: 0.95, ordersWithItems: 10, turnaroundSample: 10, scheduledOrders: 8, partiallyFilled: 0, unfilled: 0, highAlertShare: 0.1, highAlertUnits: 10 },
  ...over,
});

test('a fill rate below target is flagged, not celebrated', () => {
  /* Below 95% of requested units reaching the ward is worth looking at. */
  const good = renderKpis(stats(), null);
  const poor = renderKpis(stats({ service: { ...stats().service, fillRate: 0.6 } }), null);
  assert.match(good, /anl-kpi good/);
  assert.match(poor, /anl-kpi zero/);
});

test('with no prior period the KPI row still renders, without deltas', () => {
  const html = renderKpis(stats(), null);
  assert.match(html, /Fill rate/);
  assert.doesNotMatch(html, /arw up|arw dn/);
  assert.match(html, /vs prior period/);
});

test('a measure that was never recorded prints a dash, not a zero', () => {
  const html = renderKpis(stats({ service: { fillRate: null, medianTurnaroundHours: null, onTimeRate: null } }), null);
  assert.match(html, /—/);
  assert.doesNotMatch(html, />0%</, 'nothing recorded must not read as zero percent');
});

test('an empty section says why it is empty, in both languages', () => {
  const empty = renderMedTable([], 'No medicines / لا توجد أدوية');
  assert.match(empty, /anl-empty/);
  assert.match(empty, /No medicines/);
  assert.match(empty, /لا توجد أدوية/);
  assert.match(renderZeroDispense([]), /No zero-dispense requests/);
});

test('medicine names are escaped', () => {
  const html = renderMedTable([{ name: '<img src=x onerror=alert(1)>', qty: 5, depts: {} }], 'none');
  assert.doesNotMatch(html, /<img/);
});

test('the quarterly table stops at the quarter we are living through', () => {
  /* A quarter nobody has lived through holds no rows, so comparing it with the
     one before printed "-100%" — and painted it green, as though dispensing
     having stopped were good news. */
  const now = new Date();
  const html = renderQuarterTable(now.getFullYear());
  const currentQuarter = Math.floor(now.getMonth() / 3) + 1;
  assert.match(html, /In progress \/ جارٍ/, 'the running quarter is labelled, not compared');
  assert.doesNotMatch(html, /#10b981/, 'no fall is ever coloured as success');
  for (let q = currentQuarter + 1; q <= 4; q += 1) {
    assert.doesNotMatch(html, new RegExp(`<b>Q${q} `), `Q${q} has not happened yet`);
  }
  if (currentQuarter < 4) assert.match(html, /not started yet \/ لم تبدأ بعد/);
});

test('a past year shows all four quarters, none of them partial', () => {
  const html = renderQuarterTable(new Date().getFullYear() - 2);
  for (let q = 1; q <= 4; q += 1) assert.match(html, new RegExp(`<b>Q${q} `));
  assert.doesNotMatch(html, /In progress/);
});
