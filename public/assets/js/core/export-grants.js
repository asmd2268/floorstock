import { hijriMonthLabelBilingual, currentHijriMonthKey, shiftHijriMonth, hijriMonthsBetween } from './hijri-calendar.js?v=c5193ff179';

/* Temporary, master-granted permission to export the controlled ledger.

   Exporting the narcotic register is not something every custody officer should
   be able to do at any time — it lifts the full per-movement detail, patient
   context included, out of the system as a file. But it is something a master
   needs to delegate: an auditor visits, a report is due, and the officer needs
   to pull three Hijri months to Excel without the master doing it by hand.

   So the grant is a record with an expiry, not a role change. It names who may
   export, which Hijri months they may cover, and when it lapses. Nothing has to
   be remembered or revoked for it to end — an expired grant simply stops
   matching. A master can still revoke early, and every grant, use and revocation
   is written to the audit trail.

   The grant is a convenience boundary, not a security boundary: firestore.rules
   still decides who can read the ledger at all. What this controls is the export
   action, which is exactly the thing a master wants to hand out and take back. */

export const EXPORT_GRANTS_KEY = 'controlled_export_grants_v1';

function grants() {
  const value = globalThis.S && typeof globalThis.S.g === 'function' ? globalThis.S.g(EXPORT_GRANTS_KEY) : null;
  return Array.isArray(value) ? value : [];
}

function nowIso() {
  return new Date().toISOString();
}

function isMaster() {
  return !!(globalThis.CU && globalThis.CU.master === true);
}

function currentUserKey() {
  const user = globalThis.CU || {};
  return String(user.username || user.email || user.id || user.uid || '').trim().toLowerCase();
}

export function grantIsLive(grant, at) {
  if (!grant || grant.revokedAt) return false;
  const moment = at || nowIso();
  return String(grant.expiresAt || '') > moment;
}

/* Every live grant for this user, most recently issued first. */
export function liveGrantsFor(userKey) {
  const key = String(userKey || currentUserKey()).trim().toLowerCase();
  if (!key) return [];
  const moment = nowIso();
  return grants()
    .filter((grant) => String(grant.userKey || '').toLowerCase() === key && grantIsLive(grant, moment))
    .sort((a, b) => String(b.grantedAt || '').localeCompare(String(a.grantedAt || '')));
}

/* A master always may. Anyone else needs a live grant that covers every month
   they asked for — a grant for Rajab does not quietly export Shaban too. */
export function mayExportMonths(monthKeys) {
  if (isMaster()) return true;
  const wanted = [...new Set(monthKeys || [])];
  if (!wanted.length) return false;
  return liveGrantsFor().some((grant) => {
    const covered = hijriMonthsBetween(grant.fromMonth, grant.toMonth);
    return wanted.every((month) => covered.includes(month));
  });
}

export function exportPermissionReason(monthKeys) {
  if (isMaster()) return '';
  const live = liveGrantsFor();
  if (!live.length) {
    return 'Exporting the controlled ledger needs a temporary permission from the Master.\nتصدير السجل يحتاج إذنًا مؤقتًا من الماستر.';
  }
  if (!mayExportMonths(monthKeys)) {
    const windows = live.map((grant) => `${hijriMonthLabelBilingual(grant.fromMonth)} → ${hijriMonthLabelBilingual(grant.toMonth)}`).join('\n');
    return `Your permission does not cover every month selected. It covers:\n${windows}\nإذنك لا يغطي كل الأشهر المحددة.`;
  }
  return '';
}

/* Issues a grant. `hours` is deliberately capped: a permission that outlives the
   reason it was given is the thing this design exists to avoid. */
export async function grantExportPermission({ userKey, fromMonth, toMonth, hours, note }) {
  if (!isMaster()) {
    globalThis.toast('Only Master can grant export permission. / الماستر فقط يمنح إذن التصدير.', 'err');
    return null;
  }
  const key = String(userKey || '').trim().toLowerCase();
  if (!key) {
    globalThis.toast('Choose who the permission is for. / اختر المستخدم.', 'err');
    return null;
  }
  const from = String(fromMonth || '').trim();
  const to = String(toMonth || from).trim();
  if (!/^\d{4}-\d{2}$/.test(from) || !/^\d{4}-\d{2}$/.test(to) || to < from) {
    globalThis.toast('Choose a valid Hijri month range. / اختر نطاق أشهر هجرية صحيح.', 'err');
    return null;
  }
  const validHours = Math.max(1, Math.min(720, Number(hours) || 24));
  /* One clock reading for both ends. Granted-at and expires-at were taken from
     two separate calls, so a grant was however many hours it says PLUS whatever
     time passed between the two lines. Never enough to matter to a person, but
     it means the record does not say exactly what was given — and a permission
     to export the controlled register is a record. */
  const issuedAt = Date.now();
  const grant = {
    id: `xg_${issuedAt}_${Math.random().toString(36).slice(2, 8)}`,
    userKey: key,
    fromMonth: from,
    toMonth: to,
    note: String(note || '').trim().slice(0, 200),
    grantedAt: new Date(issuedAt).toISOString(),
    grantedBy: String((globalThis.CU && (globalThis.CU.username || globalThis.CU.email)) || 'Master'),
    expiresAt: new Date(issuedAt + validHours * 3600 * 1000).toISOString(),
    revokedAt: '',
  };
  await globalThis.S.s(EXPORT_GRANTS_KEY, grants().concat([grant]));
  if (typeof globalThis.auditAction === 'function') {
    await Promise.resolve(globalThis.auditAction('controlled_export_permission_granted', {
      grantId: grant.id, userKey: key, fromMonth: from, toMonth: to, hours: validHours,
    })).catch(() => {});
  }
  globalThis.toast(`Export permission granted for ${validHours}h. / تم منح إذن التصدير لمدة ${validHours} ساعة.`, 'succ');
  return grant;
}

export async function revokeExportPermission(grantId) {
  if (!isMaster()) {
    globalThis.toast('Only Master can revoke export permission.', 'err');
    return false;
  }
  const id = String(grantId || '');
  const next = grants().map((grant) => (String(grant.id) === id ? Object.assign({}, grant, { revokedAt: nowIso() }) : grant));
  await globalThis.S.s(EXPORT_GRANTS_KEY, next);
  if (typeof globalThis.auditAction === 'function') {
    await Promise.resolve(globalThis.auditAction('controlled_export_permission_revoked', { grantId: id })).catch(() => {});
  }
  globalThis.toast('Export permission revoked. / تم سحب الإذن.', 'succ');
  return true;
}

/* Grants worth showing a master: live ones, plus recently ended ones so the
   record of what was handed out does not vanish the moment it lapses. */
export function grantsForDisplay() {
  const moment = nowIso();
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  return grants()
    .filter((grant) => grantIsLive(grant, moment) || String(grant.expiresAt || '') > weekAgo || String(grant.revokedAt || '') > weekAgo)
    .sort((a, b) => String(b.grantedAt || '').localeCompare(String(a.grantedAt || '')));
}

/* Drops grants that ended long ago. The key is small by nature, but it is still
   one document and nothing should grow in it forever. */
export async function pruneExpiredGrants() {
  if (!isMaster()) return 0;
  const cutoff = new Date(Date.now() - 90 * 86400000).toISOString();
  const all = grants();
  const kept = all.filter((grant) => String(grant.expiresAt || '') > cutoff || grantIsLive(grant));
  if (kept.length === all.length) return 0;
  await globalThis.S.s(EXPORT_GRANTS_KEY, kept);
  return all.length - kept.length;
}

export function defaultGrantRange() {
  const current = currentHijriMonthKey();
  return { fromMonth: shiftHijriMonth(current, -2), toMonth: current };
}

Object.assign(globalThis, {
  EXPORT_GRANTS_KEY,
  liveGrantsFor,
  mayExportMonths,
  exportPermissionReason,
  grantExportPermission,
  revokeExportPermission,
  grantsForDisplay,
  defaultGrantRange,
  grantIsLive,
});
