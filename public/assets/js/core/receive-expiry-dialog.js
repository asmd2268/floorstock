/* The receipt screen: for each dispensed medicine the department says WHICH
   expiry dates the delivery carries. It never types a quantity — the pharmacy
   recorded how many units it sent when it dispensed the order.

   For every medicine the screen offers the dates the department ALREADY holds on
   its own expiry list as ticks, plus "+" to add a date that is not there yet. A
   delivery can carry more than one date, so both can be done more than once.

   The + and × are handled by ONE listener on the table rather than an inline
   handler per row: dynamic rows would otherwise each need a global function
   name for the CSP bridge to rebind, and the count of those names is something
   this project is trying to bring down, not add to. */

import { fsE, fsEsc } from './dom-utils.js?v=b2909b7f46';
import { buildReceiveRecords, describeReceiveError } from './receive-expiry-rows.js?v=d7c6628f17';

const BODY = 'v13-receive-body';

function dateOf(row) { return String((row && (row.date || row.expiry)) || '').slice(0, 10); }
function lotOf(row) { return String((row && (row.lot || row.batch)) || '').trim(); }

function newDateHtml() {
  return '<div class="v13-r-newrow">'
    + '<input class="v13-r-exp" type="date" aria-label="Expiry date / تاريخ الانتهاء">'
    + '<input class="v13-r-lot" placeholder="Batch (optional) / الدفعة (اختياري)">'
    + '<button type="button" class="btn bd2c bxs" data-receive-remove="1" title="Remove this date / حذف هذا التاريخ">×</button>'
    + '</div>';
}

function chipHtml(row, today) {
  const date = dateOf(row);
  const lot = lotOf(row);
  const expired = date && date < today;
  return '<label class="v13-r-chip' + (expired ? ' v13-r-chip-expired' : '') + '">'
    + '<input type="checkbox" class="v13-r-pick" value="' + fsEsc(String(row.id || row.batchId || '')) + '">'
    + '<span class="v13-r-chip-date">' + fsEsc(date) + '</span>'
    + (lot ? '<span class="fhint">' + fsEsc(lot) + '</span>' : '')
    + (expired ? '<span class="fhint">Expired / منتهي</span>' : '')
    + '</label>';
}

function rowHtml(medId, label, dispensed, index, heldRows, today) {
  const chips = heldRows.length
    ? '<div class="v13-r-held">' + heldRows.map((row) => chipHtml(row, today)).join('') + '</div>'
    : '<div class="fhint v13-r-nodates">No dates registered for this medicine yet — add one. / لا توجد تواريخ مسجلة لهذا الدواء — أضف تاريخاً.</div>';
  return '<tr data-med="' + fsEsc(medId) + '">'
    + '<td>' + index + '</td>'
    + '<td><b>' + label + '</b></td>'
    + '<td>' + fsEsc(String(dispensed)) + '</td>'
    + '<td class="v13-r-dates">' + chips
    + '<div class="v13-r-new">' + (heldRows.length ? '' : newDateHtml()) + '</div>'
    + '<button type="button" class="btn bg bxs" data-receive-add="1" title="Add an expiry date that is not listed / إضافة تاريخ غير موجود في القائمة">+ Add date / إضافة تاريخ</button>'
    + '</td>'
    + '</tr>';
}

let installed = false;
function install() {
  if (installed) return;
  const body = fsE(BODY);
  if (!body) return;
  installed = true;
  body.addEventListener('click', (event) => {
    const add = event.target.closest('[data-receive-add]');
    if (add) {
      const host = add.closest('tr') && add.closest('tr').querySelector('.v13-r-new');
      if (host) host.insertAdjacentHTML('beforeend', newDateHtml());
      return;
    }
    const remove = event.target.closest('[data-receive-remove]');
    if (remove) {
      const row = remove.closest('.v13-r-newrow');
      if (row && row.parentNode) row.parentNode.removeChild(row);
    }
  });
}

/* Reading the choices back is part of owning the dialog. The caller supplies what
   only it can: the request, the department's list, and how to save it. */
export function readReceiveRows() {
  const rows = [];
  document.querySelectorAll('#' + BODY + ' tr[data-med]').forEach((tr) => {
    const medId = tr.dataset.med;
    tr.querySelectorAll('.v13-r-pick:checked').forEach((box) => {
      rows.push({ medId, existingId: box.value });
    });
    tr.querySelectorAll('.v13-r-newrow').forEach((line) => {
      rows.push({
        medId,
        expiry: (line.querySelector('.v13-r-exp') || {}).value || '',
        lot: ((line.querySelector('.v13-r-lot') || {}).value || '').trim(),
      });
    });
  });
  return rows;
}

export function receiveDialogRequestId() {
  const modal = fsE('v13-receive-modal');
  return modal && modal.dataset ? String(modal.dataset.requestId || '') : '';
}

export function closeReceiveDialog() {
  const modal = fsE('v13-receive-modal');
  if (modal && modal.dataset) delete modal.dataset.requestId;
  if (typeof globalThis.CM === 'function') globalThis.CM('v13-receive-modal');
}

/* The medicines the pharmacy actually sent: one line each, whatever the quantity. */
export function dispensedMedicineIds(request) {
  const ids = [];
  ((request && request.dispensed) || []).forEach((line) => {
    if (Number(line && line.qty) > 0 && line.medId && ids.indexOf(String(line.medId)) < 0) ids.push(String(line.medId));
  });
  return ids;
}

export function openReceiveExpiryDialog(request, describeMedicine, existingExpiry) {
  const modal = fsE('v13-receive-modal');
  if (!modal) return;
  modal.dataset.requestId = String(request.id);
  const today = new Date().toISOString().slice(0, 10);
  const held = Array.isArray(existingExpiry) ? existingExpiry : [];
  const rows = (request.dispensed || [])
    .filter((line) => Number(line.qty) > 0)
    .map((line, index) => {
      const described = describeMedicine(line.medId) || {};
      const label = fsEsc(described.name || line.medId) + (described.badges || '');
      const mine = held
        .filter((row) => String(row && row.medId) === String(line.medId) && dateOf(row))
        .sort((a, b) => dateOf(a).localeCompare(dateOf(b)));
      return rowHtml(line.medId, label, Number(line.qty || 0), index + 1, mine, today);
    }).join('');
  const meta = fsE('v13-receive-meta');
  if (meta) meta.textContent = 'Request ' + request.id + ' — choose the expiry dates that arrived (or add new ones) for every medicine, then confirm once. / اختر تواريخ الانتهاء التي وصلت (أو أضف جديدة) لكل دواء ثم أكّد مرة واحدة.';
  const body = fsE(BODY);
  if (body) body.innerHTML = rows || '<tr><td colspan="4">No dispensed items</td></tr>';
  install();
  if (typeof globalThis.OM === 'function') globalThis.OM('v13-receive-modal');
}

/* Saving what was received. Dates added here are appended to the department's own
   expiry list through its own setter, so one department can never write another's,
   and they carry no quantity (qty null = unrecorded). Ticked dates already exist,
   so nothing is rewritten for them. A medicine with no date stops here, naming it,
   before anything is written. */
let saving = false;
export async function saveReceivedExpiry() {
  if (saving) return undefined;
  const requestId = receiveDialogRequestId();
  const request = (globalThis.gr ? globalThis.gr() || [] : []).find((row) => String(row.id) === requestId);
  if (!request) return globalThis.toast('Request not available', 'err');

  const deptId = globalThis.CU.deptId;
  const existing = typeof globalThis.getExpiry === 'function' ? globalThis.getExpiry(deptId) || [] : [];
  const now = typeof globalThis.nowISO === 'function' ? globalThis.nowISO() : new Date().toISOString();
  const built = buildReceiveRecords(readReceiveRows(), {
    requestId,
    now,
    existing,
    required: dispensedMedicineIds(request),
    newId: () => 'ex_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6),
  });

  if (built.errors.length) {
    const meds = typeof globalThis.getMeds === 'function' ? globalThis.getMeds(deptId) || [] : [];
    return globalThis.toast(describeReceiveError(built.errors[0], (id) => {
      const medicine = meds.find((entry) => String(entry.id) === String(id));
      return (medicine && medicine.name) || id;
    }), 'err');
  }

  saving = true;
  try {
    if (built.records.length) await globalThis.setExpiry(deptId, (globalThis.getExpiry(deptId) || []).slice().concat(built.records));
    await globalThis.S.upd('requests', requestId, {
      receivedAt: now,
      receivedBy: typeof globalThis.actualActorName === 'function' ? globalThis.actualActorName() : globalThis.CU.username,
      receivedExpiry: built.received,
    });
    await globalThis.auditAction('department_request_received', { requestId, items: built.received });
    closeReceiveDialog();
    if (typeof globalThis.renderMyReqs === 'function') globalThis.renderMyReqs();
    if (typeof globalThis.refreshNewRequestGate === 'function') globalThis.refreshNewRequestGate();
    globalThis.toast('All received items saved permanently ✓', 'succ');
  } catch (error) {
    console.error(error);
    globalThis.toast('Received items were not fully saved.', 'err');
  } finally {
    saving = false;
  }
  return undefined;
}
