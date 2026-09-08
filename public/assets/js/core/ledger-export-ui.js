import { hijriMonthLabelBilingual, currentHijriMonthKey, shiftHijriMonth } from './hijri-calendar.js?v=9e42fa0bb9';
import { availableControlledMonths } from './controlled-moves-store.js?v=b8dbb67980';
import { exportControlledLedger, describeExportRange } from './controlled-ledger-export.js?v=940e9c84f7';
import {
  grantExportPermission, revokeExportPermission, grantsForDisplay,
  liveGrantsFor, mayExportMonths, defaultGrantRange, grantIsLive,
} from './export-grants.js?v=2e4e001f71';

/* The Hijri-month export picker, and the master's panel for handing that ability
   out temporarily.

   Two audiences on one panel, deliberately: the master sees what has been granted
   and to whom while standing in front of the same control that does the export,
   so revoking is not somewhere else. A non-master sees only the picker and, if
   they have no live grant, the reason instead of a button that would fail. */

function isMaster() {
  return !!(globalThis.CU && globalThis.CU.master === true);
}

function escape(value) {
  return globalThis.fsEsc ? globalThis.fsEsc(value) : String(value == null ? '' : value);
}

/* Months the session can actually export, newest first. The current month is
   always offered even when nothing has been recorded in it yet, so the picker
   never looks broken at the start of a month. */
function selectableMonths() {
  const months = new Set(availableControlledMonths());
  months.add(currentHijriMonthKey());
  return [...months].sort().reverse();
}

function fillMonthSelect(select, months, selected) {
  if (!select) return;
  select.innerHTML = months
    .map((month) => `<option value="${escape(month)}"${month === selected ? ' selected' : ''}>${escape(hijriMonthLabelBilingual(month))}</option>`)
    .join('');
}

export function renderLedgerExport() {
  const host = document.getElementById('ledger-export');
  if (!host) return;
  const months = selectableMonths();
  const fromSelect = document.getElementById('ledger-export-from');
  const toSelect = document.getElementById('ledger-export-to');
  const previousFrom = fromSelect && fromSelect.value;
  const previousTo = toSelect && toSelect.value;
  fillMonthSelect(fromSelect, months, months.includes(previousFrom) ? previousFrom : months[0]);
  fillMonthSelect(toSelect, months, months.includes(previousTo) ? previousTo : months[0]);
  renderExportStatus();
  renderGrantsPanel();
}

function selectedRange() {
  const from = (document.getElementById('ledger-export-from') || {}).value || '';
  const to = (document.getElementById('ledger-export-to') || {}).value || from;
  // A picker where "from" is later than "to" is a slip, not a request: read it
  // in the order the months actually run.
  return from <= to ? { from, to } : { from: to, to: from };
}

function renderExportStatus() {
  const status = document.getElementById('ledger-export-status');
  if (!status) return;
  const { from, to } = selectedRange();
  if (!from) { status.textContent = ''; return; }
  if (isMaster()) {
    status.textContent = `Master — ${describeExportRange(from, to)}`;
    return;
  }
  const live = liveGrantsFor();
  if (!live.length) {
    status.textContent = 'No export permission. Ask the Master to grant it temporarily. / لا يوجد إذن تصدير — اطلب من الماستر منحه مؤقتًا.';
    return;
  }
  const grant = live[0];
  const expiresIn = Math.max(0, Math.round((Date.parse(grant.expiresAt) - Date.now()) / 60000));
  status.textContent = mayExportMonths([from, to])
    ? `Permission active — ${describeExportRange(grant.fromMonth, grant.toMonth)} · expires in ${expiresIn} min`
    : `Your permission covers ${describeExportRange(grant.fromMonth, grant.toMonth)} only. / إذنك يغطي هذا النطاق فقط.`;
}

function renderGrantsPanel() {
  const host = document.getElementById('ledger-export-grants');
  if (!host) return;
  if (!isMaster()) { host.innerHTML = ''; return; }
  const months = selectableMonths();
  const range = defaultGrantRange();
  const rows = grantsForDisplay();
  const list = rows.length
    ? rows.map((grant) => {
      const live = grantIsLive(grant);
      const state = grant.revokedAt ? 'revoked' : (live ? 'live' : 'expired');
      const when = live
        ? `expires in ${Math.max(0, Math.round((Date.parse(grant.expiresAt) - Date.now()) / 60000))} min`
        : (grant.revokedAt ? 'revoked' : 'expired');
      return `<div class="grant-row" data-state="${state}">
        <span class="grant-who">${escape(grant.userKey)}</span>
        <span class="grant-range">${escape(describeExportRange(grant.fromMonth, grant.toMonth))}</span>
        <span class="grant-when">${escape(when)}</span>
        ${live ? `<button class="btn bg bsm" type="button" data-revoke-grant="${escape(grant.id)}">Revoke / سحب</button>` : '<span></span>'}
      </div>`;
    }).join('')
    : '<div class="fhint">No permissions granted recently. / لم تُمنح أذونات مؤخرًا.</div>';

  host.innerHTML = `<div class="grant-panel">
    <div class="grant-panel-title">Temporary export permission / إذن تصدير مؤقت</div>
    <div class="fhint" style="margin-bottom:8px">Grant someone the ability to export these months for a limited time. It ends on its own — nothing has to be revoked.<br/>امنح شخصًا صلاحية تصدير هذه الأشهر لمدة محددة. تنتهي تلقائيًا دون الحاجة لسحبها.</div>
    <div class="ledger-export-row">
      <label class="ledger-export-field"><span>User / المستخدم</span><input id="grant-user" type="text" placeholder="username or email" autocomplete="off"/></label>
      <label class="ledger-export-field"><span>From / من</span><select id="grant-from">${months.map((m) => `<option value="${escape(m)}"${m === range.fromMonth ? ' selected' : ''}>${escape(hijriMonthLabelBilingual(m))}</option>`).join('')}</select></label>
      <label class="ledger-export-field"><span>To / إلى</span><select id="grant-to">${months.map((m) => `<option value="${escape(m)}"${m === range.toMonth ? ' selected' : ''}>${escape(hijriMonthLabelBilingual(m))}</option>`).join('')}</select></label>
      <label class="ledger-export-field"><span>Hours / ساعات</span><input id="grant-hours" type="number" min="1" max="720" value="24"/></label>
      <button class="btn bs bsm" type="button" data-grant-export>Grant / منح</button>
    </div>
    <div class="grant-list">${list}</div>
  </div>`;
}

/* One delegated listener for the whole panel, installed once: the grant rows are
   re-rendered on every change, so per-button listeners would leak. */
let installed = false;
export function installLedgerExportPanel() {
  if (installed) return;
  const host = document.getElementById('ledger-export');
  if (!host) return;
  installed = true;

  host.addEventListener('change', (event) => {
    if (event.target && /^ledger-export-(from|to)$/.test(event.target.id)) renderExportStatus();
  });

  host.addEventListener('click', async (event) => {
    const revoke = event.target.closest('[data-revoke-grant]');
    if (revoke) {
      revoke.disabled = true;
      try { await revokeExportPermission(revoke.getAttribute('data-revoke-grant')); }
      finally { renderLedgerExport(); }
      return;
    }
    const grant = event.target.closest('[data-grant-export]');
    if (grant) {
      grant.disabled = true;
      try {
        const from = (document.getElementById('grant-from') || {}).value || '';
        const to = (document.getElementById('grant-to') || {}).value || from;
        await grantExportPermission({
          userKey: (document.getElementById('grant-user') || {}).value || '',
          fromMonth: from <= to ? from : to,
          toMonth: from <= to ? to : from,
          hours: Number((document.getElementById('grant-hours') || {}).value) || 24,
        });
      } finally {
        grant.disabled = false;
        renderLedgerExport();
      }
    }
  });
}

export async function runLedgerExport() {
  const button = document.querySelector('#ledger-export [data-asdh-binding="b225"]');
  const { from, to } = selectedRange();
  if (button) button.disabled = true;
  try {
    await exportControlledLedger(from, to);
  } catch (error) {
    console.error('Controlled ledger export failed', error);
    if (typeof globalThis.toast === 'function') globalThis.toast('Export failed. Nothing was written.', 'err');
  } finally {
    if (button) button.disabled = false;
    renderExportStatus();
  }
}

Object.assign(globalThis, { renderLedgerExport, installLedgerExportPanel, runLedgerExport });
