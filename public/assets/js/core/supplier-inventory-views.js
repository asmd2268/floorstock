/* Supplier Inventory — markup only. Every function returns an HTML string from
   plain data; every button carries data-sact / data-schg / data-sinp, which one
   listener per event on document.body turns into a call (no inline handlers —
   the page's CSP forbids them). */

import { bi, itemExpiry, STATUS_LABEL, missingRequired, REQUIRABLE, FEATURE_LABEL } from './supplier-inventory-model.js?v=6b35c5abc7';

export const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const btn = (act, label, cls, extra) => `<button type="button" class="btn ${cls || 'bg'} bsm" data-sact="${act}" ${extra || ''}>${label}</button>`;
const opt = (value, label, current) => `<option value="${esc(value)}"${String(value) === String(current) ? ' selected' : ''}>${esc(label)}</option>`;
const FIELD_LABEL = { expiry: bi('Expiry date', 'تاريخ الانتهاء'), batch: bi('Batch', 'الباتش'), quantity: bi('Quantity', 'الكمية') };
const COLOR = { expired: '#b00020', urgent: '#b00020', near: '#b26a00', ok: '#2e7d32', none: 'var(--tx2)' };

export const badge = (status, days) => `<span class="chip" style="color:${COLOR[status]};border-color:${COLOR[status]}">${status === 'near' || status === 'urgent' || status === 'expired' ? '⚠ ' : ''}${esc(STATUS_LABEL[status])}${days != null && status !== 'none' ? ` · ${days} d` : ''}</span>`;

const CONN = {
  live: ['● Live / مباشر', '#2e7d32'],
  cached: ['● Offline or cached — changes will sync / بدون اتصال — ستتزامن التغييرات', '#b26a00'],
  error: ['● Cannot reach the server / تعذر الاتصال', '#b00020'],
  loading: ['… Loading / جارٍ التحميل', 'var(--tx2)'],
};

export function rowHtml(item, c) {
  const exp = itemExpiry(item, c.cfg, c.today);
  const missing = missingRequired(item, c.settings);
  const dates = exp.batches.map((b) => `<div>${b.expiry ? `<span style="color:${COLOR[b.status]}">${esc(b.expiry)}</span>` : '—'}${b.batch ? ` · ${esc(b.batch)}` : ''}${b.qty != null ? ` · ×${esc(b.qty)}` : ''}</div>`).join('');
  return `<tr>`
    + `<td><input type="checkbox" data-schg="pick" data-id="${esc(item.id)}"${c.selected.has(item.id) ? ' checked' : ''}></td>`
    + `<td><b>${esc(item.name)}</b>${item.outOfStock ? ` <span class="chip">${bi('Out', 'نفد')}</span>` : ''}${missing.length ? ` <span class="chip" style="color:#b26a00">${bi('Incomplete', 'ناقص')}</span>` : ''}<div class="ssub mono">${esc(item.code)}</div></td>`
    + `<td>${esc(item.groupId ? c.groupName(item.groupId) : '—')}</td>`
    + `<td>${item.cabinetIds.map((id) => `<span class="chip">${esc(c.cabinetName(id))}</span>`).join(' ') || '—'}</td>`
    + `<td>${dates || '—'}</td><td>${badge(exp.status, exp.days)}</td>`
    + `<td style="white-space:nowrap">${btn('edit', '✏️', 'bg', `data-id="${esc(item.id)}"`)} ${btn('del', '🗑', 'bg', `data-id="${esc(item.id)}"`)}</td></tr>`;
}

export function pageHtml(s) {
  const f = s.filters;
  const sum = s.summary;
  const chips = [['all', bi('All', 'الكل'), sum.total], ['attention', bi('Needs attention', 'يحتاج انتباه'), sum.expired + sum.urgent + sum.near],
    ['expired', STATUS_LABEL.expired, sum.expired], ['urgent', STATUS_LABEL.urgent, sum.urgent], ['near', STATUS_LABEL.near, sum.near],
    ['noexpiry', STATUS_LABEL.none, sum.noExpiry], ['out', bi('Out of stock', 'نفد'), sum.out], ['incomplete', bi('Incomplete', 'ناقص'), sum.incomplete]]
    .map(([k, label, n]) => `<button type="button" class="chip${f.status === k ? ' on' : ''}" data-sact="status" data-status="${k}">${label} · ${n}</button>`).join(' ');
  const conn = CONN[s.conn] || CONN.loading;
  const picker = s.isMaster
    ? `<select data-schg="dept">${s.depts.map((d) => opt(d.id, d.name, s.deptId)).join('')}</select>` : '';
  return `<div class="card"><div class="cb">`
    + `<div style="display:flex;flex-wrap:wrap;gap:10px;justify-content:space-between;align-items:center">`
    + `<div><div class="stitle">📦 ${esc(FEATURE_LABEL)}</div><div class="ssub">${esc(s.deptName)} — <span style="color:${conn[1]}">${conn[0]}</span></div></div>${picker}</div>`
    + `<div style="display:flex;flex-wrap:wrap;gap:6px;margin:12px 0">`
    + btn('add', `+ ${bi('Add item', 'إضافة صنف')}`, 'bp') + btn('groups', bi('Groups', 'المجموعات')) + btn('cabinets', bi('Cabinets', 'الدواليب'))
    + btn('settings', `⚙ ${bi('Required fields', 'الحقول الإلزامية')}`) + btn('export', `⬇ ${bi('Export Excel', 'تصدير إكسل')}`)
    + btn('import', `⬆ ${bi('Import Excel', 'استيراد إكسل')}`) + btn('print', `🖨 ${bi('Print list', 'طباعة القائمة')}`) + btn('labels', `🏷 ${bi('QR codes', 'رموز QR')}`)
    + `<input type="file" id="si-file" accept=".xlsx,.xls" style="display:none" data-schg="file"></div>`
    + `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px">${chips}</div>`
    + `<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:8px">`
    + `<input type="search" placeholder="${esc(bi('Search name, code or batch', 'بحث بالاسم أو الكود أو الباتش'))}" value="${esc(f.q)}" data-sinp="q" style="flex:1;min-width:180px">`
    + `<select data-schg="group">${opt('', bi('All groups', 'كل المجموعات'), f.groupId)}${opt('__none__', bi('No group', 'بدون مجموعة'), f.groupId)}${s.groups.map((g) => opt(g.id, g.name, f.groupId)).join('')}</select>`
    + `<select data-schg="cabinet">${opt('', bi('All cabinets', 'كل الدواليب'), f.cabinetId)}${opt('__none__', bi('Not in a cabinet', 'بدون دولاب'), f.cabinetId)}${s.cabinets.map((c) => opt(c.id, c.name, f.cabinetId)).join('')}</select></div>`
    + (s.selected.size ? `<div class="chip" style="display:flex;flex-wrap:wrap;gap:6px;padding:6px;margin-bottom:8px">${s.selected.size} ${bi('selected', 'محدد')} `
      + `<select id="si-bulk-target">${s.cabinets.map((c) => opt(c.id, c.name, '')).join('')}</select>`
      + btn('bulk-add', bi('Add to cabinet', 'إضافة للدولاب')) + btn('bulk-move', bi('Move to cabinet', 'نقل للدولاب'))
      + `<select id="si-bulk-group">${opt('', bi('No group', 'بدون مجموعة'), '')}${s.groups.map((g) => opt(g.id, g.name, '')).join('')}</select>`
      + btn('bulk-group', bi('Set group', 'تعيين المجموعة')) + btn('bulk-clear', bi('Clear', 'إلغاء')) + `</div>` : '')
    + (s.items.length >= 1 ? '' : '')
    + `<div class="tw"><table><thead><tr><th></th><th>${bi('Item', 'الصنف')}</th><th>${bi('Group', 'المجموعة')}</th><th>${bi('Cabinets', 'الدواليب')}</th><th>${bi('Batch / expiry', 'الباتش / الانتهاء')}</th><th>${bi('Status', 'الحالة')}</th><th></th></tr></thead><tbody>`
    + (s.rows || `<tr><td colspan="7" style="text-align:center;padding:24px">${s.total ? bi('No items match.', 'لا توجد نتائج.') : bi('No items yet. Add your first item, or import an Excel file.', 'لا توجد أصناف بعد. أضف أول صنف أو استورد ملف إكسل.')}</td></tr>`)
    + `</tbody></table></div></div></div>`;
}

export function batchRowHtml(b) {
  return `<div class="si-batch" data-bid="${esc(b.id)}" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:6px">`
    + `<input data-f="batch" placeholder="${esc(bi('Batch', 'باتش'))}" value="${esc(b.batch)}" style="flex:1;min-width:90px">`
    + `<input data-f="expiry" type="date" value="${esc(b.expiry)}">`
    + `<input data-f="qty" type="number" min="0" step="any" placeholder="${esc(bi('Qty', 'كمية'))}" value="${b.qty == null ? '' : esc(b.qty)}" style="width:90px">`
    + btn('rm-batch', '✕', 'bg', `data-bid="${esc(b.id)}"`) + `</div>`;
}

export function itemFormHtml(d, s) {
  const req = s.settings.required;
  const star = (k) => (req[k] ? ' <b style="color:#b00020">*</b>' : '');
  return `<div id="si-form">`
    + `<label>${bi('Name', 'الاسم')} <b style="color:#b00020">*</b></label><input data-f="name" value="${esc(d.name)}" maxlength="120" style="width:100%">`
    + `<label>${bi('Code', 'الكود')} <b style="color:#b00020">*</b></label><input data-f="code" value="${esc(d.code)}" maxlength="60" style="width:100%">`
    + `<label>${bi('Group', 'المجموعة')}</label><select data-f="groupId" style="width:100%">${opt('', bi('No group', 'بدون مجموعة'), d.groupId)}${s.groups.map((g) => opt(g.id, g.name, d.groupId)).join('')}</select>`
    + `<label>${bi('Cabinets', 'الدواليب')}</label><div>${s.cabinets.map((c) => `<label style="display:inline-block;margin-inline-end:10px"><input type="checkbox" data-cab="${esc(c.id)}"${d.cabinetIds.includes(c.id) ? ' checked' : ''}> ${esc(c.name)}</label>`).join('') || `<span class="ssub">${bi('No cabinets yet — create them from the Cabinets button.', 'لا توجد دواليب — أنشئها من زر الدواليب.')}</span>`}</div>`
    + `<label>${bi('Batches & expiry', 'الباتشات والانتهاء')}${star('expiry')}${star('batch')}${star('quantity')}</label><div id="si-batches">${d.batches.map(batchRowHtml).join('')}</div>${btn('add-batch', `+ ${bi('Add batch / expiry', 'إضافة باتش / تاريخ')}`)}`
    + `<label style="display:block;margin-top:8px"><input type="checkbox" data-f="outOfStock"${d.outOfStock ? ' checked' : ''}> ${bi('Out of stock', 'نفد من المخزون')}</label>`
    + `<label>${bi('Notes', 'ملاحظات')}</label><input data-f="notes" value="${esc(d.notes)}" maxlength="300" style="width:100%">`
    + `<div id="si-errors" style="color:#b00020;margin-top:8px"></div></div>`;
}

export const nameListHtml = (kind, rows, withDesc) => `<div id="si-names">${rows.map((r) => `<div style="display:flex;gap:6px;margin-bottom:6px" data-rid="${esc(r.id)}"><input data-f="name" value="${esc(r.name)}" maxlength="60" style="flex:1">${withDesc ? `<input data-f="desc" value="${esc(r.desc || '')}" maxlength="120" placeholder="${esc(bi('Description', 'وصف'))}" style="flex:1">` : ''}${btn('rm-name', '🗑', 'bg', `data-rid="${esc(r.id)}"`)}</div>`).join('')}</div>${btn('add-name', `+ ${bi('Add', 'إضافة')}`)}`;

export const settingsHtml = (settings) => `<p class="ssub">${bi('Name and code are always required. Choose what else must be filled in for every item in this department.', 'الاسم والكود إلزاميان دائماً. اختر ما يلزم تعبئته أيضاً لكل صنف في هذا القسم.')}</p>`
  + REQUIRABLE.map((k) => `<label style="display:block;margin:6px 0"><input type="checkbox" data-req="${k}"${settings.required[k] ? ' checked' : ''}> ${FIELD_LABEL[k]}</label>`).join('');

export function importPreviewHtml(read, fileName) {
  if (!read.ok) return `<p style="color:#b00020"><b>${bi('The file cannot be imported. Nothing was changed.', 'لا يمكن استيراد الملف. لم يتغير شيء.')}</b></p><ul>${read.errors.slice(0, 40).map((e) => `<li>${e.row ? `${bi('Row', 'سطر')} ${e.row}: ` : ''}${esc(e.text)}</li>`).join('')}</ul>`;
  const { plan, stats } = read;
  const li = (t) => `<li>${t}</li>`;
  return `<p class="ssub">${esc(fileName)}</p><p><b>${bi('Review before applying — nothing is deleted.', 'راجع قبل التطبيق — لن يُحذف شيء.')}</b></p>`
    + `<div>${bi('New items', 'أصناف جديدة')}: <b>${plan.add.length}</b> · ${bi('Changed', 'تغيّرت')}: <b>${plan.update.length}</b> · ${bi('Unchanged', 'بدون تغيير')}: <b>${stats.unchanged}</b></div>`
    + `<ul>${plan.add.slice(0, 60).map((a) => li(`➕ ${esc(a.name)} <span class="mono">(${esc(a.code)})</span>${a.expiries.length ? ` — ${a.expiries.map(esc).join(', ')}` : ''}`)).join('')}`
    + `${plan.update.slice(0, 60).map((u) => li(`✏️ <span class="mono">${esc(u.code)}</span> ${u.newName ? `${esc(u.oldName)} → <b>${esc(u.newName)}</b> ` : esc(u.oldName || '')}${[...u.fill.map((x) => x.expiry), ...u.append].length ? ` — ${bi('expiry', 'انتهاء')}: ${[...u.fill.map((x) => x.expiry), ...u.append].map(esc).join(', ')}` : ''}`)).join('')}</ul>`
    + (plan.add.length + plan.update.length > 120 ? `<p class="ssub">… ${bi('and more', 'والمزيد')}</p>` : '')
    + (plan.add.length + plan.update.length === 0 ? `<p>${bi('Nothing would change.', 'لن يتغير شيء.')}</p>` : '');
}
