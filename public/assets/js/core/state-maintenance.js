/* Automatic upkeep for records that can look after themselves.

   "Anything near the limit should trim or archive itself" is the right instinct,
   but the two halves are not the same thing and must not be automated the same
   way:

     scratch  — an undo stack. It has no reporting value, no retention
                obligation, and nothing reads it but the Undo button, which only
                ever uses the newest entry. Trimming it needs no permission from
                anyone: it is a cache with a history, not a record.

     record   — orders, movements, custody, notes, the deletion audit. These
                carry statistics and, for the controlled register, a six Hijri
                year retention floor. Archiving one means downloading its full
                detail to a device first, which cannot happen while nobody is
                watching, and deleting one to make room is exactly what this
                project refused from the start.

   So this registry automates the first and only the first. The second no longer
   needs automating to stay working: a value too large for a document is spread
   across numbered ones (see overflow-parts-store.js), so a record under pressure
   is a housekeeping matter, never a stoppage.

   Runs once per master session after state has loaded — masters only, so ten
   clients do not race to perform the same trim. */

const jobs = new Map();

/* key      : the state document this job maintains
   describe : what it did, given the result, for the one summary line
   run      : async () => result | null   (null: nothing needed doing) */
export function registerAutoMaintenance({ key, describe, run }) {
  if (!key || typeof run !== 'function') return;
  if (jobs.has(String(key))) throw new Error(`Automatic maintenance is already registered for ${key}.`);
  jobs.set(String(key), { key: String(key), describe: describe || (() => ''), run });
}

export function autoMaintenanceKeys() {
  return [...jobs.keys()];
}

function isMaster() {
  return !!(globalThis.CU && globalThis.CU.master === true);
}

export async function runAutoMaintenance() {
  if (!isMaster()) return [];
  const done = [];
  for (const job of jobs.values()) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const result = await job.run();
      if (result) done.push(job.describe(result) || job.key);
    } catch (error) {
      /* Upkeep must never be the reason a session fails to start. It is reported
         where a master will see it and retried on the next login. */
      console.warn('Automatic maintenance failed for', job.key, error);
    }
  }
  if (done.length && typeof globalThis.toast === 'function') {
    globalThis.toast(`Storage upkeep: ${done.join('؛ ')}`, 'info');
  }
  return done;
}

/* Six hours, because a master often leaves the app open all day and upkeep that
   only ever runs at login does nothing for a session that started on Sunday.
   Each job is a no-op when there is nothing to do — they read the session cache,
   not Firestore — so a repeat costs nothing. */
const UPKEEP_INTERVAL_MS = 6 * 60 * 60 * 1000;

globalThis.__startAppExtensions = globalThis.__startAppExtensions || [];
globalThis.__startAppExtensions.push(function () {
  /* Before the size check in module 12, which runs a few seconds later and
     measures what is left. A master should be warned about a record that needs a
     decision, never about one that was about to fix itself. */
  setTimeout(function () { runAutoMaintenance(); }, 3000);
  if (globalThis.__upkeepTimer) clearInterval(globalThis.__upkeepTimer);
  globalThis.__upkeepTimer = setInterval(function () {
    // Not while the tab is in the background: a write nobody is watching cannot
    // report its own failure, and there is no hurry.
    if (document.visibilityState === 'visible') runAutoMaintenance();
  }, UPKEEP_INTERVAL_MS);
});

Object.assign(globalThis, { registerAutoMaintenance});
