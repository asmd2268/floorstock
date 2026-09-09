import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  fsR12DateOnly,
  fsR12ExpiryDays,
  fsR12HasNearExpiry,
  fsR12BatchSummaryHtml,
  fsR5BatchText,
  fsR5Class,
  fsR5ExpiryDays,
} from '../public/assets/js/core/controlled-expiry-format.js';

/* The eighth slice out of modules/51. These rules decide what a printed
   controlled-custody sheet says a department is holding, and none of them had a
   test: they lived inside a 1,200-line module between two DOM renderers. */

const day = (y, m, d) => Date.UTC(y, m - 1, d);

test('an expiry is a calendar day, not an instant', () => {
  // Same day, different hours, different time zone notation: one answer.
  assert.equal(fsR12DateOnly('2026-03-01'), day(2026, 3, 1));
  assert.equal(fsR12DateOnly('2026-3-1'), day(2026, 3, 1));
  assert.equal(fsR12DateOnly(new Date(2026, 2, 1, 23, 59)), day(2026, 3, 1));
  assert.equal(fsR12DateOnly(''), null);
  assert.equal(fsR12DateOnly('not a date'), null);
});

test('a batch expiring today has zero days left, not minus one', () => {
  const today = day(2026, 3, 1);
  assert.equal(fsR12ExpiryDays('2026-03-01', today), 0);
  assert.equal(fsR12ExpiryDays('2026-03-31', today), 30);
  assert.equal(fsR12ExpiryDays('2026-02-27', today), -2);
  assert.equal(fsR12ExpiryDays('', today), null);
});

test('an already-expired batch is not "near expiry" — it is a different problem', () => {
  const today = day(2026, 3, 1);
  assert.equal(fsR12HasNearExpiry([{ expiry: '2026-03-20' }], 30, today), true);
  assert.equal(fsR12HasNearExpiry([{ expiry: '2026-03-31' }], 30, today), true, 'the boundary day counts');
  assert.equal(fsR12HasNearExpiry([{ expiry: '2026-04-01' }], 30, today), false);
  assert.equal(fsR12HasNearExpiry([{ expiry: '2026-02-01' }], 30, today), false);
  assert.equal(fsR12HasNearExpiry([], 30, today), false);
  assert.equal(fsR12HasNearExpiry(null, 30, today), false);
});

test('the printed batch line renders — it used to throw on every batch', () => {
  /* fsR5BatchText called an escaper that no longer existed anywhere in the
     project, so printing a custody sheet with any batch on it raised a
     ReferenceError and produced no document at all. */
  const html = fsR5BatchText([{ expiry: '2026-03-01', qty: 4 }], true, 4);
  assert.match(html, /ctl-batch-print-line/);
  assert.match(html, /4/);
});

test('the counted total wins over per-batch quantities that say nothing', () => {
  // Older records carry the total on the row and leave every batch at zero.
  const one = fsR5BatchText([{ expiry: '2026-03-01' }], false, 7);
  assert.match(one, /^7 · Exp/);

  const three = fsR5BatchText(
    [{ expiry: '2026-03-01' }, { expiry: '2026-04-01' }, { expiry: '2026-05-01' }],
    false,
    10,
  );
  const printed = three.split(' ; ').map((part) => Number(part.split(' · ')[0]));
  assert.deepEqual(printed, [3, 3, 4], 'the remainder goes to the last batch, nothing is lost');
  assert.equal(printed.reduce((a, b) => a + b, 0), 10);
});

test('a custody sheet never prints more than what was counted', () => {
  const text = fsR5BatchText(
    [{ expiry: '2026-03-01', qty: 6 }, { expiry: '2026-04-01', qty: 6 }],
    false,
    8,
  );
  const printed = text.split(' ; ').map((part) => Number(part.split(' · ')[0]));
  assert.equal(printed.reduce((a, b) => a + b, 0), 8);
});

test('batches with no rows print a dash rather than an empty cell', () => {
  assert.equal(fsR5BatchText([], true, 5), '—');
  assert.equal(fsR12BatchSummaryHtml([]), '—');
  assert.equal(fsR12BatchSummaryHtml(null), '—');
});

test('the batch summary keeps lot, quantity and expiry on one line', () => {
  const html = fsR12BatchSummaryHtml([{ lot: 'L-1', qty: 3, expiry: '2026-03-01' }]);
  assert.match(html, /ctl-batch-line/);
  assert.match(html, /<b>L-1<\/b>/);
  assert.match(html, /chip">3</);
  assert.match(html, /ctl-batch-expiry">01\/03\/2026</);
});

test('lot numbers are escaped, not injected', () => {
  const html = fsR12BatchSummaryHtml([{ lot: '<img src=x onerror=alert(1)>', qty: 1, expiry: '2026-03-01' }]);
  assert.doesNotMatch(html, /<img/);
});

test('a row reports its earliest expiry, because that is the one that bites first', () => {
  const soon = new Date(Date.now() + 5 * 86400000).toISOString();
  const later = new Date(Date.now() + 90 * 86400000).toISOString();
  const days = fsR5ExpiryDays({ batches: [{ expiry: later }, { expiry: soon }] });
  // The nearer batch answers, not the first one listed. (4 or 5: the count is
  // floored against the clock, so it turns over the instant the test runs.)
  assert.ok(days === 5 || days === 4, `expected the near batch, got ${days}`);
  assert.equal(fsR5ExpiryDays({ batches: [] }), null);
  assert.equal(fsR5ExpiryDays({}), null);
});

test('anything not psychotropic is labelled narcotic on the sheet', () => {
  assert.match(fsR5Class('psychotropic'), /Psychotropic/);
  assert.match(fsR5Class('Psychotropic'), /Psychotropic/);
  assert.match(fsR5Class('narcotic'), /Narcotic/);
  assert.match(fsR5Class(''), /Narcotic/);
});
