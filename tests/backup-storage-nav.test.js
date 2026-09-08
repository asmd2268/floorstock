import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

/* pg-backup-restore holds the local backups, the System Health figures and the
   storage cleanup panel — the document-size gauge and every archive/migration
   action. The page existed and the master was permitted to see it, but no nav
   entry anywhere opened it, so all of that was unreachable in the UI. */

const nav = await readFile(new URL('../public/assets/js/modules/80-controlled-pharmacy-ui-redesign.js', import.meta.url), 'utf8');
const health = await readFile(new URL('../public/assets/js/modules/12-local-daily-backups-system-health.js', import.meta.url), 'utf8');
const indexHtml = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');

test('the master has a way into the page that holds the cleanup panel', () => {
  const buildNav = nav.slice(nav.indexOf('window.buildNav=function(){'), nav.indexOf('(window.__buildNavAfterExtensions||[])'));
  assert.match(buildNav, /items\.push\(\['pg-backup-restore'/);
  assert.match(buildNav, /isMasterActual\(\)/, 'the entry is master-only');
});

test('the entry is gated by the same rule as the page itself', () => {
  // A button carrying this data-pg is stripped for anyone who is not the actual
  // master, so the nav entry cannot outlive the permission on the page.
  assert.match(health, /\[data-pg="pg-backup-restore"\]/);
  assert.match(health, /function removeMasterOnlyForNonMaster\(\)/);
});

test('the panel really does live on that page', () => {
  const page = indexHtml.indexOf('id="pg-backup-restore"');
  const panel = indexHtml.indexOf('id="storage-cleanup"');
  const exporter = indexHtml.indexOf('id="ledger-export"');
  assert.ok(page > -1 && panel > page, 'the cleanup panel is inside the backup page');
  assert.ok(exporter > page, 'so is the ledger export');
  // Nothing else should claim the ids the panel renders into.
  assert.equal((indexHtml.match(/id="storage-cleanup-body"/g) || []).length, 1);
  assert.equal((indexHtml.match(/id="ledger-export-grants"/g) || []).length, 1);
});
