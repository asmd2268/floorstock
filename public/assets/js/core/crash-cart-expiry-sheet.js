/* The printed sheet and the on-screen table for the crash-cart expiry list.

   One A4 page, no facility letterhead: the sheet is a working list a pharmacist
   carries to the carts and writes the new seal number on. A single line names it
   and its window; everything else is the table and the summary. */

import { fsEsc as esc } from './dom-utils.js?v=b2909b7f46';

const medicineLabel = (generic, strength) => generic + (strength ? ' ' + strength : '');
const qtyText = (qty) => (qty === null ? '—' : String(qty));

const unavailableText = (line) => 'غير متوفر بالكراش كارت ' + line.cartName + ' — الستاندرد: ' + line.standard;

/* One block per cart. The new seal is one number for the whole cart, so its cell
   spans the cart's rows; blocks alternate shading so a cart reads as a unit. */
export function listTable(list, { forPrint = false } = {}) {
  const head = '<thead><tr><th>اسم الكراش كارت<br>Crash cart</th><th>الاسم العلمي<br>Generic name</th>'
    + '<th>الكمية قريبة الانتهاء<br>Near-expiry qty</th><th>تاريخ الانتهاء<br>Expiry date</th>'
    + '<th>غير متوفر<br>Unavailable</th><th>رقم القفل الجديد<br>New seal number</th></tr></thead>';
  const body = list.groups.map((group, index) => group.lines.map((line, lineIndex) => {
    const missing = line.kind === 'missing';
    return '<tr class="' + (index % 2 ? 'w' : 'g') + '">'
      + '<td dir="auto">' + esc(line.cartName) + '</td>'
      + '<td dir="auto">' + esc(medicineLabel(line.generic, line.strength)) + '</td>'
      + '<td class="c">' + (missing ? '' : esc(qtyText(line.qty))) + '</td>'
      + '<td class="c' + (line.expired ? ' x' : '') + '">' + (missing ? '' : esc(line.expiry) + (line.expired ? ' ⚠' : '')) + '</td>'
      + '<td class="m">' + (missing ? esc(unavailableText(line)) : '') + '</td>'
      + (lineIndex === 0 ? '<td class="seal" rowspan="' + group.lines.length + '"></td>' : '')
      + '</tr>';
  }).join('')).join('');
  const cols = '<colgroup><col style="width:13%"><col style="width:23%"><col style="width:10%"><col style="width:14%"><col style="width:26%"><col style="width:14%"></colgroup>';
  return '<table class="' + (forPrint ? 'sheet' : 'list') + '">' + cols + head + '<tbody>' + body + '</tbody></table>';
}

export function summaryTable(list) {
  const { summary } = list;
  const lines = summary.medicines.map((m) => '<tr><td dir="auto">' + esc(medicineLabel(m.generic, m.strength)) + '</td>'
    + '<td class="c">' + (m.carts || '—') + '</td><td class="c"><b>' + (m.carts ? m.qty : '—') + '</b>'
    + (m.uncounted ? ' <span class="note">+' + m.uncounted + '؟</span>' : '') + '</td>'
    + '<td class="c">' + (m.missingCarts || '') + '</td></tr>').join('');
  const note = summary.uncountedRows
    ? '<div class="note">' + summary.uncountedRows + ' سطر بكمية غير مسجلة / row(s) with no recorded quantity (marked —)</div>' : '';
  return '<table class="sum"><thead><tr><th>الدواء<br>Medicine</th><th>عدد العربات<br>Carts</th>'
    + '<th>المطلوب تغييره<br>To replace</th><th>غير متوفر (عربات)<br>Unavailable (carts)</th></tr></thead><tbody>' + lines + '</tbody>'
    + '<tfoot><tr><td>الإجمالي / Total</td><td class="c">' + summary.cartCount + '</td><td class="c"><b>'
    + summary.totalQty + '</b></td><td class="c">' + (summary.missingRows || '') + '</td></tr></tfoot></table>' + note;
}

export function sheetHtml(list, today) {
  const css = '@page{size:A4;margin:8mm}'
    + 'body{font-family:Arial,Tahoma,sans-serif;color:#111;margin:0;font-size:var(--fs,10pt)}'
    + 'h1{font-size:1.2em;margin:0 0 4px}.sub{font-size:.9em;color:#444;margin-bottom:6px}'
    + 'table{border-collapse:collapse;width:100%;margin-bottom:8px}'
    + 'th,td{border:1px solid #333;padding:2px 5px;vertical-align:middle}'
    + 'th{background:#eee;font-size:.9em}td.c{text-align:center}td.x{font-weight:700}'
    + 'table{table-layout:fixed;word-break:break-word}'
    + 'tr.g td{background:#e4e4e4}tr.w td{background:#fff}td.m{color:#8a1f11;font-weight:700}'
    + 'td.seal{background:#fff!important}table.sum{width:80%}table.sum tfoot td{font-weight:700;background:#f3f3f3}'
    + '*{-webkit-print-color-adjust:exact;print-color-adjust:exact}'
    + '.note{font-size:.85em;color:#555}.brand{text-align:center;font-size:.8em;color:#555;margin-top:6px}';
  const rowsPart = list.groups.length
    ? listTable(list, { forPrint: true }) + summaryTable(list)
    : '<p>لا توجد أدوية تنتهي خلال هذه الفترة / Nothing expires or is missing.</p>';
  return '<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Crash cart expiry list</title>'
    + '<style>' + css + '</style></head><body>'
    + '<h1>أدوية العربات قريبة الانتهاء / Crash-cart near-expiry list</h1>'
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
