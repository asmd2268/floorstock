/* Crash Cart contents ⇄ Excel.

   A supervisor takes a backup of every trolley as a workbook, corrects dates and
   quantities in Excel, and loads it back. Nothing here touches the page or the
   database: this module turns trolleys into rows, reads edited rows back, and
   says exactly what would change — so the screen can show that list before a
   single value is written.

   What can be edited in the sheet:   required quantity, available quantity,
                                      and every batch's expiry date, quantity, lot.
   What is shown but NOT imported:    cart name, department, medicine name,
                                      strength, the seal number, days left.
   The seal is left out on purpose: a recorded seal on a sealed trolley is
   corrected only through the Master's seal-correction flow, which asks for a
   reason and checks it against the whole seal history.

   Why a restore can be unsafe, and what stops it:
   · The sheet is old by the time it is loaded. A trolley that changed after the
     export (a department report, a replacement) carries a different "version";
     its rows are SKIPPED unless the person explicitly chooses to overwrite.
   · A trolley with an open or pending report is skipped: that report's
     quantities are still being decided.
   · A medicine with no rows in the sheet is left alone, never deleted — a
     deleted row cannot silently remove stock.
   · Every rule of the contents editor is enforced again here (available ≤
     required, batch quantities add up to available, a date and quantity on every
     batch), and nothing is applied while any row has an error. */

export const SHEET_NAME = 'Crash Carts';
export const INFO_SHEET_NAME = 'Info';
export const FORMAT = 'floorstock-crash-cart-backup-v1';

/* Header text is "English / عربي". Matching uses the English part only, so a
   header that Excel re-flowed or a person retyped still matches. */
export const COLUMNS = [
  { key: 'cart', label: 'Cart / العربة', editable: false },
  { key: 'dept', label: 'Department / القسم', editable: false },
  { key: 'seal', label: 'Seal (not imported) / رقم القفل (لا يُستورد)', editable: false },
  { key: 'medicine', label: 'Medicine / الدواء', editable: false },
  { key: 'strength', label: 'Strength / التركيز', editable: false },
  { key: 'required', label: 'Required qty / الكمية المطلوبة', editable: true },
  { key: 'available', label: 'Available qty / الكمية المتوفرة', editable: true },
  { key: 'expiry', label: 'Expiry (YYYY-MM-DD) / تاريخ الانتهاء', editable: true },
  { key: 'batchQty', label: 'Batch qty / كمية الدفعة', editable: true },
  { key: 'lot', label: 'Lot / رقم التشغيلة', editable: true },
  { key: 'daysLeft', label: 'Days left (not imported) / الأيام المتبقية (لا تُستورد)', editable: false },
  { key: 'cartId', label: 'Cart ID - do not edit / معرّف العربة', editable: false },
  { key: 'itemId', label: 'Item ID - do not edit / معرّف الصنف', editable: false },
  { key: 'version', label: 'Cart version - do not edit / إصدار العربة', editable: false }
];

const ARABIC_DIGITS = { '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
  '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4', '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9' };

export function westernDigits(value) {
  return String(value == null ? '' : value).replace(/[٠-٩۰-۹]/g, (d) => ARABIC_DIGITS[d]).replace(/[٫]/g, '.').replace(/[،]/g, ',');
}

function clean(value) { return westernDigits(value).replace(/\u200f|\u200e|\u00a0/g, ' ').trim(); }
function isBlank(value) { return value == null || clean(value) === ''; }

export function headerKey(text) {
  return clean(text).split('/')[0].replace(/\(.*?\)/g, '').replace(/-.*$/, '').replace(/\s+/g, ' ').trim().toLowerCase();
}
const HEADER_BY_KEY = new Map(COLUMNS.map((c) => [headerKey(c.label), c.key]));
HEADER_BY_KEY.set('expiry', 'expiry');

function pad(n) { return String(n).padStart(2, '0'); }
function validYmd(y, m, d) {
  if (!(y >= 1990 && y <= 2200) || !(m >= 1 && m <= 12) || !(d >= 1 && d <= 31)) return false;
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}
const ymd = (y, m, d) => y + '-' + pad(m) + '-' + pad(d);

/* A date as Excel hands it back, or as a person typed it.
   Excel date cell        → a serial number (days since 1899-12-30)
   2027-05-01 · 2027/5/1  → year first
   01/05/2027 · 1-5-2027  → DAY first (this is a Saudi workbook) — a month-first
                            reading would silently turn 03/04 into March.
   Anything else is an error, never a guess. */
export function normalizeDate(value) {
  if (isBlank(value)) return { blank: true, ok: true, value: '' };
  if (typeof value === 'number' && Number.isFinite(value)) {
    if (value < 20000 || value > 80000) return { ok: false };
    const t = new Date(Math.round(value) * 86400000 + Date.UTC(1899, 11, 30));
    const y = t.getUTCFullYear(), m = t.getUTCMonth() + 1, d = t.getUTCDate();
    return validYmd(y, m, d) ? { ok: true, value: ymd(y, m, d) } : { ok: false };
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const y = value.getFullYear(), m = value.getMonth() + 1, d = value.getDate();
    return validYmd(y, m, d) ? { ok: true, value: ymd(y, m, d) } : { ok: false };
  }
  const s = clean(value).replace(/T.*$/, '');
  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(s);
  if (m) return validYmd(+m[1], +m[2], +m[3]) ? { ok: true, value: ymd(+m[1], +m[2], +m[3]) } : { ok: false };
  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(s);
  if (m) return validYmd(+m[3], +m[2], +m[1]) ? { ok: true, value: ymd(+m[3], +m[2], +m[1]) } : { ok: false };
  if (/^\d{5}$/.test(s)) return normalizeDate(Number(s));
  return { ok: false };
}

export function normalizeNumber(value) {
  if (isBlank(value)) return { blank: true, ok: true, value: null };
  if (typeof value === 'number') return Number.isFinite(value) ? { ok: true, value } : { ok: false };
  /* A comma is accepted only as a thousands separator (1,000). "1,5" could mean
     one and a half or fifteen, so it is refused rather than guessed. */
  let s = clean(value);
  if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, '');
  if (!/^-?\d+(\.\d+)?$/.test(s)) return { ok: false };
  return { ok: true, value: Number(s) };
}

export function dateToSerial(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
  if (!m) return null;
  return Math.round(Date.UTC(+m[1], +m[2] - 1, +m[3]) / 86400000) + 25569;
}

const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const availableOf = (item) => num(item && (item.present == null ? item.qty : item.present));
const cartVersion = (cart) => String((cart && cart.updatedAt) || '');

function batchesOf(item) {
  return ((item && item.batches) || [])
    .filter((b) => b && (b.expiry || num(b.qty) > 0 || b.lot))
    .map((b) => ({ expiry: String(b.expiry || '').slice(0, 10), qty: num(b.qty), lot: String(b.lot || '') }));
}
const batchKey = (b) => b.expiry + '|' + b.lot + '|' + b.qty;
const sortedBatches = (list) => list.slice().sort((a, b) => (a.expiry + '|' + a.lot).localeCompare(b.expiry + '|' + b.lot) || a.qty - b.qty);
const sameBatches = (a, b) => {
  const x = sortedBatches(a), y = sortedBatches(b);
  return x.length === y.length && x.every((v, i) => batchKey(v) === batchKey(y[i]));
};

/* ----------------------------------------------------------------- export */

/* One row per batch. A medicine with no batch (out of stock) still gets a row,
   so it is visible and can be given stock. Returns an array of arrays: the header
   first. Dates are returned as ISO strings; the caller writes them as real Excel
   date cells. */
export function buildRows(carts, options) {
  const o = options || {};
  const deptName = o.deptName || ((id) => String(id || ''));
  const daysUntil = o.daysUntil || (() => null);
  const rows = [COLUMNS.map((c) => c.label)];
  (Array.isArray(carts) ? carts : []).forEach((cart) => {
    (cart.items || []).forEach((item) => {
      const batches = batchesOf(item);
      const lines = batches.length ? batches : [null];
      lines.forEach((b) => {
        rows.push([
          String(cart.name || cart.number || cart.id || ''),
          String(deptName(cart.deptId) || cart.deptId || ''),
          String(cart.seal || ''),
          String(item.name || item.genericName || ''),
          String(item.strength || item.concentration || ''),
          num(item.qty),
          availableOf(item),
          b ? b.expiry : '',
          b ? b.qty : '',
          b ? b.lot : '',
          b && b.expiry ? daysUntil(b.expiry) : '',
          String(cart.id),
          String(item.id),
          cartVersion(cart)
        ]);
      });
    });
  });
  return rows;
}

/* ----------------------------------------------------------------- import */

function locateColumns(aoa) {
  for (let r = 0; r < Math.min(aoa.length, 15); r += 1) {
    const found = {};
    (aoa[r] || []).forEach((cell, c) => {
      const key = HEADER_BY_KEY.get(headerKey(cell));
      if (key && found[key] === undefined) found[key] = c;
    });
    if (found.cartId !== undefined && found.itemId !== undefined && found.available !== undefined && found.required !== undefined) {
      return { headerRow: r, columns: found };
    }
  }
  return null;
}

function describeBatches(list) {
  if (!list.length) return 'none';
  return sortedBatches(list).map((b) => (b.expiry || '—') + ' × ' + b.qty + (b.lot ? ' (' + b.lot + ')' : '')).join(', ');
}

/* Reads the edited rows and says what would change.
   `aoa` is the sheet as an array of arrays with raw cell values (numbers stay
   numbers, so Excel dates arrive as serials).
   options.currentCarts      the trolleys as they are now
   options.blockedCartIds    carts with an open/pending report (skipped)
   options.overwriteStale    apply even a cart changed after the export
   Returns { ok, errors, changes, skipped, stats, plan }.  Nothing is applied. */
export function readSheet(aoa, options) {
  const o = options || {};
  const carts = Array.isArray(o.currentCarts) ? o.currentCarts : [];
  const blocked = new Set((o.blockedCartIds || []).map(String));
  const errors = [];
  const skipped = [];
  const result = { ok: false, errors, changes: [], skipped, stats: { rows: 0, carts: 0, items: 0, changedItems: 0, changedCarts: 0 }, plan: [] };

  const located = locateColumns(Array.isArray(aoa) ? aoa : []);
  if (!located) {
    errors.push({ row: 0, message: 'This is not a Crash Cart backup file: the header row (Cart ID, Item ID, Required qty, Available qty) was not found. / هذا ليس ملف نسخة احتياطية لعربات الطوارئ.' });
    return result;
  }
  const col = located.columns;
  const cartById = new Map(carts.map((c) => [String(c.id), c]));

  /* group rows by medicine */
  const groups = new Map();
  for (let r = located.headerRow + 1; r < aoa.length; r += 1) {
    const raw = aoa[r] || [];
    const cell = (key) => (col[key] === undefined ? undefined : raw[col[key]]);
    if (raw.every((v) => isBlank(v))) continue;
    const rowNo = r + 1;
    result.stats.rows += 1;
    const cartId = clean(cell('cartId'));
    const itemId = clean(cell('itemId'));
    if (!cartId || !itemId) {
      errors.push({ row: rowNo, message: 'Cart ID or Item ID is empty. For an extra batch, copy a whole row of the same medicine. / معرّف العربة أو الصنف فارغ. لإضافة دفعة انسخ سطر نفس الدواء كاملاً.' });
      continue;
    }
    const cart = cartById.get(cartId);
    if (!cart) { errors.push({ row: rowNo, message: 'Cart "' + cartId + '" does not exist. / العربة غير موجودة.' }); continue; }
    const item = (cart.items || []).find((x) => String(x.id) === itemId);
    if (!item) { errors.push({ row: rowNo, message: 'Medicine "' + itemId + '" is not in cart "' + (cart.name || cartId) + '". / الدواء غير موجود في هذه العربة.' }); continue; }

    const required = normalizeNumber(cell('required'));
    const available = normalizeNumber(cell('available'));
    const expiry = normalizeDate(cell('expiry'));
    const batchQty = normalizeNumber(cell('batchQty'));
    const lot = clean(cell('lot'));
    const label = (cart.name || cartId) + ' / ' + (item.name || itemId);
    let rowOk = true;
    const bad = (message) => { errors.push({ row: rowNo, message: label + ': ' + message }); rowOk = false; };
    if (!required.ok || required.blank || required.value < 0) bad('Required qty must be a number, zero or more. / الكمية المطلوبة يجب أن تكون رقماً صفراً أو أكثر.');
    if (!available.ok || available.blank || available.value < 0) bad('Available qty must be a number, zero or more. / الكمية المتوفرة يجب أن تكون رقماً صفراً أو أكثر.');
    if (!expiry.ok) bad('Expiry date "' + clean(cell('expiry')) + '" is not valid. Use YYYY-MM-DD or DD/MM/YYYY. / تاريخ الانتهاء غير صالح.');
    if (!batchQty.ok || (!batchQty.blank && batchQty.value < 0)) bad('Batch qty must be a number, zero or more. / كمية الدفعة غير صالحة.');
    if (!rowOk) continue;

    const key = cartId + '\u0001' + itemId;
    if (!groups.has(key)) groups.set(key, { cart, item, cartId, itemId, label, required: required.value, available: available.value, version: clean(cell('version')), batches: [], firstRow: rowNo });
    const g = groups.get(key);
    if (g.required !== required.value || g.available !== available.value) {
      errors.push({ row: rowNo, message: label + ': Required/Available qty differs between the rows of the same medicine (first row: ' + g.required + '/' + g.available + '). Make them identical. / الكميات مختلفة بين أسطر نفس الدواء.' });
      continue;
    }
    const hasBatch = !expiry.blank || !batchQty.blank || lot !== '';
    if (hasBatch) g.batches.push({ expiry: expiry.value, qty: batchQty.blank ? 0 : batchQty.value, lot, row: rowNo });
  }

  /* validate every medicine the way the contents editor does */
  const validGroups = [];
  groups.forEach((g) => {
    let ok = true;
    const bad = (message, row) => { errors.push({ row: row || g.firstRow, message: g.label + ': ' + message }); ok = false; };
    if (g.available > g.required) bad('Available qty (' + g.available + ') cannot exceed Required qty (' + g.required + '). / المتوفر لا يتجاوز المطلوب.');
    const seen = new Set();
    g.batches.forEach((b) => {
      const k = b.expiry + '|' + b.lot;
      if (seen.has(k)) bad('Two batch rows have the same expiry date and lot (' + (b.expiry || '—') + '). Merge them. / دفعتان بنفس التاريخ والتشغيلة، ادمجهما.', b.row);
      seen.add(k);
    });
    if (g.available === 0) {
      if (g.batches.length) bad('Available qty is 0 but batch rows are present. Clear the batch rows, or set the available qty. / المتوفر صفر لكن توجد دفعات.');
    } else {
      if (!g.batches.length) bad('Available qty is ' + g.available + ' but there is no batch row with a date. / لا توجد دفعة بتاريخ.');
      g.batches.forEach((b) => {
        if (!b.expiry || !(b.qty > 0)) bad('Every batch needs an expiry date and a quantity above zero. / كل دفعة تحتاج تاريخاً وكمية أكبر من صفر.', b.row);
      });
      const total = g.batches.reduce((s, b) => s + b.qty, 0);
      if (Math.abs(total - g.available) > 0.000001) bad('Batch quantities add up to ' + total + ' but Available qty is ' + g.available + '. / مجموع كميات الدفعات لا يساوي المتوفر.');
    }
    if (ok) validGroups.push(g);
  });

  /* what actually differs */
  const touchedCarts = new Map();
  validGroups.forEach((g) => {
    const before = { required: num(g.item.qty), available: availableOf(g.item), batches: batchesOf(g.item) };
    const after = { required: g.required, available: g.available, batches: g.batches.map((b) => ({ expiry: b.expiry, qty: b.qty, lot: b.lot })) };
    result.stats.items += 1;
    const lines = [];
    if (before.required !== after.required) lines.push('required ' + before.required + ' → ' + after.required);
    if (before.available !== after.available) lines.push('available ' + before.available + ' → ' + after.available);
    if (!sameBatches(before.batches, after.batches)) lines.push('batches ' + describeBatches(before.batches) + ' → ' + describeBatches(after.batches));
    if (!lines.length) return;
    const entry = { cartId: g.cartId, itemId: g.itemId, cart: g.cart.name || g.cartId, medicine: g.item.name || g.itemId, lines, after, version: g.version };
    if (!touchedCarts.has(g.cartId)) touchedCarts.set(g.cartId, { cart: g.cart, entries: [], version: g.version });
    touchedCarts.get(g.cartId).entries.push(entry);
  });

  touchedCarts.forEach((t, cartId) => {
    const name = t.cart.name || cartId;
    if (blocked.has(cartId)) { skipped.push({ cartId, cart: name, reason: 'open-report', message: name + ': has an open or pending report — close it first. / عليها بلاغ مفتوح أو معلّق، أغلقه أولاً.' }); return; }
    if (!o.overwriteStale && t.version !== cartVersion(t.cart)) {
      skipped.push({ cartId, cart: name, reason: 'stale', message: name + ': changed after this file was exported — its rows were NOT applied. / تغيّرت بعد تصدير الملف، لم تُطبَّق تعديلاتها.' });
      return;
    }
    result.plan.push({ cartId, entries: t.entries });
    t.entries.forEach((e) => result.changes.push(e));
  });
  result.stats.carts = new Set(validGroups.map((g) => g.cartId)).size;
  result.stats.changedCarts = result.plan.length;
  result.stats.changedItems = result.changes.length;
  result.ok = errors.length === 0;
  return result;
}

/* Applies a plan to a COPY of the trolleys (the caller passes its own copy). */
export function applyPlan(carts, plan, who, stamp) {
  const byCart = new Map((plan || []).map((p) => [String(p.cartId), p]));
  (carts || []).forEach((cart) => {
    const p = byCart.get(String(cart.id));
    if (!p) return;
    const byItem = new Map(p.entries.map((e) => [String(e.itemId), e]));
    cart.items = (cart.items || []).map((item) => {
      const e = byItem.get(String(item.id));
      if (!e) return item;
      const a = e.after;
      return Object.assign({}, item, {
        qty: a.required,
        present: a.available,
        batches: a.batches.map((b) => ({ expiry: b.expiry, qty: b.qty, lot: b.lot })),
        stockStatus: a.available <= 0 ? 'out_of_stock' : (a.available < a.required ? 'partial' : 'available'),
        stockUpdatedAt: stamp,
        stockUpdatedBy: who.name
      });
    });
    cart.updatedAt = stamp;
    cart.updatedBy = who.name;
    cart.updatedByUser = who.user;
  });
  return carts;
}
