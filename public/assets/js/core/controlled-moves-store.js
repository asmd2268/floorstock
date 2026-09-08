/* Document-shaped writes for the controlled/narcotic movement ledger.

   controlled_moves used to be one array inside one floorstock_state document,
   capped at 1 MiB. Regulatory retention for narcotic custody is at least five
   years of individual movements, which no single document holds — so the ledger
   was kept writable only by archiving movements out after a year and keeping
   monthly totals, which is not a five-year ledger. It is now one document per
   movement in the collection registered as `controlled_moves`, where the cap
   applies per movement and the ledger simply has no ceiling.

   Every function here writes only the documents it changes. Reads still go
   through S.g('controlled_moves'), which the collection listener keeps populated
   with the same sorted array shape the blob key produced, so nothing that reads
   the ledger had to change. */

import { collectionSpecFor } from './collection-backed-keys.js?v=15e4458489';
import { collectionRefForSpec } from './firestore-sdk-scope.js?v=f33c609381';
import { registerStorageCleanup } from './storage-cleanup.js?v=46cb1ec8ee';

const SPEC = collectionSpecFor('controlled_moves');
// Firestore refuses a batch over 500 operations; 400 leaves room for retries.
const BATCH_LIMIT = 400;

function ledgerRef() {
  if (!globalThis.FB_DB) throw new Error('Firestore is unavailable; the movement was not recorded.');
  return collectionRefForSpec(globalThis.FB_DB, SPEC, globalThis.S && globalThis.S.scopeProfile);
}

function stamp() {
  const firebase = globalThis.firebase;
  return firebase && firebase.firestore && firebase.firestore.FieldValue
    ? firebase.firestore.FieldValue.serverTimestamp()
    : new Date().toISOString();
}

/* The listener is the source of truth, but it only fires after the round trip.
   Applying the change to the cache first keeps a render that runs immediately
   after an await from showing the pre-write ledger. */
function applyLocally(rows, removedIds) {
  if (!globalThis.S || !globalThis.S.cache) return;
  const byId = {};
  (globalThis.S.cache.controlled_moves || []).forEach(row => { if (row && row.id) byId[String(row.id)] = row; });
  (rows || []).forEach(row => { if (row && row.id) byId[String(row.id)] = row; });
  (removedIds || []).forEach(id => { delete byId[String(id)]; });
  const next = Object.keys(byId).map(id => byId[id])
    .sort((a, b) => String(a.at || '').localeCompare(String(b.at || '')) || String(a.id || '').localeCompare(String(b.id || '')));
  globalThis.S.cache.controlled_moves = next;
  const tracked = globalThis.S.__collectionRowsById && globalThis.S.__collectionRowsById.controlled_moves;
  if (tracked) {
    (rows || []).forEach(row => { if (row && row.id) tracked[String(row.id)] = row; });
    (removedIds || []).forEach(id => { delete tracked[String(id)]; });
  }
}

async function commit(operations) {
  if (!operations.length) return;
  const collection = ledgerRef();
  for (let index = 0; index < operations.length; index += BATCH_LIMIT) {
    const batch = globalThis.FB_DB.batch();
    operations.slice(index, index + BATCH_LIMIT).forEach(operation => {
      if (operation.type === 'delete') batch.delete(collection.doc(operation.id));
      else batch.set(collection.doc(operation.id), Object.assign({}, operation.data, { updatedAt: stamp() }), { merge: false });
    });
    await batch.commit();
  }
}

/* Appends one or more movements. Each becomes its own document, so recording a
   movement costs exactly one write regardless of how long the ledger already is. */
export async function appendControlledMoves(moves) {
  const rows = (Array.isArray(moves) ? moves : [moves]).filter(Boolean);
  if (!rows.length) return [];
  await commit(rows.map(row => ({ type: 'set', id: String(row.id), data: row })));
  applyLocally(rows, []);
  return rows;
}

/* Replaces one movement in place — a correction, an acceptance, a rejection.
   Only that document is written; the rest of the ledger is untouched. */
export async function saveControlledMove(move) {
  if (!move || !move.id) throw new Error('A movement needs an id before it can be saved.');
  await commit([{ type: 'set', id: String(move.id), data: move }]);
  applyLocally([move], []);
  return move;
}

export async function deleteControlledMove(moveId) {
  const id = String(moveId || '');
  if (!id) return false;
  await commit([{ type: 'delete', id }]);
  applyLocally([], [id]);
  return true;
}

/* Reconciles the ledger against a complete desired array. Used only by the
   blob-to-collection migration and by rollback paths that already hold the whole
   previous ledger; ordinary edits must use the single-document functions above,
   which is why this one says so in its name. */
export async function replaceEntireControlledLedger(nextMoves) {
  const rows = (nextMoves || []).filter(row => row && row.id);
  const nextIds = new Set(rows.map(row => String(row.id)));
  const removedIds = ((globalThis.S && globalThis.S.cache && globalThis.S.cache.controlled_moves) || [])
    .map(row => String((row && row.id) || ''))
    .filter(id => id && !nextIds.has(id));
  await commit(rows.map(row => ({ type: 'set', id: String(row.id), data: row }))
    .concat(removedIds.map(id => ({ type: 'delete', id }))));
  applyLocally(rows, removedIds);
  return rows;
}

/* One-time migration: floorstock_state/controlled_moves -> the collection.

   The blob document is read, every movement is written as its own document, and
   only then is the blob removed. Nothing is deleted until the copy is confirmed,
   and the migration is safe to re-run: each movement is written under its own id,
   so a second pass overwrites identical documents rather than duplicating them. */
export async function migrateControlledMovesToCollection() {
  const user = globalThis.CU;
  if (!user || user.master !== true) {
    globalThis.toast('Only Master can migrate the controlled movement ledger.', 'err');
    return;
  }
  const blob = globalThis.S.g('controlled_moves');
  if (!Array.isArray(blob) || !blob.length) {
    if (blob !== null) {
      await globalThis.S.rm('controlled_moves');
      globalThis.toast('The legacy movement record was already empty and has been removed.', 'succ');
    } else {
      globalThis.toast('No legacy movement record found — the ledger is already a collection.', 'info');
    }
    return;
  }

  const withIds = blob.map((move, index) => Object.assign({}, move, {
    id: String((move && move.id) || `ctl_migrated_${index}_${Math.random().toString(36).slice(2, 9)}`),
  }));

  const confirmed = await globalThis.uiConfirm(
    `${withIds.length} controlled/narcotic movement(s) will be rewritten as individual records.\n\n` +
    'This removes the 1 MiB ceiling on the ledger so it can hold the required five years of movements. ' +
    'Nothing is deleted until every movement has been copied, and re-running is safe.\n\n' +
    'Continue?',
    { okText: 'Migrate the ledger' },
  );
  if (!confirmed) { globalThis.toast('Migration cancelled; nothing changed.', 'info'); return; }

  await appendControlledMoves(withIds);
  // Only now that every movement exists as its own document.
  await globalThis.S.rm('controlled_moves');
  globalThis.toast(`${withIds.length} movement(s) migrated. The ledger no longer has a size limit.`, 'succ');
}

Object.assign(globalThis, {
  appendControlledMoves,
  saveControlledMove,
  deleteControlledMove,
  replaceEntireControlledLedger,
  migrateControlledMovesToCollection,
});

/* Visible only while the legacy blob document still exists — once migrated, the
   document is gone, the gauge stops listing the key as a state document, and the
   entry disappears on its own. */
registerStorageCleanup({
  key: 'controlled_moves',
  label: 'Convert ledger to records / تحويل السجل',
  hint: 'Rewrites the movement ledger as individual records, removing its 1 MiB limit so it can hold five years of movements.',
  run: () => migrateControlledMovesToCollection(),
  canRun: () => !!(globalThis.CU && globalThis.CU.master === true)
    && Array.isArray(globalThis.S && globalThis.S.g && globalThis.S.g('controlled_moves')),
});

