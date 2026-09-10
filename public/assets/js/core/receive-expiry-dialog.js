/* The receipt screen: one row per expiry date, added and removed by the person
   receiving the delivery.

   A delivery of one medicine can arrive as more than one expiry date — two
   boxes with different dates is ordinary — so a medicine starts as one row
   holding the whole received quantity, and "+" adds another date for the same
   medicine to split it between them.

   The + and × are handled by ONE listener on the table rather than an inline
   handler per row: dynamic rows would otherwise each need a global function
   name for the CSP bridge to rebind, and the count of those names is something
   this project is trying to bring down, not add to. */

import { fsE, fsEsc } from './dom-utils.js?v=b2909b7f46';
import { buildReceiveRecords, describeReceiveError } from './receive-expiry-rows.js?v=a8f6394278';

const BODY = 'v13-receive-body';

function rowHtml(medId, label, received, index, qty, first) {
  return '<tr data-med="' + fsEsc(medId) + '" data-qty="' + received + '"' + (first ? '' : ' data-extra="1"') + '>'
    + '<td>' + (first ? index : '') + '</td>'
    + '<td>' + (first ? '<b>' + label + '</b>' : '<span class="fhint">↳ same medicine / نفس الدواء</span>') + '</td>'
    + '<td>' + (first ? received : '') + '</td>'
    + '<td><input class="v13-r-exp" type="date"></td>'
    + '<td><input class="v13-r-qty" type="number" min="0" step="1" value="' + qty + '" style="max-width:90px"></td>'
    + '<td><input class="v13-r-lot" placeholder="Optional"></td>'
    + '<td>' + (first
      ? '<button type="button" class="btn bg bxs" data-receive-add="1" title="Another expiry date for this medicine / تاريخ آخر لنفس الدواء">+</button>'
      : '<button type="button" class="btn bd2c bxs" data-receive-remove="1" title="Remove this date / حذف هذا التاريخ">×</button>') + '</td>'
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
      const row = add.closest('tr');
      if (!row) return;
      /* The new row starts empty: the person splitting the delivery says how
         much belongs to the new date, and the first row keeps the rest. */
      row.insertAdjacentHTML('afterend', rowHtml(row.dataset.med, '', Number(row.dataset.qty || 0), 0, 0, false));
      return;
    }
    const remove = event.target.closest('[data-receive-remove]');
    if (remove) {
      const row = remove.closest('tr');
      if (row && row.parentNode) row.parentNode.removeChild(row);
    }
  });
}

/* Reading the rows back is part of owning the dialog. The caller supplies what
   only it can: the request, where the expiry list lives, and how to save it. */
export function readReceiveRows() {
  return Array.from(document.querySelectorAll('#' + BODY + ' tr[data-med]')).map((row) => ({
    medId: row.dataset.med,
    received: Number(row.dataset.qty || 0),
    expiry: (row.querySelector('.v13-r-exp') || {}).value || '',
    qty: (row.querySelector('.v13-r-qty') || {}).value,
    lot: ((row.querySelector('.v13-r-lot') || {}).value || '').trim(),
  }));
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

export function openReceiveExpiryDialog(request, describeMedicine) {
  const modal = fsE('v13-receive-modal');
  if (!modal) return;
  modal.dataset.requestId = String(request.id);
  const rows = (request.dispensed || [])
    .filter((line) => Number(line.qty) > 0)
    .map((line, index) => {
      const described = describeMedicine(line.medId) || {};
      const label = fsEsc(described.name || line.medId) + (described.badges || '');
      return rowHtml(line.medId, label, Number(line.qty || 0), index + 1, Number(line.qty || 0), true);
    }).join('');
  const meta = fsE('v13-receive-meta');
  if (meta) meta.textContent = 'Request ' + request.id + ' — enter all expiry dates and batch numbers, then confirm once.';
  const body = fsE(BODY);
  if (body) body.innerHTML = rows || '<tr><td colspan="7">No dispensed items</td></tr>';
  install();
  if (typeof globalThis.OM === 'function') globalThis.OM('v13-receive-modal');
}

/* Saving what was received. The department's own expiry list is appended to and
   saved through its own setter, so one department can never write another's. A
   split that does not add up stops here, naming the medicine, before anything
   is written. */
export async function saveReceivedExpiry() {
  const requestId = receiveDialogRequestId();
  const request = (globalThis.gr ? globalThis.gr() || [] : []).find((row) => String(row.id) === requestId);
  if (!request) return globalThis.toast('Request not available', 'err');

  const now = typeof globalThis.nowISO === 'function' ? globalThis.nowISO() : new Date().toISOString();
  const built = buildReceiveRecords(readReceiveRows(), {
    requestId,
    now,
    newId: () => 'ex_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6),
  });

  if (built.errors.length) {
    const meds = typeof globalThis.getMeds === 'function' ? globalThis.getMeds(globalThis.CU.deptId) || [] : [];
    return globalThis.toast(describeReceiveError(built.errors[0], (id) => {
      const medicine = meds.find((entry) => String(entry.id) === String(id));
      return (medicine && medicine.name) || id;
    }), 'err');
  }

  try {
    const deptId = globalThis.CU.deptId;
    await globalThis.setExpiry(deptId, (globalThis.getExpiry(deptId) || []).slice().concat(built.records));
    await globalThis.S.upd('requests', requestId, {
      receivedAt: now,
      receivedBy: typeof globalThis.actualActorName === 'function' ? globalThis.actualActorName() : globalThis.CU.username,
      receivedExpiry: built.received,
    });
    await globalThis.auditAction('department_request_received', { requestId, items: built.received });
    closeReceiveDialog();
    if (typeof globalThis.renderMyReqs === 'function') globalThis.renderMyReqs();
    globalThis.toast('All received items saved permanently ✓', 'succ');
  } catch (error) {
    console.error(error);
    globalThis.toast('Received items were not fully saved.', 'err');
  }
  return undefined;
}
