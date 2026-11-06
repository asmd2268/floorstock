/* Supplier Inventory — the page a department's QR opens, with no sign-in.
   Markup from the published snapshot only; no Firestore, no globals. */
import { bi, itemExpiry, STATUS_LABEL } from './supplier-inventory-model.js?v=66a68fd8e9';

const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const COLOR = { expired: '#da3633', urgent: '#da3633', near: '#b26a00', ok: '#1a7f37', none: '#6e7781' };

export function publicPageHtml(snap, { cabinetId, today, updatedLabel }) {
  const cfg = snap.alerts || { d1: 30, d2: 7 };
  const cabinet = cabinetId ? (snap.cabinets || []).find((c) => c.id === cabinetId) : null;
  const items = (snap.items || []).filter((i) => !cabinetId || (i.cabinetIds || []).includes(cabinetId))
    .map((i) => ({ i, exp: itemExpiry({ batches: (i.batches || []).map((b, k) => Object.assign({ id: `b${k}` }, b)) }, cfg, today) }))
    .sort((a, b) => (a.exp.days == null) - (b.exp.days == null) || a.exp.days - b.exp.days || a.i.name.localeCompare(b.i.name));
  const rows = items.map(({ i, exp }, n) => {
    const dates = exp.batches.map((b) => `<div style="color:${COLOR[b.status]};${b.status === 'expired' || b.status === 'urgent' ? 'font-weight:700' : ''}">${b.expiry ? esc(b.expiry) : '—'}${b.batch ? ` · ${esc(b.batch)}` : ''}${b.qty != null ? ` · ×${esc(b.qty)}` : ''}${b.status === 'near' || b.status === 'urgent' || b.status === 'expired' ? ` ⚠ ${esc(STATUS_LABEL[b.status])}` : ''}</div>`).join('') || '—';
    return `<tr style="${exp.status === 'expired' || exp.status === 'urgent' ? 'background:#fff1f0' : exp.status === 'near' ? 'background:#fff8e6' : ''}"><td>${n + 1}</td><td><b>${esc(i.name)}</b>${i.outOfStock ? ` <b style="color:#6e7781;font-size:10px">${bi('OUT', 'نفد')}</b>` : ''}${i.group ? `<div style="font-size:10px;color:#666">${esc(i.group)}</div>` : ''}</td><td style="font-family:monospace">${esc(i.code)}</td><td>${dates}</td></tr>`;
  }).join('') || `<tr><td colspan="4" style="padding:18px;text-align:center;color:#6e7781">${bi('Nothing is published for this list yet.', 'لا يوجد شيء منشور لهذه القائمة بعد.')}</td></tr>`;
  return `<div class="live-head"><h1>${bi('Medical Supplies', 'المستلزمات الطبية')}</h1><h2>${esc(snap.departmentName || snap.deptId || '')}${cabinet ? ` — ${esc(cabinet.name)}` : ''}</h2>`
    + `<div class="live-meta"><span class="live-pill"><b>${bi('Last update', 'آخر تحديث')}:</b> ${esc(updatedLabel)}</span><span class="live-pill" style="color:#1a7f37">● ${bi('Live', 'مباشر')}</span></div>`
    + `<button class="no-print" data-clickact="printThisPage" type="button">🖨 ${bi('Print', 'طباعة')}</button></div>`
    + `<table style="width:100%;border-collapse:collapse" border="1" cellpadding="6"><thead><tr><th>#</th><th>${bi('Item', 'الصنف')}</th><th>${bi('Code', 'الكود')}</th><th>${bi('Expiry / batch / qty', 'الانتهاء / الباتش / الكمية')}</th></tr></thead><tbody>${rows}</tbody></table>`
    + `<div style="text-align:center;font-size:10px;color:#666;margin-top:14px">By Ali Abudahash</div>`;
}
