#!/usr/bin/env node
/**
 * Phase 7b migration: crash_cart_reports state-doc array → individual collection docs.
 *
 * Usage (from the repo root; firebase-admin is resolved from
 * functions/node_modules automatically regardless of cwd):
 *   # Dry run (prints what would be written, no writes):
 *   node scripts/migrate-crash-cart-reports.cjs --dry-run
 *
 *   # Legacy (non-tenant) installation:
 *   node scripts/migrate-crash-cart-reports.cjs
 *
 *   # Tenant installation (replace TENANT_ID):
 *   node scripts/migrate-crash-cart-reports.cjs --tenant TENANT_ID
 *
 * Prerequisites:
 *   GOOGLE_APPLICATION_CREDENTIALS env var pointing to a service-account JSON
 *   with Firestore read/write access, OR run inside a Firebase Functions shell.
 *
 * The script is idempotent: re-running it overwrites existing collection docs
 * with the same data (no harm, no duplicates — report IDs are the doc keys).
 */

'use strict';

const path = require('node:path');
// firebase-admin is only installed under functions/node_modules, not at the
// repo root — resolve it explicitly so this script works from any cwd.
const admin = require(require.resolve('firebase-admin', { paths: [path.join(__dirname, '../functions')] }));

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const tenantIdx = args.indexOf('--tenant');
const tenantId = tenantIdx >= 0 ? args[tenantIdx + 1] : null;

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

async function migrate() {
  // Resolve source (state doc) and target (collection) paths.
  const sourceRef = tenantId
    ? db.collection('tenants').doc(tenantId).collection('state').doc('crash_cart_reports')
    : db.collection('floorstock_state').doc('crash_cart_reports');
  const targetCollection = tenantId
    ? db.collection('tenants').doc(tenantId).collection('crash_cart_reports')
    : db.collection('crash_cart_reports_v2');

  console.log('Source:', sourceRef.path);
  console.log('Target:', targetCollection.path);
  if (dryRun) console.log('DRY RUN — no writes will occur.\n');

  const snap = await sourceRef.get();
  if (!snap.exists) {
    console.log('Source document does not exist. Nothing to migrate.');
    return;
  }

  const data = snap.data();
  const reports = Array.isArray(data.value) ? data.value : [];
  console.log(`Found ${reports.length} report(s) in the state document.`);

  if (reports.length === 0) {
    console.log('Nothing to migrate.');
    return;
  }

  // Write in batches of 400 (Firestore limit is 500 per batch).
  const BATCH_SIZE = 400;
  let written = 0;
  const now = admin.firestore.FieldValue.serverTimestamp();

  for (let i = 0; i < reports.length; i += BATCH_SIZE) {
    const chunk = reports.slice(i, i + BATCH_SIZE);
    if (dryRun) {
      chunk.forEach((r) => console.log('  would write:', r.id, '—', r.status, r.cartId));
      written += chunk.length;
      continue;
    }

    const batch = db.batch();
    for (const report of chunk) {
      if (!report || !report.id) {
        console.warn('  skipping malformed report (no id):', JSON.stringify(report));
        continue;
      }
      const docRef = targetCollection.doc(report.id);
      batch.set(docRef, { ...report, _migratedAt: now }, { merge: false });
    }
    await batch.commit();
    written += chunk.length;
    console.log(`  wrote batch ${Math.floor(i / BATCH_SIZE) + 1}: ${chunk.length} docs (total so far: ${written})`);
  }

  console.log(`\nMigration complete. ${written} report(s) ${dryRun ? 'would have been' : 'were'} written.`);
  console.log('The original state document was NOT modified — it remains the live source until client code is updated.');
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
