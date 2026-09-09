import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

/* The three things a ward submits — a Crash Cart report, a note, and an order —
   are answered by the pharmacy, often hours later and across a shift change. A
   date alone cannot tell yesterday evening from this morning, which is exactly
   the distinction somebody needs when deciding whether a trolley has been open
   since the night shift. All three carry the time. */

const jsRoot = new URL('../public/assets/js/', import.meta.url);

test('a Crash Cart report shows the hour it was opened', async () => {
  const crashUi = await readFile(new URL('modules/44-ccx-inventory-redesign-script.js', jsRoot), 'utf8');
  assert.match(crashUi, /function fmtWhen\(v\)/);
  assert.match(crashUi, /escx\(fmtWhen\(r\.openedAt\)\)/);
  // And an expiry date stays a date: a batch expires on a day, not at an hour.
  assert.match(crashUi, /escx\(fmt\(b\.expiry\)\)/);
});

test('a note shows the hour it was raised, on both sides', async () => {
  for (const file of ['core/department-note-pharmacy-renderer.js', 'core/department-note-department-renderer.js']) {
    const source = await readFile(new URL(file, jsRoot), 'utf8');
    assert.match(source, /function noteWhen\(value\)/, file);
    assert.match(source, /noteWhen\(n\.created\)/, file);
    assert.ok(!/fmtDate\(n\.created\)/.test(source), `${file} still shows a date without the time`);
  }
});

test('an order already shows the hour it was sent', async () => {
  /* Requests were already right; this pins it so the three stay consistent. */
  const requests = await readFile(new URL('modules/03g-requests.js', jsRoot), 'utf8');
  assert.match(requests, /fmtDateTime\(r\.created\)/);
  assert.match(requests, /Submitted: '\+fmtDateTime\(r\.created\)/);
});

test('the time format is the one the app already uses everywhere', async () => {
  const stateModule = await readFile(new URL('modules/03-core-application-firebase-state-auth.js', jsRoot), 'utf8');
  assert.match(stateModule, /function fmtDateTime\(iso\)\{[\s\S]*?hour: ?'2-digit', ?minute: ?'2-digit'/);
});
