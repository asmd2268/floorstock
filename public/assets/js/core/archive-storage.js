import { archiveFileName } from './archive-manifest.js?v=3da5b8801d';

/* Keeping archives in the project instead of only on one computer.

   Every archive downloads a file that is the only full-detail copy of what it
   then removes from Firestore. That made the record depend on a single device —
   one that gets wiped, replaced, or used by someone else who clears the
   downloads folder. The same file is now also uploaded to Firebase Storage in
   this project: same sign-in, rules deciding who may read it rather than a share
   link, and the contents never leave the boundary they are already protected by.
   That last point is why this is not a spreadsheet or an email attachment — the
   custody archive carries patient file numbers, doctors and reasons.

   The upload is best-effort and never gates the archive: if it fails, the master
   still has the downloaded file and is told the upload did not happen. Losing the
   convenience copy must never stop the operation that produced it. */

const ROOT = 'archives';

function storage() {
  if (!globalThis.firebase || typeof globalThis.firebase.storage !== 'function') return null;
  try { return globalThis.firebase.storage(); } catch (error) { return null; }
}

export function archiveStorageAvailable() {
  return !!storage();
}

function pathFor(manifest, fileName) {
  const kind = String(manifest.kind || 'Archive').replace(/[^A-Za-z0-9_-]/g, '-');
  return `${ROOT}/${kind}/${fileName}`;
}

/* Uploads one archive. Returns what happened rather than throwing, because every
   caller has already written the master's own copy and must continue either way. */
export async function uploadArchive(manifest, payload) {
  const service = storage();
  if (!service) return { ok: false, reason: 'Storage is unavailable in this session.' };
  const fileName = archiveFileName(manifest, 'json');
  const path = pathFor(manifest, fileName);
  try {
    const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
    const ref = service.ref(path);
    await ref.put(blob, {
      contentType: 'application/json',
      // Readable in the Firebase console without downloading the file.
      customMetadata: {
        kind: String(manifest.kind || ''),
        records: String(manifest.recordCount || 0),
        coversFrom: String(manifest.coversFrom || ''),
        coversTo: String(manifest.coversTo || ''),
        savedOn: String(manifest.savedOn || ''),
        savedOnHijri: String(manifest.savedOnHijri || ''),
        savedBy: String(manifest.savedBy || ''),
      },
    });
    return { ok: true, path, fileName };
  } catch (error) {
    console.error('Archive upload failed; the downloaded file remains the copy.', error);
    return { ok: false, reason: String((error && error.message) || error) };
  }
}

/* Every archive held in the project, newest first, with the description each one
   carries so the list is readable without opening anything. */
export async function listStoredArchives() {
  const service = storage();
  if (!service) return [];
  const root = service.ref(ROOT);
  const kinds = await root.listAll();
  const entries = [];
  for (const folder of kinds.prefixes) {
    // eslint-disable-next-line no-await-in-loop
    const files = await folder.listAll();
    for (const item of files.items) {
      // eslint-disable-next-line no-await-in-loop
      const meta = await item.getMetadata().catch(() => null);
      const custom = (meta && meta.customMetadata) || {};
      entries.push({
        name: item.name,
        path: item.fullPath,
        kind: custom.kind || folder.name,
        records: Number(custom.records) || 0,
        coversFrom: custom.coversFrom || '',
        coversTo: custom.coversTo || '',
        savedOn: custom.savedOn || (meta && meta.timeCreated ? String(meta.timeCreated).slice(0, 10) : ''),
        savedOnHijri: custom.savedOnHijri || '',
        savedBy: custom.savedBy || '',
        bytes: (meta && Number(meta.size)) || 0,
      });
    }
  }
  return entries.sort((a, b) => String(b.savedOn).localeCompare(String(a.savedOn))
    || String(b.name).localeCompare(String(a.name)));
}

export async function archiveDownloadUrl(path) {
  const service = storage();
  if (!service) return null;
  return service.ref(path).getDownloadURL();
}

export async function deleteStoredArchive(path) {
  const service = storage();
  if (!service) return false;
  await service.ref(path).delete();
  return true;
}

Object.assign(globalThis, {
  archiveStorageAvailable,
  uploadArchive,
  listStoredArchives,
  archiveDownloadUrl,
});
