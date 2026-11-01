/* The printed sheet and the on-screen table for the crash-cart expiry list.

   One A4 page, no facility letterhead: the sheet is a working list a pharmacist
   carries to the carts and writes the new seal number on. A single line names it
   and its window; everything else is the table and the summary. */

import { fsEsc as esc } from './dom-utils.js?v=b2909b7f46';

const medicineLabel = (generic, strength) => generic + (strength ? ' ' + strength : '');
const qtyText = (qty) => (qty === null ? '—' : String(qty));

/* One block per cart. The new seal is one number for the whole cart, so the cart's
   name and the seal cell each appear once, spanning the cart's rows; blocks
   alternate shading so a cart reads as a unit. A mark after the cart's name says
   it is out of a medicine (see the summary). Left to right throughout. */
export function listTable(list, { forPrint = false } = {}) {
  const head = '<thead><tr><th>Crash cart<br>اسم الكراش كارت</th><th>New seal number<br>رقم القفل الجديد</th>'
    + '<th>Generic name<br>الاسم العلمي</th><th>Near-expiry qty<br>الكمية قريبة الانتهاء</th>'
    + '<th>Expiry date<br>تاريخ الانتهاء</th></tr></thead>';
  const cols = '<colgroup><col style="width:20%"><col style="width:20%"><col style="width:30%"><col style="width:14%"><col style="width:16%"></colgroup>';
  const body = list.groups.map((group, index) => group.lines.map((line, lineIndex) => {
    const span = ' rowspan="' + group.lines.length + '"';
    return '<tr class="' + (index % 2 ? 'w' : 'g') + '">'
      + (lineIndex === 0 ? '<td class="cart"' + span + ' dir="auto">' + esc(group.cartName)
        + (group.marks.length ? ' <b class="mk">' + esc(group.marks.join(' ')) + '</b>' : '') + '</td>' : '')
      + (lineIndex === 0 ? '<td class="seal"' + span + '></td>' : '')
      + '<td dir="auto">' + esc(medicineLabel(line.generic, line.strength)) + '</td>'
      + '<td>' + esc(qtyText(line.qty)) + '</td>'
      + '<td' + (line.expired ? ' class="x"' : '') + '>' + esc(line.expiry) + (line.expired ? ' ⚠' : '') + '</td>'
      + '</tr>';
  }).join('')).join('');
  return '<table dir="ltr" class="' + (forPrint ? 'sheet' : 'list') + '">' + cols + head + '<tbody>' + body + '</tbody></table>';
}

/* What each medicine needs: the near-expiry units to replace, plus the standard
   quantity to put back in every cart that has none. The mark sits beside the name,
   not in a column of its own. */
export function summaryTable(list) {
  const { summary } = list;
  const lines = summary.medicines.map((m) => '<tr><td dir="auto">' + (m.mark ? '<b class="mk">' + esc(m.mark) + '</b> ' : '')
    + esc(medicineLabel(m.generic, m.strength)) + '</td>'
    + '<td class="c">' + (m.carts || '—') + '</td>'
    + '<td class="c"><b>' + (m.qty + m.addQty) + '</b>'
    + (m.uncounted ? ' <span class="note">+' + m.uncounted + '؟</span>' : '')
    + (m.missingCarts ? ' <span class="note">(ينضاف ' + m.addQty + ' في ' + m.missingCarts + ' عربة)</span>' : '')
    + '</td></tr>').join('');
  const note = summary.uncountedRows
    ? '<div class="note">' + summary.uncountedRows + ' row(s) with no recorded quantity (marked —) / سطر بكمية غير مسجلة</div>' : '';
  return '<table dir="ltr" class="sum"><thead><tr><th>Medicine<br>الدواء</th><th>Carts<br>عدد العربات</th>'
    + '<th>To replace / add<br>المطلوب تغييره أو إضافته</th></tr></thead><tbody>' + lines + '</tbody>'
    + '<tfoot><tr><td>Total / الإجمالي</td><td class="c">' + summary.cartCount + '</td><td class="c"><b>'
    + (summary.totalQty + summary.totalAdd) + '</b></td></tr></tfoot></table>' + note;
}

export function sheetHtml(list, today) {
  const css = '@page{size:A4;margin:8mm}'
    + 'body{font-family:Arial,Tahoma,sans-serif;color:#111;margin:0;font-size:var(--fs,10pt)}'
    + 'h1{font-size:1.2em;margin:0 0 4px;text-align:center}.sub{font-size:.9em;color:#444;margin-bottom:6px;text-align:center}'
    + 'table{border-collapse:collapse;width:100%;margin:0 auto 8px}'
    + 'th,td{border:1px solid #333;padding:2px 5px;vertical-align:middle;text-align:center}'
    + 'th{background:#eee;font-size:.9em}td.x{font-weight:700}'
    + 'table{table-layout:fixed;word-break:break-word}'
    + 'tr.g td{background:#e4e4e4}tr.w td{background:#fff}td.m{color:#8a1f11;font-weight:700}'
    + 'table.sum{width:80%}td.cart{font-weight:700}.mk{font-size:1.1em}table.sum tfoot td{font-weight:700;background:#f3f3f3}'
    + '*{-webkit-print-color-adjust:exact;print-color-adjust:exact}'
    + '.note{font-size:.85em;color:#555;font-weight:400}.brand{text-align:center;font-size:.8em;color:#555;margin-top:6px}';
  const rowsPart = list.groups.length || list.missing.length
    ? (list.groups.length ? listTable(list, { forPrint: true }) : '') + summaryTable(list)
    : '<p>لا توجد أدوية تنتهي خلال هذه الفترة / Nothing expires or is missing.</p>';
  return '<!doctype html><html lang="en" dir="ltr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Crash cart expiry list</title>'
    + '<style>' + css + '</style></head><body>'
    + '<h1>العربات قريبة الانتهاء / Crash carts near expiry</h1>'
    + '<div class="sub">' + esc(today) + ' · ' + list.windowDays + ' يوم / days</div>'
    + rowsPart + '<div class="brand">By Ali Abudahash</div></body></html>';
}

/* The sheet is one page by design. Shrink the type until the content fits the
   printable height, down to a floor below which it would stop being legible. */
export function fitToOnePage(win) {
  const doc = win.document;
  const pageHeight = 277 / 25.4 * 96; // A4 minus 8 mm margins, in CSS px
  for (let size = 10; size >= 6; size -= 0.5) {
    doc.body.style.setProperty('--fs', size + 'pt');
    if (doc.body.scrollHeight <= pageHeight) break;
  }
}
