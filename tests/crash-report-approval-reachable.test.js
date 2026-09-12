import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';

/* The accept/reject workflow had a deployed Cloud Function, a working client
   function, and no way in: the buttons that called ccAcceptReport/ccRejectReport
   were dropped when modules 27/43/45/63/66 were merged into thematic hosts, and
   nothing noticed because window.ccAcceptReport.__r676SecureCallable = true —
   a marker nothing ever read — made the functions look referenced to the
   dead-code audit. These assertions are the tripwire for that whole shape. */

const cards = fs.readFileSync(new URL('../public/assets/js/modules/44-ccx-inventory-redesign-script.js', import.meta.url), 'utf8');
const impl = fs.readFileSync(new URL('../public/assets/js/modules/52-r635-master-backup-delete-and-crash-print-sync.js', import.meta.url), 'utf8');

test('a pending crash cart report offers accept and reject', () => {
  assert.match(cards, /data-clickact="ccxAcceptReport"/);
  assert.match(cards, /data-clickact="ccxRejectReport"/);
  // only while it is pending, and only to a role that may operate the cart
  assert.match(cards, /var approval=isPending&&canOperate/);
});

test('those buttons reach the functions that call the Cloud Functions', () => {
  assert.match(cards, /ccxAcceptReport:function\(el\)\{if\(typeof window\.ccAcceptReport==='function'\)window\.ccAcceptReport\(el\.dataset\.a1\)\}/);
  assert.match(cards, /ccxRejectReport:function\(el\)\{if\(typeof window\.ccRejectReport==='function'\)window\.ccRejectReport\(el\.dataset\.a1\)\}/);
  assert.match(impl, /window\.ccAcceptReport=async function/);
  assert.match(impl, /window\.ccRejectReport=async function/);
  assert.match(impl, /fsCallFunction\('acceptCrashCartReport'/);
  assert.match(impl, /fsCallFunction\('rejectCrashCartReport'/);
});

test('each call still checks the capability for itself, not just the button', () => {
  const accept = impl.slice(impl.indexOf('window.ccAcceptReport=async function'), impl.indexOf('window.ccRejectReport=async function'));
  assert.match(accept, /crashCart\.operate/);
  const reject = impl.slice(impl.indexOf('window.ccRejectReport=async function'));
  assert.match(reject.slice(0, 1200), /crashCart\.operate/);
});

test('no marker is written that nothing reads', () => {
  /* The value of __r676SecureCallable was never read anywhere. A flag with no
     reader cannot be a guarantee, but it did make dead code look alive. */
  assert.doesNotMatch(impl, /__r676SecureCallable/);
});
