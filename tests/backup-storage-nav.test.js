import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

/* Two ways the storage controls were unreachable.

   First, they were built onto pg-backup-restore, which no nav entry anywhere
   opened — the page existed and the master was permitted to see it, but nothing
   led there. Second, and the reason it was noticed: a master looking for them
   opens "System Health", which is a different page. The panels now live on
   pg-system-health, and pg-backup-restore has a nav entry of its own for the
   local backups it still holds. */

const nav = await readFile(new URL('../public/assets/js/modules/80-controlled-pharmacy-ui-redesign.js', import.meta.url), 'utf8');
const health = await readFile(new URL('../public/assets/js/modules/12-local-daily-backups-system-health.js', import.meta.url), 'utf8');
const indexHtml = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');

test('Backup & Storage is a tab, not a main navigation icon', () => {
  // The main bar is for the pages used every shift; this is an occasional master
  // tool and sits beside Subscriptions and System Health instead.
  const buildNav = nav.slice(nav.indexOf('window.buildNav=function(){'), nav.indexOf('(window.__buildNavAfterExtensions||[])'));
  assert.ok(!/items\.push\(\['pg-backup-restore'/.test(buildNav), 'it must not be a main nav entry');
  assert.match(nav, /\['pg-backup-restore','💾 Backup & Storage'\]/);
  assert.match(nav, /id==='pg-backup-restore'\)\{/, 'the tab bar renders on that page too');
});

test('every master reaches those pages, platform admin or not', () => {
  // Subscriptions exists only for a platform admin. The bar used to bail out
  // when it was missing, which left System Health and Backup & Storage
  // unreachable for a master who is not one.
  assert.match(nav, /if\(document\.getElementById\('pg-platform-subscriptions'\)\)tabs\.push/);
  assert.ok(!/if\(!subExists\)return;/.test(nav));
});

test('the entry is gated by the same rule as the page itself', () => {
  // A button carrying this data-pg is stripped for anyone who is not the actual
  // master, so the nav entry cannot outlive the permission on the page.
  assert.match(health, /\[data-pg="pg-backup-restore"\]/);
  assert.match(health, /function removeMasterOnlyForNonMaster\(\)/);
});

test('the storage panels live on the page a master calls Health', () => {
  const health = indexHtml.indexOf('id="pg-system-health"');
  const panel = indexHtml.indexOf('id="storage-cleanup"');
  const exporter = indexHtml.indexOf('id="ledger-export"');
  const backup = indexHtml.indexOf('id="pg-backup-restore"');
  assert.ok(health > -1 && panel > health, 'the cleanup panel is on System Health');
  assert.ok(exporter > health, 'so is the ledger export');
  // They must not have been left behind on the backup page as well.
  assert.ok(panel > backup ? panel > health : true);
  assert.equal((indexHtml.match(/id="storage-cleanup"/g) || []).length, 1);
  assert.equal((indexHtml.match(/id="ledger-export"/g) || []).length, 1);
  // Nothing else should claim the ids the panel renders into.
  assert.equal((indexHtml.match(/id="storage-cleanup-body"/g) || []).length, 1);
  assert.equal((indexHtml.match(/id="ledger-export-grants"/g) || []).length, 1);
});

test('the panels render when System Health opens, not behind a button', () => {
  // The document sizes and the pending migrations are what the page is worth
  // opening for; waiting behind Run Diagnostics is how they went unnoticed.
  assert.match(health, /if\(id!=='pg-system-health'\)return;/);
  assert.match(health, /renderStorageCleanup\(\)/);
  assert.match(health, /renderLedgerExport\(\)/);
});

