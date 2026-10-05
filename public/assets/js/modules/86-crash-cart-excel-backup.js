/* Crash Cart contents: backup to Excel, edit there, restore from Excel.
   Inpatient Pharmacy Supervisor and Master only (capability crashCart.backup).
   The rules live in core/crash-cart-excel.js; this file is the export, the
   preview dialog and the write. The two buttons are part of the Crash Carts
   page's own toolbar, which imports ccExcelBackup / ccExcelRestore from here
   (no window globals). Nothing is written until the person has seen the
   list of changes and confirmed it. */
import { SHEET_NAME, INFO_SHEET_NAME, FORMAT, COLUMNS, buildRows, readSheet, applyPlan, dateToSerial } from '../core/crash-cart-excel.js?v=8136b92558';

var E = function (id) { return document.getElementById(id); };
var busy = false;

function allowed() {
  return typeof window.fsHasCapability === 'function' && window.fsHasCapability('crashCart.backup');
}
function say(ar, en, type) {
  if (typeof window.toast === 'function') window.toast(String(ar || '') + '\n' + String(en || ''), type || 'info');
}
/* The audit entry is a record of something already done; if writing it fails the
   action stands, and the failure is logged rather than shown as a failed save. */
async function audit(action, details) {
  if (typeof window.auditAction !== 'function') return;
  try { await window.auditAction(action, details); } catch (error) { console.warn('Audit entry for ' + action + ' was not written.', error); }
}
function carts() { return typeof window.crashCarts === 'function' ? (window.crashCarts() || []) : []; }
function openReportCartIds() {
  var reports = typeof window.crashReports === 'function' ? (window.crashReports() || []) : [];
  return reports.filter(function (r) { return r && (r.status === 'open' || r.status === 'pending'); }).map(function (r) { return String(r.cartId); });
}
function who() {
  var a = typeof window.fsActor === 'function' ? window.fsActor() : {};
  return { name: String(a.name || a.user || 'Unknown'), user: String(a.user || a.name || 'Unknown') };
}
function stampName() {
  var d = new Date();
  function p(n) { return String(n).padStart(2, '0'); }
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + '_' + p(d.getHours()) + p(d.getMinutes());
}
function el(tag, props, children) {
  var n = document.createElement(tag);
  Object.keys(props || {}).forEach(function (k) {
    if (k === 'text') n.textContent = props[k];
    else if (k === 'style') n.style.cssText = props[k];
    else n.setAttribute(k, props[k]);
  });
  (children || []).forEach(function (c) { if (c) n.appendChild(c); });
  return n;
}

/* ------------------------------------------------------------------ export */
function buildWorkbook(list) {
  var daysUntil = function (v) { return typeof window.fsDaysUntil === 'function' ? window.fsDaysUntil(v) : null; };
  var deptName = function (id) { return typeof window.fsDeptName === 'function' ? window.fsDeptName(id) : String(id || ''); };
  var rows = buildRows(list, { deptName: deptName, daysUntil: daysUntil });
  var ws = XLSX.utils.aoa_to_sheet(rows);
  var expiryCol = COLUMNS.findIndex(function (c) { return c.key === 'expiry'; });
  var daysCol = COLUMNS.findIndex(function (c) { return c.key === 'daysLeft'; });
  for (var r = 1; r < rows.length; r += 1) {
    var expiryAddr = XLSX.utils.encode_cell({ r: r, c: expiryCol });
    var serial = dateToSerial(rows[r][expiryCol]);
    if (serial !== null) {
      ws[expiryAddr] = { t: 'n', v: serial, z: 'yyyy-mm-dd' };
      var col = XLSX.utils.encode_col(expiryCol);
      ws[XLSX.utils.encode_cell({ r: r, c: daysCol })] = {
        t: 'n', v: Number(rows[r][daysCol]) || 0,
        f: 'IF(' + col + (r + 1) + '="","",' + col + (r + 1) + '-TODAY())'
      };
    }
  }
  ws['!cols'] = [26, 20, 16, 30, 14, 12, 12, 16, 12, 14, 12, 18, 18, 26].map(function (w) { return { wch: w }; });
  ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.max(0, rows.length - 1), c: COLUMNS.length - 1 } }) };
  var a = who();
  var info = XLSX.utils.aoa_to_sheet([
    ['Format', FORMAT],
    ['Exported at', new Date().toISOString()],
    ['Exported by', a.name],
    ['Carts', list.length],
    [],
    ['How to use / طريقة الاستخدام'],
    ['1. Edit only: Required qty, Available qty, Expiry, Batch qty, Lot. / عدّل فقط: المطلوب، المتوفر، الانتهاء، كمية الدفعة، التشغيلة.'],
    ['2. Dates: YYYY-MM-DD (or DD/MM/YYYY, day first). / التاريخ: سنة-شهر-يوم أو يوم/شهر/سنة.'],
    ['3. To add a batch, copy a whole row of the same medicine and change its date/qty/lot. / لإضافة دفعة انسخ سطر نفس الدواء كاملاً.'],
    ['4. Batch quantities of a medicine must add up to its Available qty. / مجموع كميات الدفعات يساوي المتوفر.'],
    ['5. Do not edit or delete the ID / version columns. A medicine with no rows is left unchanged. / لا تعدّل أعمدة المعرّف والإصدار.'],
    ['6. The seal number and days-left columns are for reading only and are not imported. / رقم القفل والأيام المتبقية للقراءة فقط.']
  ]);
  info['!cols'] = [{ wch: 110 }, { wch: 40 }];
  var wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, SHEET_NAME);
  XLSX.utils.book_append_sheet(wb, info, INFO_SHEET_NAME);
  return { wb: wb, rows: rows.length - 1 };
}

async function exportNow(prefix) {
  await window.ensureXLSX();
  var list = carts();
  var built = buildWorkbook(list);
  XLSX.writeFile(built.wb, (prefix || 'FloorStock_CrashCarts') + '_' + stampName() + '.xlsx');
  return { carts: list.length, rows: built.rows };
}

async function backupClicked() {
  if (!allowed()) return say('هذه الميزة لمشرف الصيدلية الداخلية والماستر فقط.', 'Only the Inpatient Pharmacy Supervisor and Master can do this.', 'err');
  if (busy) return;
  busy = true;
  try {
    var done = await exportNow('FloorStock_CrashCarts');
    await audit('crash_cart_excel_backup', { carts: done.carts, rows: done.rows });
    say('تم تنزيل النسخة الاحتياطية (' + done.carts + ' عربة).', 'Backup downloaded (' + done.carts + ' carts).', 'succ');
  } catch (error) {
    say('تعذر إنشاء ملف Excel.', 'Could not create the Excel file. ' + String((error && error.message) || error), 'err');
  } finally { busy = false; }
}

/* ------------------------------------------------------------------ restore */
function closeDialog() { var m = E('cc-excel-dialog'); if (m) m.remove(); }

function options(overwriteStale) {
  return { currentCarts: carts(), blockedCartIds: openReportCartIds(), overwriteStale: !!overwriteStale };
}
function signature(result) {
  return JSON.stringify(result.changes.map(function (c) { return [c.cartId, c.itemId, c.lines]; }));
}

function showPreview(aoa, fileName, overwriteStale) {
  var result = readSheet(aoa, options(overwriteStale));
  closeDialog();
  var box = el('div', { 'class': 'modal', style: 'max-width:760px;width:94%;max-height:86vh;overflow:auto;padding:18px', dir: 'ltr' });
  var bg = el('div', { 'class': 'modal-bg on', id: 'cc-excel-dialog', role: 'dialog', 'aria-modal': 'true' }, [box]);
  box.appendChild(el('h3', { text: 'Restore from Excel / استرجاع من Excel', style: 'margin:0 0 4px' }));
  box.appendChild(el('div', { text: fileName, style: 'font-size:12px;opacity:.7;margin-bottom:10px' }));

  function list(items, color) {
    var ul = el('ul', { style: 'margin:6px 0 12px;padding-inline-start:18px;font-size:13px;line-height:1.6;' + (color ? 'color:' + color : '') });
    items.forEach(function (t) { ul.appendChild(el('li', { text: t })); });
    return ul;
  }

  if (result.errors.length) {
    box.appendChild(el('div', { text: 'Nothing was changed. Fix these ' + result.errors.length + ' problem(s) in the file and load it again. / لم يتغير شيء. صحّح الأخطاء ثم أعد التحميل.', style: 'font-weight:700;color:#e5484d' }));
    var shown = result.errors.slice(0, 40).map(function (e) { return (e.row ? 'Row ' + e.row + ': ' : '') + e.message; });
    if (result.errors.length > 40) shown.push('… and ' + (result.errors.length - 40) + ' more');
    box.appendChild(list(shown, '#e5484d'));
  } else {
    box.appendChild(el('div', {
      text: result.stats.changedItems
        ? result.stats.changedItems + ' medicine(s) in ' + result.stats.changedCarts + ' cart(s) will change. / سيتغير ' + result.stats.changedItems + ' دواء في ' + result.stats.changedCarts + ' عربة.'
        : 'No differences were found — the file matches the current data. / لا توجد فروقات.',
      style: 'font-weight:700;margin-bottom:6px'
    }));
    var lines = [];
    result.changes.forEach(function (c) { c.lines.forEach(function (line) { lines.push(c.cart + ' — ' + c.medicine + ': ' + line); }); });
    if (lines.length > 120) { var rest = lines.length - 120; lines = lines.slice(0, 120); lines.push('… and ' + rest + ' more change(s)'); }
    if (lines.length) box.appendChild(list(lines));
    if (result.skipped.length) {
      box.appendChild(el('div', { text: 'Skipped / تم تخطيها:', style: 'font-weight:700;color:#d99a00' }));
      box.appendChild(list(result.skipped.map(function (s) { return s.message; }), '#d99a00'));
    }
  }

  var staleSkipped = result.skipped.some(function (s) { return s.reason === 'stale'; });
  var overwrite = null;
  if (!result.errors.length && (staleSkipped || overwriteStale)) {
    overwrite = el('input', { type: 'checkbox', id: 'cc-excel-overwrite' });
    overwrite.checked = !!overwriteStale;
    overwrite.addEventListener('change', function () { showPreview(aoa, fileName, overwrite.checked); });
    box.appendChild(el('label', { style: 'display:flex;gap:8px;align-items:center;margin:8px 0;font-size:13px' }, [
      overwrite,
      el('span', { text: 'Also apply carts changed after the export (overwrites those newer changes) / طبّق أيضاً العربات التي تغيّرت بعد التصدير (يستبدل التغييرات الأحدث)' })
    ]));
  }

  var actions = el('div', { style: 'display:flex;gap:8px;justify-content:flex-end;margin-top:12px;flex-wrap:wrap' });
  var cancel = el('button', { 'class': 'btn bs', type: 'button', text: 'Close / إغلاق' });
  cancel.addEventListener('click', closeDialog);
  actions.appendChild(cancel);
  if (!result.errors.length && result.stats.changedItems) {
    var apply = el('button', { 'class': 'btn bp', type: 'button', id: 'cc-excel-apply', text: 'Apply changes / تطبيق التعديلات' });
    apply.addEventListener('click', function () { applyNow(aoa, fileName, !!(overwrite && overwrite.checked), signature(result), apply); });
    actions.appendChild(apply);
    box.appendChild(el('div', { text: 'A backup of the current data is downloaded automatically before applying. / تُنزَّل نسخة من البيانات الحالية تلقائياً قبل التطبيق.', style: 'font-size:12px;opacity:.75' }));
  }
  box.appendChild(actions);
  bg.addEventListener('click', function (event) { if (event.target === bg) closeDialog(); });
  document.body.appendChild(bg);
}

async function applyNow(aoa, fileName, overwriteStale, shownSignature, button) {
  if (!allowed()) return say('هذه الميزة لمشرف الصيدلية الداخلية والماستر فقط.', 'Only the Inpatient Pharmacy Supervisor and Master can do this.', 'err');
  if (busy) return;
  busy = true;
  if (button) { button.disabled = true; button.textContent = 'Applying… / جاري التطبيق'; }
  try {
    /* The trolleys may have changed while the list was on screen. */
    var fresh = readSheet(aoa, options(overwriteStale));
    if (fresh.errors.length || signature(fresh) !== shownSignature) {
      say('تغيرت البيانات أثناء المراجعة. راجع القائمة من جديد.', 'The data changed while you were reviewing. Review the list again.', 'err');
      busy = false;
      return showPreview(aoa, fileName, overwriteStale);
    }
    await exportNow('FloorStock_CrashCarts_BEFORE_restore');
    var working = carts();
    var a = who();
    applyPlan(working, fresh.plan, a, new Date().toISOString());
    await window.setCrashCarts(working);
    await audit('crash_cart_excel_restore', {
      file: fileName, carts: fresh.stats.changedCarts, items: fresh.stats.changedItems,
      overwroteStale: !!overwriteStale, updatedBy: a.user
    });
    closeDialog();
    if (typeof window.renderCrashCarts === 'function') window.renderCrashCarts();
    say('تم تطبيق ' + fresh.stats.changedItems + ' تعديل. على الاتصال الضعيف يُرسل للسيرفر عند عودة الاتصال، أبقِ الصفحة مفتوحة.',
      fresh.stats.changedItems + ' change(s) applied ✓ On a weak connection they are sent to the server when it returns — keep this page open.', 'succ');
  } catch (error) {
    console.error('Crash Cart Excel restore failed', error);
    say('فشل التطبيق. قد لا تُحفظ التعديلات؛ راجع العربات. نُزِّلت نسخة احتياطية قبل المحاولة.',
      'The restore failed and may not have been saved — check the carts. A backup was downloaded first. ' + String((error && error.message) || error), 'err');
    if (button) { button.disabled = false; button.textContent = 'Apply changes / تطبيق التعديلات'; }
  } finally { busy = false; }
}

async function fileChosen(input) {
  var file = input.files && input.files[0];
  input.value = '';
  if (!file) return;
  if (!allowed()) return say('هذه الميزة لمشرف الصيدلية الداخلية والماستر فقط.', 'Only the Inpatient Pharmacy Supervisor and Master can do this.', 'err');
  try {
    await window.ensureXLSX();
    var buffer = await file.arrayBuffer();
    var wb = XLSX.read(buffer, { type: 'array', cellDates: false });
    var ws = wb.Sheets[SHEET_NAME] || wb.Sheets[wb.SheetNames[0]];
    if (!ws) throw new Error('The workbook has no sheet.');
    var aoa = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' });
    showPreview(aoa, file.name, false);
  } catch (error) {
    console.error('Crash Cart Excel file could not be read', error);
    say('تعذرت قراءة الملف. تأكد أنه ملف Excel (.xlsx).', 'The file could not be read. Make sure it is an Excel (.xlsx) file. ' + String((error && error.message) || error), 'err');
  }
}

function restoreClicked() {
  if (!allowed()) return say('هذه الميزة لمشرف الصيدلية الداخلية والماستر فقط.', 'Only the Inpatient Pharmacy Supervisor and Master can do this.', 'err');
  var input = E('cc-excel-file');
  if (!input) {
    input = el('input', { type: 'file', id: 'cc-excel-file', accept: '.xlsx,.xls', style: 'display:none' });
    input.addEventListener('change', function () { fileChosen(input); });
    document.body.appendChild(input);
  }
  input.click();
}

export { backupClicked as ccExcelBackup, restoreClicked as ccExcelRestore };
