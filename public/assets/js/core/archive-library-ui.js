import { listStoredArchives, archiveDownloadUrl, archiveStorageAvailable } from './archive-storage.js?v=2e7d4b5e6f';

/* The list of archives held in the project, so the copies are visible and
   downloadable from inside the app rather than existing only as a folder on
   whichever computer happened to run the archive. */

function isMaster() {
  return !!(globalThis.CU && globalThis.CU.master === true);
}

function escape(value) {
  return globalThis.fsEsc ? globalThis.fsEsc(value) : String(value == null ? '' : value);
}

function sizeLabel(bytes) {
  if (bytes >= 1048576) return (bytes / 1048576).toFixed(2) + ' MB';
  if (bytes >= 1024) return Math.round(bytes / 1024) + ' KB';
  return (bytes || 0) + ' B';
}

function day(value) {
  return String(value || '').slice(0, 10);
}

let loading = false;

export async function renderArchiveLibrary() {
  const host = document.getElementById('archive-library-body');
  if (!host) return;
  if (!isMaster()) { host.innerHTML = '<div class="fhint">Master access only / للماستر فقط</div>'; return; }
  if (!archiveStorageAvailable()) {
    host.innerHTML = '<div class="fhint">Archive storage is unavailable in this session. / التخزين غير متاح في هذه الجلسة.</div>';
    return;
  }
  if (loading) return;
  loading = true;
  host.innerHTML = '<div class="fhint">Reading the archive list… / جارٍ قراءة القائمة…</div>';
  try {
    const rows = await listStoredArchives();
    if (!rows.length) {
      host.innerHTML = '<div class="fhint">No archives kept yet. One is saved here automatically each time you archive. / لا توجد أرشيفات بعد؛ تُحفظ تلقائيًا مع كل أرشفة.</div>';
      return;
    }
    host.innerHTML = rows.map((row) => {
      const covers = row.coversFrom && row.coversTo
        ? `${day(row.coversFrom)} → ${day(row.coversTo)}`
        : 'no dated records';
      return `<div class="archive-row">
        <div class="archive-main">
          <span class="archive-kind">${escape(row.kind)}</span>
          <span class="archive-covers">${escape(covers)}</span>
        </div>
        <div class="archive-meta">
          <span>${row.records} record(s) · ${escape(sizeLabel(row.bytes))}</span>
          <span>saved ${escape(row.savedOn)}${row.savedOnHijri ? ' · ' + escape(row.savedOnHijri) : ''}${row.savedBy ? ' · ' + escape(row.savedBy) : ''}</span>
        </div>
        <button class="btn bg bsm" type="button" data-archive-download="${escape(row.path)}">Download / تنزيل</button>
      </div>`;
    }).join('');
  } catch (error) {
    console.error('Could not read the archive list.', error);
    /* Firebase Storage needs a one-time setup in the console before any bucket
       exists. Until then every call fails, and saying so plainly is more use than
       repeating the raw SDK error at a master who cannot act on it. */
    const notSetUp = /not.*(exist|found)|unknown|404|bucket/i.test(String((error && error.message) || error));
    host.innerHTML = notSetUp
      ? '<div class="fhint">Archive storage is not set up for this project yet. A Master can enable it once in the Firebase console (Storage → Get Started); archives keep downloading normally in the meantime.<br/>لم يُفعَّل تخزين الأرشيف بعد. يفعّله الماستر مرة واحدة من وحدة تحكم Firebase، والتنزيل يعمل كالمعتاد حتى ذلك الحين.</div>'
      : `<div class="fhint">Could not read the archive list: ${escape((error && error.message) || error)}</div>`;
  } finally {
    loading = false;
  }
}

let installed = false;
export function installArchiveLibrary() {
  if (installed) return;
  const host = document.getElementById('archive-library');
  if (!host) return;
  installed = true;
  host.addEventListener('click', async (event) => {
    const refresh = event.target.closest('[data-archive-refresh]');
    if (refresh) { renderArchiveLibrary(); return; }
    const button = event.target.closest('[data-archive-download]');
    if (!button) return;
    button.disabled = true;
    try {
      const url = await archiveDownloadUrl(button.getAttribute('data-archive-download'));
      if (url) window.open(url, '_blank', 'noopener');
    } catch (error) {
      console.error('Could not open the archive.', error);
      if (typeof globalThis.toast === 'function') globalThis.toast('Could not open that archive.', 'err');
    } finally {
      button.disabled = false;
    }
  });
}

Object.assign(globalThis, { renderArchiveLibrary, installArchiveLibrary });
