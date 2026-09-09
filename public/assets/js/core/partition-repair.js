import { dedupeMonthPartitions, monthPartitionedKeyNames } from './month-partitioned-store.js?v=405d877017';
import { registerAutoMaintenance } from './state-maintenance.js?v=3b19eb92e8';
import { registerStorageCleanup } from './storage-cleanup.js?v=48f4075c4b';

/* Repairs rows a re-run migration duplicated.

   A migration decided it was still pending by asking S.g whether the key held an
   array — but after migrating, S.g returns the rows joined from the partitions,
   which is also an array. So a finished migration looked unfinished, ran again,
   read its own partition rows and appended them back: 202 orders became 1,312.
   The cause is fixed in legacy-state-doc.js; this removes what it wrote.

   An id addresses one row — every writer in the partition store replaces a row
   in place rather than adding a second with the same id — so two rows sharing an
   id are the same row written twice, and dropping the later copy loses nothing.
   The first occurrence is kept.

   It runs on a master session because duplicated orders are wrong on every
   screen and in every count until they are gone, and because a master is the
   only session that holds every partition. */

function isMaster() {
  return !!(globalThis.CU && globalThis.CU.master === true);
}

export async function repairDuplicatedPartitions({ silent } = {}) {
  if (!isMaster()) {
    if (!silent) globalThis.toast('Only Master can repair the monthly records.', 'err');
    return null;
  }
  const repaired = [];
  for (const key of monthPartitionedKeyNames()) {
    // eslint-disable-next-line no-await-in-loop
    const result = await dedupeMonthPartitions(key);
    if (result) repaired.push(result);
  }
  if (!repaired.length) {
    if (!silent) globalThis.toast('No duplicated rows found — every monthly record holds each row once. / لا توجد صفوف مكررة.', 'info');
    return null;
  }
  const removed = repaired.reduce((total, entry) => total + entry.removed, 0);
  /* Per key, before and after: a total alone cannot tell you whether a record is
     actually back to its real size, which is the only question worth asking
     after a repair like this. */
  const detail = repaired.map((entry) => `${entry.key} ${entry.before}→${entry.after}`).join(' · ');
  console.info('[partition-repair]', detail);
  if (!silent) {
    globalThis.toast(`${removed} duplicated row(s) removed.\n${detail}`, 'succ');
  }
  return { removed, detail, keys: repaired.map((entry) => entry.key) };
}

registerAutoMaintenance({
  key: 'partition_duplicate_repair',
  describe: (result) => result.detail,
  run: () => repairDuplicatedPartitions({ silent: true }),
});

registerStorageCleanup({
  key: 'partition_duplicates',
  label: 'Remove duplicated rows / إزالة الصفوف المكررة',
  hint: 'Removes rows a re-run migration wrote twice. An id addresses one row, so the second copy is the same row and dropping it loses nothing.',
  run: () => repairDuplicatedPartitions({}),
  canRun: () => isMaster(),
});

Object.assign(globalThis, { repairDuplicatedPartitions });
