/* Blocking a department from ordering until it has received its last delivery.

   The default is automatic: a department whose LAST fulfilled order still has
   items it has not received cannot open a new order. "Received" is the Receive
   button on the order — it records the expiry dates of everything dispensed, so an
   order nobody received is stock sitting in the ward with no expiry on record.

   A person who may manage request blocks (capability `requestBlocks.manage` in
   role-capabilities.js: Master, Pharmacy Director, Inpatient Pharmacy Supervisor)
   can override that for one department at a time:
     auto  — the default; the rule above decides;
     allow — an exception: this department may order even with an unreceived order;
     block — this department may not order at all, whatever it has received.

   The settings document is a flat map keyed by department id. A department with
   no entry is on auto, so a department added tomorrow is covered without anyone
   configuring it. */

export const REQUEST_RECEIVE_BLOCKS_KEY = 'request_receive_blocks_v1';
export const REQUEST_BLOCK_MODES = Object.freeze(['auto', 'allow', 'block']);

export function normalizeBlockSettings(value) {
  const out = {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) return out;
  Object.keys(value).forEach((deptId) => {
    const entry = value[deptId];
    const mode = String((entry && typeof entry === 'object' ? entry.mode : entry) || '').toLowerCase();
    if (!deptId || (mode !== 'allow' && mode !== 'block')) return;   // auto is "no entry"
    out[deptId] = {
      mode,
      updatedAt: String((entry && entry.updatedAt) || ''),
      updatedBy: String((entry && entry.updatedBy) || ''),
      updatedById: String((entry && entry.updatedById) || ''),
    };
  });
  return out;
}

export function departmentBlockMode(settings, departmentId) {
  const map = normalizeBlockSettings(settings);
  const entry = map[String(departmentId || '')];
  return entry ? entry.mode : 'auto';
}

/* The Receive button shows for a fulfilled order that has not been received, so
   "waiting to be received" is exactly that — plus something actually dispensed,
   because an order where nothing was sent has nothing to receive. */
export function isAwaitingReceipt(request) {
  if (!request || String(request.status || '') !== 'fulfilled' || request.receivedAt) return false;
  return (Array.isArray(request.dispensed) ? request.dispensed : [])
    .some((line) => Number(line && line.qty) > 0);
}

function timeOf(request) {
  return Date.parse((request && (request.fulfilledAt || request.created || request.createdAt)) || '') || 0;
}

export function findLastFulfilledRequest(requests, departmentId) {
  const target = String(departmentId || '');
  if (!target) return null;
  return (Array.isArray(requests) ? requests : [])
    .filter((request) => request
      && String(request.deptId || request.departmentId || '') === target
      && String(request.status || '') === 'fulfilled')
    .sort((left, right) => timeOf(right) - timeOf(left))[0] || null;
}

export function deriveReceiveBlock({ requests = [], departmentId = '', settings = null } = {}) {
  const mode = departmentBlockMode(settings, departmentId);

  if (mode === 'block') {
    return {
      blocked: true,
      mode,
      source: 'manual',
      reasonAr: 'تم منع قسمكم من إنشاء طلبات جديدة من قبل الصيدلية. للاستفسار تواصلوا مع مدير الصيدلية أو مشرف الصيدلية.',
      reasonEn: 'Your department has been blocked from creating new requests by the pharmacy. Please contact the pharmacy director or the pharmacy supervisor.',
    };
  }

  if (mode === 'allow') return { blocked: false, mode, source: 'exception' };

  const last = findLastFulfilledRequest(requests, departmentId);
  if (last && isAwaitingReceipt(last)) {
    return {
      blocked: true,
      mode,
      source: 'auto',
      lastRequest: last,
      reasonAr: 'لا يمكنكم إنشاء طلب جديد قبل استلام جميع أصناف آخر طلبية. افتحوا «طلباتي» واضغطوا «استلام» ثم أدخلوا تواريخ الانتهاء.',
      reasonEn: 'You cannot create a new request until all items of your last order have been received. Open My Requests, press Receive and enter the expiry dates.',
    };
  }
  return { blocked: false, mode, source: 'none' };
}

/* What one department's row on the management page shows, for every department. */
export function summarizeDepartmentBlocks({ departments = [], requests = [], settings = null } = {}) {
  return (Array.isArray(departments) ? departments : []).map((department) => {
    const departmentId = String((department && department.id) || '');
    const state = deriveReceiveBlock({ requests, departmentId, settings });
    const last = findLastFulfilledRequest(requests, departmentId);
    return {
      departmentId,
      name: String((department && (department.name || department.nameEn)) || departmentId),
      mode: state.mode,
      blocked: state.blocked,
      source: state.source,
      awaitingReceipt: !!(last && isAwaitingReceipt(last)),
      lastRequestId: last ? String(last.id || '') : '',
    };
  }).filter((row) => row.departmentId);
}

/* The settings after one department's mode changes. 'auto' removes the entry. */
export function applyBlockMode(settings, departmentId, mode, actor = {}, now = new Date().toISOString()) {
  const target = String(departmentId || '');
  const next = normalizeBlockSettings(settings);
  if (!target) return next;
  if (mode === 'allow' || mode === 'block') {
    next[target] = {
      mode,
      updatedAt: String(now || ''),
      updatedBy: String((actor && actor.name) || ''),
      updatedById: String((actor && actor.id) || ''),
    };
  } else {
    delete next[target];
  }
  return next;
}
