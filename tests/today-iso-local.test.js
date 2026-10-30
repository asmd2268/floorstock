import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

/* todayISO used new Date().toISOString().slice(0,10), which is the UTC date. In
   Riyadh (UTC+3) that is yesterday from midnight until 3am, the hours a night
   shift works in. Every other date helper in the app (fsDaysUntil, the weekly
   grid) uses the device's local day, so this one must too. */
const source = fs.readFileSync(new URL('../public/assets/js/modules/03-core-application-firebase-state-auth.js', import.meta.url), 'utf8');
const line = source.split('\n').find((l) => l.startsWith('function todayISO()'));
const todayISO = new Function(`${line}\nreturn todayISO;`)();

test('todayISO is the local calendar day, also just after local midnight', () => {
  const RealDate = Date;
  try {
    // 2026-10-31 00:30 local; whatever the machine zone, a Date built from local parts.
    globalThis.Date = class extends RealDate { constructor(...a) { return a.length ? new RealDate(...a) : new RealDate(2026, 9, 31, 0, 30); } };
    assert.equal(todayISO(), '2026-10-31');
  } finally { globalThis.Date = RealDate; }
});

test('it no longer derives the day from the UTC string', () => {
  assert.ok(!/toISOString\(\)\.slice\(0,\s*10\)/.test(line));
});
