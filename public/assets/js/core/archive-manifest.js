import { hijriMonthKey, hijriDateLabel, currentHijriMonthKey } from './hijri-calendar.js?v=9e42fa0bb9';

/* One way of naming and describing an archive file.

   Every archive and migration downloads a file that becomes the ONLY full-detail
   copy of what it then removes. Those files were named with a raw timestamp —
   ASDHealth_Orders_Archive_2026-09-08T20-14-33-901Z.json — which says nothing
   about what is inside or which period it covers. Months later, on a shared
   computer, that is indistinguishable from any other archive: you cannot tell
   what you are looking at, whether you already have it, or whether the one that
   went missing mattered.

   A name now states the three things needed to identify a file without opening
   it: what it holds, the period it covers, and the day it was saved. The same
   facts are repeated inside the file as a manifest, and stored with the local
   copy, so a renamed file can still be identified from its contents. */

const APP = 'ASDHealth';

function pad(value) {
  return String(value).padStart(2, '0');
}

function isoDay(value) {
  const date = new Date(value);
  if (isNaN(date.getTime())) return null;
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/* The earliest and latest dates actually present in the rows, rather than the
   retention cutoff — the cutoff says what was asked for, this says what the file
   really contains. */
export function coverageOf(rows, dateFields) {
  const fields = dateFields && dateFields.length ? dateFields : ['at'];
  let earliest = null;
  let latest = null;
  (rows || []).forEach((row) => {
    if (!row) return;
    for (const field of fields) {
      const value = row[field];
      if (value == null || value === '') continue;
      const time = new Date(value).getTime();
      if (!isFinite(time)) continue;
      if (earliest === null || time < earliest) earliest = time;
      if (latest === null || time > latest) latest = time;
      break;
    }
  });
  if (earliest === null) return null;
  return {
    fromIso: new Date(earliest).toISOString(),
    toIso: new Date(latest).toISOString(),
    fromDay: isoDay(earliest),
    toDay: isoDay(latest),
    fromHijri: hijriMonthKey(earliest),
    toHijri: hijriMonthKey(latest),
  };
}

function actor() {
  const user = globalThis.CU || {};
  return String(user.username || user.email || user.id || '').trim();
}

/* kind: a short slug naming what the file holds, e.g. 'Orders'.
   rows: what is being written, used to work out the real coverage.
   dateFields: which field on a row carries its date, most specific first. */
export function buildArchiveManifest({ kind, rows, dateFields, note }) {
  const savedAt = new Date();
  const coverage = coverageOf(rows, dateFields);
  return {
    format: `${APP}-Archive`,
    manifestVersion: 1,
    kind,
    recordCount: (rows || []).length,
    coversFrom: coverage ? coverage.fromIso : null,
    coversTo: coverage ? coverage.toIso : null,
    coversFromHijri: coverage ? coverage.fromHijri : null,
    coversToHijri: coverage ? coverage.toHijri : null,
    savedAt: savedAt.toISOString(),
    savedOn: isoDay(savedAt),
    savedOnHijri: hijriDateLabel(savedAt),
    savedHijriMonth: currentHijriMonthKey(),
    savedBy: actor(),
    // So a file found later can be traced back to the installation it came from.
    project: String((globalThis.FIREBASE_CONFIG && globalThis.FIREBASE_CONFIG.projectId) || ''),
    tenantId: String((globalThis.CU && globalThis.CU.tenantId) || ''),
    note: note || '',
  };
}

/* ASDHealth_Orders_2024-03-14_to_2025-09-08_saved_2026-09-09.json

   Readable at a glance and sorts sensibly in a folder listing. A file with no
   usable dates says so rather than pretending to a coverage it cannot state. */
export function archiveFileName(manifest, extension) {
  const parts = [APP, String(manifest.kind || 'Archive').replace(/\s+/g, '-')];
  if (manifest.coversFrom && manifest.coversTo) {
    const from = isoDay(manifest.coversFrom);
    const to = isoDay(manifest.coversTo);
    parts.push(from === to ? from : `${from}_to_${to}`);
  } else {
    parts.push('no-dated-records');
  }
  parts.push(`saved_${manifest.savedOn}`);
  return `${parts.join('_')}.${extension}`;
}

/* The sentence shown in the confirmation dialog, so the master reads the same
   description that is about to be written into the file and its name. */
export function describeArchive(manifest, fileName) {
  const period = manifest.coversFrom && manifest.coversTo
    ? `${isoDay(manifest.coversFrom)} → ${isoDay(manifest.coversTo)}`
      + (manifest.coversFromHijri ? ` (هجريًا ${manifest.coversFromHijri} → ${manifest.coversToHijri})` : '')
    : 'no dated records';
  return `File: ${fileName}\n`
    + `Contents: ${manifest.recordCount} ${manifest.kind} record(s)\n`
    + `Covers: ${period}\n`
    + `Saved: ${manifest.savedOn} (${manifest.savedOnHijri}) by ${manifest.savedBy || 'Master'}\n`
    + `الملف يغطي الفترة أعلاه، وحُفظ بتاريخ ${manifest.savedOn}.`;
}

/* What to keep alongside the local copy, so the on-device archive list can be
   read without opening the payload. */
export function localArchiveEntry(manifest, payload) {
  return {
    id: `${manifest.savedAt.replace(/[:.]/g, '-')}_${String(manifest.kind).toLowerCase()}`,
    createdAt: manifest.savedAt,
    kind: manifest.kind,
    count: manifest.recordCount,
    coversFrom: manifest.coversFrom,
    coversTo: manifest.coversTo,
    savedOn: manifest.savedOn,
    savedOnHijri: manifest.savedOnHijri,
    savedBy: manifest.savedBy,
    payload,
  };
}

Object.assign(globalThis, {
  coverageOf,
  buildArchiveManifest,
  archiveFileName,
  describeArchive,
  localArchiveEntry,
});
