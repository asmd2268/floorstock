/* Medical Supplies — printed sheets. Pure HTML builders: the caller supplies
   the QR renderer, the header and the page opener, so this file has no DOM and
   no globals. Two sheets:
     list    the department's list, by cabinet or group, with or without expiry
             columns (a list can be printed with no dates and tracked by QR only);
     labels  one QR per batch row — name, code, batch, expiry, and a marker when
             the date is near or past, so the label is readable without scanning. */

import { bi, itemExpiry } from './medical-supplies-model.js?v=1697923431';

const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const PRINT_CSS = `
h2{margin:14px 0 4px;font-size:13pt}.sub{color:#555;font-size:9pt;margin-bottom:6px}
table{width:100%;border-collapse:collapse;margin-bottom:10px;font-size:9.5pt}
th,td{border:1px solid #999;padding:4px 6px;text-align:left;vertical-align:top}th{background:#eee}
.mono{font-family:monospace}.st-expired,.st-urgent{color:#b00020;font-weight:700}.st-near{color:#b26a00;font-weight:700}
.grid{display:flex;flex-wrap:wrap;gap:6px}.lbl{width:62mm;border:1px solid #333;border-radius:3px;padding:4px;display:flex;gap:6px;page-break-inside:avoid;align-items:center}
.lbl img{width:20mm;height:20mm;flex:none}.lbl .t{font-size:8.5pt;line-height:1.25;min-width:0;overflow-wrap:anywhere}.lbl b{font-size:9.5pt}
.lbl.warn{border:2px solid #b26a00}.lbl.bad{border:2px solid #b00020}.tag{display:inline-block;font-weight:700;font-size:8pt;padding:0 3px;border:1px solid currentColor;border-radius:2px;margin-top:2px}
`;

const dateCell = (b, ctx) => (b.expiry
  ? `<span class="st-${b.status}">${esc(b.expiry)}${b.days != null ? ` (${b.days} d)` : ''}</span>` : '—');

/* options: { sections, withExpiry, cfg, today, groupName } */
export function listHtml(options) {
  const o = options;
  const head = `<tr><th>#</th><th>${bi('Name', 'الاسم')}</th><th>${bi('Code', 'الكود')}</th>`
    + (o.withExpiry ? `<th>${bi('Batch', 'الباتش')}</th><th>${bi('Qty', 'الكمية')}</th><th>${bi('Expiry', 'الانتهاء')}</th>` : `<th>${bi('Group', 'المجموعة')}</th>`)
    + '</tr>';
  return o.sections.map((section) => {
    let n = 0;
    const rows = section.items.map((item) => {
      n += 1;
      if (!o.withExpiry) {
        return `<tr><td>${n}</td><td>${esc(item.name)}</td><td class="mono">${esc(item.code)}</td><td>${esc(item.groupId ? o.groupName(item.groupId) : '')}</td></tr>`;
      }
      const exp = itemExpiry(item, o.cfg, o.today);
      const batches = exp.batches.length ? exp.batches : [null];
      return batches.map((b, k) => `<tr>${k === 0 ? `<td rowspan="${batches.length}">${n}</td><td rowspan="${batches.length}">${esc(item.name)}${item.outOfStock ? ` <b>(${bi('Out', 'نفد')})</b>` : ''}</td><td class="mono" rowspan="${batches.length}">${esc(item.code)}</td>` : ''}`
        + `<td>${b ? esc(b.batch) : ''}</td><td>${b && b.qty != null ? esc(b.qty) : ''}</td><td>${b ? dateCell(b) : '—'}</td></tr>`).join('');
    }).join('');
    return `<h2>${esc(section.title)}</h2>${section.desc ? `<div class="sub">${esc(section.desc)}</div>` : ''}<table><thead>${head}</thead><tbody>${rows}</tbody></table>`;
  }).join('') || `<p>${bi('Nothing to print.', 'لا يوجد ما يُطبع.')}</p>`;
}

/* One QR per cabinet, plus one for the whole list. The QR opens the live public
   page (no sign-in) — there is no QR per item. options: { targets:[{title,sub,url}], qrFor } */
export function qrSheetHtml(options) {
  return `<div class="grid">${options.targets.map((t) => `<div class="lbl" style="width:88mm;padding:8px"><img src="${options.qrFor(t.url)}" alt="QR" style="width:34mm;height:34mm"><div class="t"><b style="font-size:11pt">${esc(t.title)}</b>${t.sub ? `<br>${esc(t.sub)}` : ''}<br><span style="font-size:7.5pt">${bi('Scan to follow expiry live', 'امسح لمتابعة الانتهاء مباشرة')}</span></div></div>`).join('')}</div>`;
}
