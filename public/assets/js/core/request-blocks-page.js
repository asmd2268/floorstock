/* The Request Blocks page: who may order, and who may not until they have received
   their last delivery. It sits beside Requests and Schedule in the request tab bar
   and is reachable by whoever holds `requestBlocks.manage` (Master, Pharmacy
   Director, Inpatient Pharmacy Supervisor).

   Every department starts on AUTO — blocked only while its last fulfilled order has
   not been received. From here a manager can ALLOW one department despite that, or
   BLOCK it outright, one at a time or for several at once. The rule itself lives
   in request-receive-block-policy.js; this file only draws it and saves the
   choice.

   No new global: the page is imported by the render table, and its buttons are
   wired through the shared delegated listener. */

import { fsE, fsEsc } from './dom-utils.js?v=b2909b7f46';
import { installActions } from './delegated-actions.js?v=078b8d25e6';
import {
  REQUEST_RECEIVE_BLOCKS_KEY,
  applyBlockMode,
  summarizeDepartmentBlocks,
  normalizeBlockSettings,
} from './request-receive-block-policy.js?v=2853c92f9b';

const LIST = 'request-blocks-list';
const BULK = 'request-blocks-bulk';

const MODE_LABEL = Object.freeze({
  auto: 'Auto / تلقائي',
  allow: 'Allow / سماح',
  block: 'Block / منع',
});

function canManage() {
  return typeof globalThis.fsHasCapability === 'function' && globalThis.fsHasCapability('requestBlocks.manage');
}

function readSettings() {
  return globalThis.S && typeof globalThis.S.g === 'function' ? globalThis.S.g(REQUEST_RECEIVE_BLOCKS_KEY) : null;
}

function departments() {
  const all = typeof globalThis.gd === 'function' ? globalThis.gd() || [] : [];
  return typeof globalThis.fsAllowedDepts === 'function' ? globalThis.fsAllowedDepts() || all : all;
}

function statusBadge(row) {
  if (row.source === 'manual') return '<span class="badge brd">🚫 Blocked by pharmacy / ممنوع من الصيدلية</span>';
  if (row.source === 'auto') return '<span class="badge byl">📥 Blocked — last order not received / ممنوع — لم يستلم آخر طلبية</span>';
  if (row.mode === 'allow' && row.awaitingReceipt) return '<span class="badge bbl">✓ Allowed despite unreceived order / مسموح رغم عدم الاستلام</span>';
  if (row.mode === 'allow') return '<span class="badge bbl">✓ Allowed (exception) / مسموح (استثناء)</span>';
  return '<span class="badge bgn">✓ Can order / يستطيع الطلب</span>';
}

function modeButtons(row) {
  return ['auto', 'allow', 'block'].map((mode) => {
    const on = row.mode === mode;
    return '<button type="button" class="btn ' + (on ? (mode === 'block' ? 'bd2c' : 'bp') : 'bg') + ' bxs"'
      + (on ? ' disabled aria-pressed="true"' : ' aria-pressed="false"')
      + ' data-act="requestBlockSet" data-dept="' + fsEsc(row.departmentId) + '" data-mode="' + mode + '">'
      + fsEsc(MODE_LABEL[mode]) + '</button>';
  }).join(' ');
}

function stamp(settings, departmentId) {
  const entry = settings[departmentId];
  if (!entry) return '—';
  const when = entry.updatedAt && typeof globalThis.fmtDateTime === 'function' ? globalThis.fmtDateTime(entry.updatedAt) : '';
  return fsEsc([entry.updatedBy, when].filter(Boolean).join(' · ') || '—');
}

export function renderRequestBlocks() {
  const host = fsE(LIST);
  if (!host) return;
  if (typeof globalThis.injectReqTabBar === 'function') globalThis.injectReqTabBar('pg-request-blocks');
  install();

  if (!canManage()) {
    host.innerHTML = '<div class="fhint">This page is available to the Master, the Pharmacy Director and the Inpatient Pharmacy Supervisor. / هذه الصفحة متاحة للماستر ومدير الصيدلية ومشرف الصيدلية الداخلية.</div>';
    const bulk = fsE(BULK);
    if (bulk) bulk.style.display = 'none';
    return;
  }

  const settings = normalizeBlockSettings(readSettings());
  const rows = summarizeDepartmentBlocks({
    departments: departments(),
    requests: typeof globalThis.gr === 'function' ? globalThis.gr() || [] : [],
    settings,
  });
  const bulk = fsE(BULK);
  if (bulk) bulk.style.display = '';
  const blocked = rows.filter((row) => row.blocked).length;
  const summary = fsE('request-blocks-summary');
  if (summary) summary.textContent = blocked + ' of ' + rows.length + ' departments cannot order right now. / ' + blocked + ' من ' + rows.length + ' قسم لا يستطيع الطلب حالياً.';

  host.innerHTML = rows.length
    ? '<div class="tw"><table><thead><tr>'
      + '<th style="width:34px"><input type="checkbox" data-act="requestBlockAll" aria-label="Select all / تحديد الكل"></th>'
      + '<th>Department / القسم</th><th>Status / الحالة</th><th>Setting / الإعداد</th><th>Changed by / آخر تعديل</th>'
      + '</tr></thead><tbody>'
      + rows.map((row) => '<tr>'
        + '<td><input type="checkbox" class="request-block-pick" value="' + fsEsc(row.departmentId) + '"></td>'
        + '<td style="font-weight:600">' + fsEsc(row.name) + '</td>'
        + '<td>' + statusBadge(row) + '</td>'
        + '<td>' + modeButtons(row) + '</td>'
        + '<td class="fhint">' + stamp(settings, row.departmentId) + '</td>'
        + '</tr>').join('')
      + '</tbody></table></div>'
    : '<div class="fhint">No departments. / لا توجد أقسام.</div>';
}

function selectedDepartments() {
  return Array.from(document.querySelectorAll('#' + LIST + ' .request-block-pick:checked')).map((box) => box.value);
}

/* One write for however many departments: the whole map is saved, so every change
   starts from the freshest copy rather than from what the page last drew. */
async function setMode(departmentIds, mode) {
  if (!canManage()) return globalThis.toast('You are not allowed to change this. / غير مصرح لك بالتغيير.', 'err');
  const ids = (departmentIds || []).filter(Boolean);
  if (!ids.length) return globalThis.toast('Select at least one department. / اختر قسماً واحداً على الأقل.', 'err');

  const actor = {
    name: typeof globalThis.actualActorName === 'function' ? globalThis.actualActorName() : String((globalThis.CU && globalThis.CU.username) || ''),
    id: String((globalThis.CU && (globalThis.CU.id || globalThis.CU.uid)) || ''),
  };
  const now = typeof globalThis.nowISO === 'function' ? globalThis.nowISO() : new Date().toISOString();
  let next = normalizeBlockSettings(readSettings());
  ids.forEach((id) => { next = applyBlockMode(next, id, mode, actor, now); });

  try {
    await globalThis.S.s(REQUEST_RECEIVE_BLOCKS_KEY, next);
    if (typeof globalThis.auditAction === 'function') {
      try { await globalThis.auditAction('request_block_changed', { departments: ids, mode }); } catch (error) { console.warn('Request block audit failed', error); }
    }
    globalThis.toast('Saved ✓ / تم الحفظ', 'succ');
  } catch (error) {
    console.error(error);
    globalThis.toast('The change was not saved. / لم يتم حفظ التغيير.', 'err');
  }
  renderRequestBlocks();
  return undefined;
}

let installed = false;
function install() {
  if (installed) return;
  installed = true;
  installActions(document.body, {
    requestBlockSet: (el) => setMode([el.dataset.dept], el.dataset.mode),
    requestBlockBulk: (el) => setMode(selectedDepartments(), el.dataset.mode),
    requestBlockAll: (el) => {
      document.querySelectorAll('#' + LIST + ' .request-block-pick').forEach((box) => { box.checked = el.checked; });
    },
  });
}
