import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';

/* A pending crash cart report is answered through "Respond to report" — the
   pharmacy response that records the new seal number and closes the report.

   There used to be Accept / Reject buttons beside it. Accept deducted the
   quantities and closed the report with no new seal and no pharmacy response,
   which left the trolley unsealed. They were removed on purpose; these
   assertions keep them from coming back and keep the Respond route reachable. */

const cards = fs.readFileSync(new URL('../public/assets/js/modules/44-ccx-inventory-redesign-script.js', import.meta.url), 'utf8');
const impl = fs.readFileSync(new URL('../public/assets/js/modules/52-r635-master-backup-delete-and-crash-print-sync.js', import.meta.url), 'utf8');

test('a pending crash cart report offers Respond, and only Respond', () => {
  assert.match(cards, /data-clickact="ccxOpenReport"/);
  assert.match(cards, /var actions=\(isPending\|\|r\.status==='open'\)&&canOperate/);
  assert.doesNotMatch(cards, /ccxAcceptReport|ccxRejectReport/);
  assert.doesNotMatch(cards, /Accept<\/button>|Reject<\/button>/);
});

test('the browser no longer has accept or reject shortcuts for a report', () => {
  assert.doesNotMatch(impl, /window\.ccAcceptReport/);
  assert.doesNotMatch(impl, /window\.ccRejectReport/);
  assert.doesNotMatch(impl, /fsCallFunction\('acceptCrashCartReport'/);
  assert.doesNotMatch(impl, /fsCallFunction\('rejectCrashCartReport'/);
});

test('no marker is written that nothing reads', () => {
  assert.doesNotMatch(impl, /__r676SecureCallable/);
});
