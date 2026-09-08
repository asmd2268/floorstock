import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import {
  hijriMonthKey, shiftHijriMonth, hijriMonthsBetween, currentHijriMonthKey, hijriMonthLabelBilingual,
} from '../public/assets/js/core/hijri-calendar.js';

/* The controlled ledger is stored one document per HIJRI month. Three facts make
   that the right shape, and each is worth a test:
     - Firestore charges per document read, so packing a month into one document
       makes reading it ~1,500x cheaper than one document per movement;
     - a month document stays far below the 1 MiB cap, which one document for the
       whole ledger does not;
     - the pharmacy's own register is kept in Hijri months, so a partition is the
       month's register and the boundaries match what the officer reports against. */

test('a Gregorian instant maps to its Umm al-Qura month', () => {
  assert.equal(hijriMonthKey('2026-09-08T10:00:00.000Z'), '1448-03');
  // Zero-padded, so plain string comparison orders months correctly — which the
  // partition listing and every range filter rely on.
  assert.match(hijriMonthKey('2026-09-08T10:00:00.000Z'), /^\d{4}-\d{2}$/);
  assert.ok('1448-02' < '1448-03');
  assert.ok('1447-12' < '1448-01');
});

test('unusable dates yield no month rather than a wrong one', () => {
  for (const value of [null, undefined, '', 'not a date', {}]) {
    assert.equal(hijriMonthKey(value), null, String(value));
  }
});

test('month arithmetic crosses the Hijri year correctly', () => {
  // The Hijri year is always twelve months, so this is exact arithmetic.
  assert.equal(shiftHijriMonth('1447-12', 1), '1448-01');
  assert.equal(shiftHijriMonth('1448-01', -1), '1447-12');
  assert.equal(shiftHijriMonth('1448-03', -12), '1447-03');
  assert.equal(shiftHijriMonth('1448-01', 24), '1450-01');
});

test('a month range is inclusive at both ends and spans year boundaries', () => {
  assert.deepEqual(hijriMonthsBetween('1447-11', '1448-02'), ['1447-11', '1447-12', '1448-01', '1448-02']);
  assert.deepEqual(hijriMonthsBetween('1448-03', '1448-03'), ['1448-03'], 'a single month is a valid range');
  // A reversed range yields nothing rather than looping.
  assert.deepEqual(hijriMonthsBetween('1448-05', '1448-02'), []);
});

test('five years of retention is sixty month documents', () => {
  const start = currentHijriMonthKey();
  const end = shiftHijriMonth(start, 59);
  assert.equal(hijriMonthsBetween(start, end).length, 60);
});

test('month labels name the Hijri month in both scripts', () => {
  const label = hijriMonthLabelBilingual('1448-09');
  assert.match(label, /Ramadan/);
  assert.match(label, /رمضان/);
});

test('the retention floor is six Hijri years, counted in Hijri months', async () => {
  const { hijriRetentionCutoffMonth, isPastHijriRetention } = await import('../public/assets/js/core/hijri-calendar.js');
  const now = new Date('2026-09-09T00:00:00.000Z');
  // Six Hijri years back from Rabi I 1448 is Rabi I 1442.
  assert.equal(hijriRetentionCutoffMonth(6, now), '1442-03');
  // Exactly 72 months, not "six times 365 days" — a Hijri year is ~11 days shorter,
  // so counting in Gregorian would quietly shorten or lengthen the floor.
  assert.equal(hijriMonthsBetween(hijriRetentionCutoffMonth(6, now), '1448-03').length, 73);

  const cutoff = hijriRetentionCutoffMonth(6, now);
  assert.equal(isPastHijriRetention('2020-01-02T00:00:00.000Z', cutoff), true);
  assert.equal(isPastHijriRetention('2024-03-14T00:00:00.000Z', cutoff), false);
  // A row on the cutoff month itself is kept, not removed.
  assert.equal(isPastHijriRetention(new Date('2020-10-20T00:00:00.000Z'), cutoff), false);
});

test('a month emptied by archiving leaves no document behind', async () => {
  const store = await readFile(new URL('../public/assets/js/core/month-partitioned-store.js', import.meta.url), 'utf8');
  // An empty partition would cost a read on every load forever and make the
  // partition list claim months that hold nothing.
  assert.match(store, /if \(!next\.length\) tx\.delete\(ref\)/);
  assert.match(store, /delete globalThis\.S\.cache\[holder\]/);
});
