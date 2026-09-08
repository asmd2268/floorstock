/* Storage cleanup registry — one owner, one registry, no wrappers.

   Every floorstock_state key is a single Firestore document capped at 1 MiB.
   Array-shaped keys (requests, controlled_moves, audit_log, …) grow with use
   until a write is simply refused: a hard failure, not a slowdown. Module 12
   already MEASURES that pressure (fsMeasureStateDocuments) but the actions
   that RELIEVE it lived in unrelated places — cleanupOldOrders behind a button
   on the Requests page, archiveOldControlledMoves behind another in the
   custody log — so a master watching the gauge climb had nowhere to act.

   This module owns the mapping "watched key -> the action that shrinks it".
   Owners register their own cleaner here at import time; nothing wraps or
   re-publishes anyone else's function, and adding a newly-unbounded key is one
   registerStorageCleanup call in the module that owns that key. */

const cleaners = new Map();

export const FIRESTORE_DOC_LIMIT = 1048576;

/* key    : the floorstock_state document id this action shrinks
   label  : bilingual button text
   hint   : what the action actually does, shown under the bar
   run    : async () => void — owns its own confirmation and permission check
   canRun : optional () => boolean, gates the button (defaults to master-only) */
export function registerStorageCleanup({ key, label, hint, run, canRun }) {
  if (!key || typeof run !== 'function') return;
  /* One action per key, for the same reason publishLegacy allows one owner per
     name: a second registration would silently replace the first and the panel
     would offer an action nobody meant to put there. */
  if (cleaners.has(String(key))) {
    throw new Error(`A storage cleanup action is already registered for ${key}.`);
  }
  cleaners.set(String(key), { key: String(key), label: label || 'Clean up', hint: hint || '', run, canRun });
}

export function storageCleanupFor(key) {
  return cleaners.get(String(key)) || null;
}

export function storageCleanupKeys() {
  return [...cleaners.keys()];
}

function isMaster() {
  const user = globalThis.CU;
  return !!(user && user.master === true);
}

function sizeLabel(bytes) {
  if (bytes >= 1048576) return (bytes / 1048576).toFixed(2) + ' MB';
  if (bytes >= 1024) return Math.round(bytes / 1024) + ' KB';
  return bytes + ' B';
}

function severity(pct) {
  if (pct >= 85) return 'bad';
  if (pct >= 70) return 'warn';
  if (pct >= 50) return 'near';
  return 'ok';
}

/* Renders the gauge list into #storage-cleanup-body. Reads the same measurement
   module 12 already exposes, so the panel and the login-time warning can never
   disagree about which document is under pressure. */
export function renderStorageCleanup() {
  const host = document.getElementById('storage-cleanup-body');
  if (!host) return;
  if (!isMaster()) { host.innerHTML = '<div class="fhint">Master access only / للماستر فقط</div>'; return; }

  const measure = globalThis.fsMeasureStateDocuments;
  const docs = typeof measure === 'function' ? measure() : [];
  if (!docs.length) { host.innerHTML = '<div class="fhint">No measurable records yet / لا توجد سجلات للقياس بعد</div>'; return; }

  const escape = globalThis.fsEsc || ((value) => String(value));

  /* Every state document is measured, which is dozens of them, and most are
     configuration a few hundred bytes long. Listing all of them would bury the
     handful under pressure. Anything worth acting on is shown in full — over 1%
     of the cap, or carrying an action, or a family whose size is worth watching —
     and the rest are counted in one line with their largest, so nothing is hidden
     and nothing has to be scrolled past. */
  const notable = (doc) => doc.pct >= 1 || doc.uncapped || doc.months != null || !!storageCleanupFor(doc.key);
  const shown = docs.filter(notable);
  const rest = docs.filter((doc) => !notable(doc));
  const restLargest = rest.reduce((max, doc) => (doc.pct > (max ? max.pct : -1) ? doc : max), null);

  host.innerHTML = shown.map((doc) => {
    const cleaner = storageCleanupFor(doc.key);
    const pct = Math.min(100, doc.pct);
    const action = cleaner && (typeof cleaner.canRun === 'function' ? cleaner.canRun() : true)
      ? `<button class="btn bg bsm" type="button" data-storage-cleanup="${escape(doc.key)}">${escape(cleaner.label)}</button>`
      : '<span class="fhint">No archive action / لا يوجد إجراء أرشفة</span>';
    /* A collection-backed key has one document per row, so the 1 MiB cap does not
       apply to it and a progress bar against that cap would be meaningless. Show
       what it actually holds instead. */
    /* Three different things can appear on this line, and conflating them misleads:
       a plain document is measured against the cap; a collection has no cap; and a
       Hijri-month ledger is many documents, where the total says how much is held
       but only the fullest single month can actually hit the cap. */
    const scale = doc.uncapped
      ? `${escape(sizeLabel(doc.bytes))}${doc.rows == null ? '' : ` · ${doc.rows} records`} · no size limit`
      : doc.months
        ? `${escape(sizeLabel(doc.bytes))} across ${doc.months} ${doc.calendar === 'gregorian' ? '' : 'Hijri '}month${doc.months === 1 ? '' : 's'}`
          + `${doc.rows == null ? '' : ` · ${doc.rows} records`} · fullest month ${doc.pct.toFixed(1)}% of 1 MiB`
        : `${escape(sizeLabel(doc.bytes))} · ${doc.pct.toFixed(1)}% of 1 MiB`;
    const bar = doc.uncapped
      ? '<div class="storage-bar storage-bar-uncapped"><span style="width:100%"></span></div>'
      : `<div class="storage-bar"><span style="width:${pct.toFixed(1)}%"></span></div>`;
    return `<div class="storage-row" data-sev="${doc.uncapped ? 'uncapped' : severity(doc.pct)}">
      <div class="storage-row-head">
        <span class="storage-key">${escape(doc.months ? doc.key.replace(/_ledger$/, '') + (doc.calendar === 'gregorian' ? ' (by month)' : ' (by Hijri month)') : doc.key)}</span>
        <span class="storage-size">${scale}</span>
      </div>
      ${bar}
      <div class="storage-row-foot">
        <span class="fhint">${escape(cleaner ? cleaner.hint : '')}</span>
        ${action}
      </div>
    </div>`;
  }).join('') + (rest.length
    ? `<div class="storage-rest fhint">${rest.length} smaller record(s) — largest is `
      + `${escape(restLargest ? restLargest.key : '')} at ${restLargest ? restLargest.pct.toFixed(1) : '0'}% of 1 MiB`
      + `<br/>${rest.length} سجلات أصغر، أكبرها ${escape(restLargest ? restLargest.key : '')}</div>`
    : '');
}

/* One delegated listener on the panel, installed once. Individual buttons are
   re-rendered on every refresh, so per-button listeners would leak. */
let installed = false;
export function installStorageCleanupPanel() {
  if (installed) return;
  const host = document.getElementById('storage-cleanup-body');
  if (!host) return;
  installed = true;
  host.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-storage-cleanup]');
    if (!button) return;
    const cleaner = storageCleanupFor(button.getAttribute('data-storage-cleanup'));
    if (!cleaner) return;
    button.disabled = true;
    try {
      await cleaner.run();
    } catch (error) {
      console.error('Storage cleanup failed for', cleaner.key, error);
      /* "Cleanup failed" on its own is unactionable: it sent a master back to the
         browser console to find out why, or to us. The reason Firestore gave is
         the whole diagnosis — a rejected write says permission-denied, a shape
         mismatch says so — so it is shown. */
      const reason = String((error && (error.message || error.code)) || error || 'unknown error');
      if (typeof globalThis.toast === 'function') {
        globalThis.toast(`${cleaner.label.split(' / ')[0]} failed — nothing was deleted.\n${reason}\nفشلت العملية ولم يُحذف شيء: ${reason}`, 'err');
      }
    } finally {
      button.disabled = false;
      renderStorageCleanup();
    }
  });
}

globalThis.renderStorageCleanup = renderStorageCleanup;
globalThis.installStorageCleanupPanel = installStorageCleanupPanel;
