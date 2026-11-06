/* Medical Supplies — the rules, with no screen and no database in them.

   A department keeps its own list of supplies (not medicines) with a name and a
   code, optional batch / expiry / quantity rows, groups, and the cabinets the
   item sits in. Everything the page decides lives here so it can be tested:
   what a valid item is, how close an expiry is, what an Excel file would change,
   and what a printed QR points at.

   It is deliberately independent of the medicine inventory: nothing here reads
   meds_, shelves_ or expiry_. The only thing shared with medicines is the
   department's own expiry alert setting (early / urgent days), which the caller
   passes in, so "near expiry" means the same thing on both pages.

   قواعد مخزون المستلزمات: لا تعتمد على الشاشة ولا قاعدة البيانات. */

import { normalizeDate, normalizeNumber, westernDigits, headerKey } from './crash-cart-excel.js?v=8136b92558';

/* The feature's name, in one place. Renaming it later means changing this line. */
export const FEATURE_LABEL = 'Medical Supplies / المستلزمات الطبية';
export const SCHEMA = 1;
/* One department document carries every item, and a Firestore document stops
   accepting writes at 1 MiB. 1,500 items with a few batches each is well under it;
   the page refuses to go past this rather than fail on a save. */
export const MAX_ITEMS = 1500;
export const REQUIRABLE = Object.freeze(['expiry', 'batch', 'quantity']);
const SEVERITY = Object.freeze({ none: 0, ok: 1, near: 2, urgent: 3, expired: 4 });
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

const text = (value) => String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
export const bi = (en, ar) => `${en} / ${ar}`;
const byName = (a, b) => collator.compare(a.name, b.name) || collator.compare(a.code || '', b.code || '');
export const codeKey = (code) => westernDigits(text(code)).toLowerCase();
const nameKey = (name) => text(name).toLowerCase();

let sequence = 0;
/* Ids become Firestore field names (items.<id>), so they stay [a-z0-9_]. The
   counter keeps two ids made in the same millisecond — an Excel import makes
   hundreds — from colliding. */
export function newId(prefix, random = Math.random, now = Date.now) {
  sequence = (sequence + 1) % 1296;
  return `${prefix}_${now().toString(36)}${sequence.toString(36).padStart(2, '0')}${Math.floor(random() * 1679616).toString(36).padStart(4, '0')}`;
}

export function normalizeBatch(raw) {
  const b = raw && typeof raw === 'object' ? raw : {};
  const qty = b.qty === '' || b.qty == null ? null : Number(b.qty);
  const date = String(b.expiry || '').slice(0, 10);
  return {
    id: text(b.id) || newId('b'),
    batch: text(b.batch).slice(0, 60),
    expiry: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : '',
    qty: Number.isFinite(qty) && qty >= 0 ? qty : null,
  };
}

/* `refs` ({groups:Set, cabinets:Set}) drops a group or cabinet that no longer
   exists, so a deleted cabinet never leaves an item pointing at nothing. */
export function normalizeItem(raw, refs) {
  const i = raw && typeof raw === 'object' ? raw : {};
  const groupId = text(i.groupId);
  const cabinetIds = [...new Set((Array.isArray(i.cabinetIds) ? i.cabinetIds : []).map(text).filter(Boolean))];
  return {
    id: text(i.id),
    name: text(i.name).slice(0, 120),
    code: text(i.code).slice(0, 60),
    groupId: refs && refs.groups && !refs.groups.has(groupId) ? '' : groupId,
    cabinetIds: refs && refs.cabinets ? cabinetIds.filter((id) => refs.cabinets.has(id)) : cabinetIds,
    outOfStock: i.outOfStock === true,
    notes: text(i.notes).slice(0, 300),
    batches: (Array.isArray(i.batches) ? i.batches : []).map(normalizeBatch),
    createdAt: text(i.createdAt),
    updatedAt: text(i.updatedAt),
    updatedBy: text(i.updatedBy),
  };
}

function mapRows(map) {
  const source = map && typeof map === 'object' && !Array.isArray(map) ? map : {};
  return Object.keys(source).map((id) => Object.assign({}, source[id], { id }));
}

/* The stored document (maps keyed by id) as the arrays the page works with. */
export function normalizeDoc(raw, deptId) {
  const d = raw && typeof raw === 'object' ? raw : {};
  const groups = mapRows(d.groups).map((g) => ({ id: g.id, name: text(g.name).slice(0, 60) })).filter((g) => g.name).sort(byName);
  const cabinets = mapRows(d.cabinets)
    .map((c) => ({ id: c.id, name: text(c.name).slice(0, 60), desc: text(c.desc).slice(0, 120) })).filter((c) => c.name).sort(byName);
  const refs = { groups: new Set(groups.map((g) => g.id)), cabinets: new Set(cabinets.map((c) => c.id)) };
  const items = mapRows(d.items).map((i) => normalizeItem(i, refs)).filter((i) => i.name || i.code).sort(byName);
  const required = (d.settings && d.settings.required) || {};
  return {
    deptId: text(deptId || d.deptId),
    settings: { required: { expiry: required.expiry === true, batch: required.batch === true, quantity: required.quantity === true } },
    groups, cabinets, items,
  };
}

/* ------------------------------------------------------------- validation */

/* Which of the department's required fields this item lacks. As soon as any field
   is required the item needs at least one batch row, and every row must carry the
   required fields — a quantity with no batch row to hold it would mean nothing. */
export function missingRequired(item, settings) {
  const req = (settings && settings.required) || {};
  const need = REQUIRABLE.filter((key) => req[key] === true);
  if (!need.length) return [];
  const batches = (item && item.batches) || [];
  if (!batches.length) return need.slice();
  const missing = new Set();
  batches.forEach((b) => {
    if (req.expiry && !b.expiry) missing.add('expiry');
    if (req.batch && !b.batch) missing.add('batch');
    if (req.quantity && b.qty == null) missing.add('quantity');
  });
  return REQUIRABLE.filter((key) => missing.has(key));
}

const FIELD_LABEL = Object.freeze({
  expiry: bi('expiry date', 'تاريخ الانتهاء'),
  batch: bi('batch number', 'رقم الباتش'),
  quantity: bi('quantity', 'الكمية'),
});

/* Checks what the person typed in the item form. Name and code are always
   required; expiry, batch and quantity only when the department made them so.
   `draft.batches[].expiry` and `.qty` are the raw typed strings. Returns the
   normalized item only when there is no error. */
export function validateDraft(draft, settings, others) {
  const d = draft || {};
  const errors = [];
  const name = text(d.name);
  const code = westernDigits(text(d.code));
  if (!name) errors.push({ field: 'name', text: bi('Item name is required.', 'اسم الصنف مطلوب.') });
  if (!code) errors.push({ field: 'code', text: bi('Item code is required.', 'كود الصنف مطلوب.') });
  if (name.length > 120) errors.push({ field: 'name', text: bi('Item name is too long (120 characters).', 'اسم الصنف طويل (120 حرفاً).') });
  if (code.length > 60) errors.push({ field: 'code', text: bi('Item code is too long (60 characters).', 'الكود طويل (60 حرفاً).') });
  if (code) {
    const clash = (others || []).find((o) => o.id !== d.id && codeKey(o.code) === codeKey(code));
    if (clash) errors.push({ field: 'code', text: bi(`This code is already used by "${clash.name}".`, `هذا الكود مستخدم للصنف "${clash.name}".`) });
  }
  const batches = [];
  (Array.isArray(d.batches) ? d.batches : []).forEach((row, index) => {
    const r = row || {};
    if (isBlankText(r.batch) && isBlankText(r.expiry) && isBlankText(r.qty)) return;
    const where = bi(`Batch row ${index + 1}`, `سطر الدفعة ${index + 1}`);
    const date = normalizeDate(r.expiry);
    if (!date.ok) errors.push({ field: 'batches', text: `${where}: ${bi('the expiry date is not valid (use YYYY-MM-DD).', 'تاريخ الانتهاء غير صحيح (سنة-شهر-يوم).')}` });
    const qty = normalizeNumber(r.qty);
    if (!qty.ok || (qty.value != null && (qty.value < 0 || qty.value > 1e9))) errors.push({ field: 'batches', text: `${where}: ${bi('the quantity must be a number, zero or more.', 'الكمية يجب أن تكون رقماً صفراً أو أكثر.')}` });
    batches.push({ id: text(r.id) || newId('b'), batch: text(r.batch), expiry: date.ok ? date.value : '', qty: qty.ok ? qty.value : null });
  });
  const item = normalizeItem({
    id: d.id, name, code, groupId: d.groupId, cabinetIds: d.cabinetIds, outOfStock: d.outOfStock === true,
    notes: d.notes, batches, createdAt: d.createdAt, updatedAt: d.updatedAt, updatedBy: d.updatedBy,
  });
  item.batches = batches;
  missingRequired(item, settings).forEach((key) => errors.push({
    field: key,
    text: bi(`This department requires the ${FIELD_LABEL[key].split(' / ')[0]}.`, `هذا القسم يشترط ${FIELD_LABEL[key].split(' / ')[1]}.`),
  }));
  return { ok: errors.length === 0, errors, item: errors.length ? null : item };
}

function isBlankText(value) { return value == null || text(value) === ''; }

/* ----------------------------------------------------------------- expiry */

/* Whole days from today to a YYYY-MM-DD date, negative once it has passed. Both
   sides are calendar dates, so a clock change never shifts the answer by a day. */
export function daysUntil(iso, today = new Date()) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
  if (!m) return null;
  const target = Date.UTC(+m[1], +m[2] - 1, +m[3]);
  const base = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((target - base) / 86400000);
}

/* The department's alert setting, shared with its medicines: d1 is the early
   alert (days before expiry), d2 the urgent one. d1 is always past d2. */
export function alertConfig(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const d2 = Math.max(1, Number(r.d2) || 7);
  const d1 = Math.max(d2 + 1, Number(r.d1) || 30);
  return { d1, d2 };
}

export function expiryStatus(days, cfg) {
  if (days == null) return 'none';
  const c = cfg || alertConfig();
  if (days < 0) return 'expired';
  if (days <= c.d2) return 'urgent';
  if (days <= c.d1) return 'near';
  return 'ok';
}

export const STATUS_LABEL = Object.freeze({
  expired: bi('Expired', 'منتهي'),
  urgent: bi('Urgent', 'عاجل'),
  near: bi('Near expiry', 'قريب الانتهاء'),
  ok: bi('OK', 'سليم'),
  none: bi('No expiry date', 'بدون تاريخ'),
});

/* An item is as urgent as its worst dated batch. */
export function itemExpiry(item, cfg, today) {
  const batches = ((item && item.batches) || []).map((b) => {
    const days = daysUntil(b.expiry, today);
    return Object.assign({}, b, { days, status: expiryStatus(days, cfg) });
  }).sort((a, b) => (a.expiry || '9999').localeCompare(b.expiry || '9999'));
  let status = 'none';
  let days = null;
  batches.forEach((b) => {
    if (SEVERITY[b.status] > SEVERITY[status]) status = b.status;
    if (b.days != null && (days == null || b.days < days)) days = b.days;
  });
  return { status, days, batches };
}

/* --------------------------------------------------------- filter / counts */

export function filterItems(items, filters, ctx) {
  const f = filters || {};
  const q = westernDigits(text(f.q)).toLowerCase();
  const c = ctx || {};
  return (items || []).filter((item) => {
    if (q) {
      const hay = `${item.name} ${item.code} ${item.batches.map((b) => b.batch).join(' ')}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (f.groupId && f.groupId !== 'all') {
      if (f.groupId === '__none__' ? item.groupId : item.groupId !== f.groupId) return false;
    }
    if (f.cabinetId && f.cabinetId !== 'all') {
      if (f.cabinetId === '__none__' ? item.cabinetIds.length : !item.cabinetIds.includes(f.cabinetId)) return false;
    }
    const status = f.status || 'all';
    if (status === 'all') return true;
    const exp = itemExpiry(item, c.cfg, c.today);
    if (status === 'attention') return SEVERITY[exp.status] >= SEVERITY.near;
    if (status === 'expired' || status === 'urgent' || status === 'near') return exp.status === status;
    if (status === 'noexpiry') return exp.status === 'none';
    if (status === 'out') return item.outOfStock;
    if (status === 'incomplete') return missingRequired(item, c.settings).length > 0;
    return true;
  });
}

export function summarize(items, ctx) {
  const c = ctx || {};
  const out = { total: 0, expired: 0, urgent: 0, near: 0, noExpiry: 0, out: 0, incomplete: 0, unassigned: 0 };
  (items || []).forEach((item) => {
    out.total += 1;
    const exp = itemExpiry(item, c.cfg, c.today);
    if (exp.status === 'expired') out.expired += 1;
    else if (exp.status === 'urgent') out.urgent += 1;
    else if (exp.status === 'near') out.near += 1;
    else if (exp.status === 'none') out.noExpiry += 1;
    if (item.outOfStock) out.out += 1;
    if (missingRequired(item, c.settings).length) out.incomplete += 1;
    if (!item.cabinetIds.length) out.unassigned += 1;
  });
  return out;
}

/* --------------------------------------------------------- cabinet changes */

/* "move" puts the item in that one cabinet; "add" keeps the others, the same two
   choices the medicine drawers offer; "__none__" takes it out of every cabinet. */
export function assignCabinet(item, targetId, mode) {
  const current = item.cabinetIds || [];
  if (targetId === '__none__') return [];
  if (mode === 'add') return [...new Set(current.concat(targetId))];
  return [targetId];
}

/* ------------------------------------------------------------ print layout */

/* Sections of the printed list. An item in two cabinets is printed under both —
   the sheet is read at the cabinet, so it has to be on each cabinet's list. */
export function printSections(items, cabinets, groups, options) {
  const o = options || {};
  const list = items || [];
  const sections = [];
  if (o.by === 'group') {
    (groups || []).forEach((g) => sections.push({ id: g.id, title: g.name, desc: '', items: list.filter((i) => i.groupId === g.id) }));
    sections.push({ id: '__none__', title: bi('No group', 'بدون مجموعة'), desc: '', items: list.filter((i) => !i.groupId) });
  } else {
    (cabinets || []).forEach((c) => sections.push({ id: c.id, title: c.name, desc: c.desc, items: list.filter((i) => i.cabinetIds.includes(c.id)) }));
    sections.push({ id: '__none__', title: bi('Not in a cabinet', 'غير معيّن لدولاب'), desc: '', items: list.filter((i) => !i.cabinetIds.length) });
  }
  return sections.filter((s) => s.items.length && (!o.only || o.only === s.id));
}

/* ------------------------------------------------------------------- Excel */

export const SHEET_NAME = 'Medical Supplies';
export const INFO_SHEET_NAME = 'Info';
export const FORMAT = 'floorstock-medical-supplies-v1';

/* Only the first three columns are read back. The rest are there to read in Excel
   and are ignored on import, so a re-imported export can never overwrite a
   quantity, a cabinet or a group. */
export const COLUMNS = Object.freeze([
  { key: 'name', label: 'Name / الاسم', imported: true },
  { key: 'code', label: 'Code / الكود', imported: true },
  { key: 'expiry', label: 'Expiry (YYYY-MM-DD) / تاريخ الانتهاء', imported: true },
  { key: 'group', label: 'Group (not imported) / المجموعة (لا تُستورد)', imported: false },
  { key: 'cabinets', label: 'Cabinets (not imported) / الدواليب (لا تُستورد)', imported: false },
  { key: 'batch', label: 'Batch (not imported) / الباتش (لا يُستورد)', imported: false },
  { key: 'quantity', label: 'Quantity (not imported) / الكمية (لا تُستورد)', imported: false },
  { key: 'daysLeft', label: 'Days left (not imported) / الأيام المتبقية (لا تُستورد)', imported: false },
  { key: 'outOfStock', label: 'Out of stock (not imported) / نفد (لا يُستورد)', imported: false },
]);

const ALIASES = Object.freeze({
  name: ['name', 'item', 'item name', 'الاسم', 'اسم الصنف', 'الصنف', 'اسم المادة', 'المادة'],
  code: ['code', 'item code', 'sku', 'الكود', 'كود', 'رمز', 'الرمز', 'كود الصنف'],
  expiry: ['expiry', 'expiry date', 'exp', 'exp date', 'expiration', 'تاريخ الانتهاء', 'الانتهاء', 'تاريخ الصلاحية', 'الصلاحية'],
});

function columnFor(cell) {
  const key = headerKey(cell);
  return Object.keys(ALIASES).find((name) => ALIASES[name].includes(key)) || '';
}

/* One row per batch; an item with none still gets a row so it shows up. Dates are
   ISO strings here — the caller writes them as real Excel date cells. */
export function buildRows(items, options) {
  const o = options || {};
  const groupName = o.groupName || ((id) => id);
  const cabinetName = o.cabinetName || ((id) => id);
  const rows = [COLUMNS.map((c) => c.label)];
  (items || []).forEach((item) => {
    const batches = item.batches.length ? item.batches : [null];
    batches.forEach((b) => {
      const days = b && b.expiry && o.daysUntil ? o.daysUntil(b.expiry) : null;
      rows.push([
        item.name, item.code, b ? b.expiry : '',
        item.groupId ? groupName(item.groupId) : '',
        item.cabinetIds.map(cabinetName).join(', '),
        b ? b.batch : '', b && b.qty != null ? b.qty : '',
        days == null ? '' : days,
        item.outOfStock ? 'Yes' : '',
      ]);
    });
  });
  return rows;
}

function cellText(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return westernDigits(text(value));
}

/* Reads the sheet and says what it WOULD change; nothing is written here.
   Rows are matched to existing items by code. An existing item can be renamed and
   gain expiry dates — nothing is ever removed, and quantities, batches, groups and
   cabinets are not touched. Any bad row blocks the whole import. */
export function readSheet(aoa, options) {
  const o = options || {};
  const rows = Array.isArray(aoa) ? aoa : [];
  const errors = [];
  const stats = { rows: 0, added: 0, updated: 0, unchanged: 0, expiries: 0 };
  let headerAt = -1;
  let cols = {};
  for (let r = 0; r < Math.min(rows.length, 5) && headerAt < 0; r += 1) {
    const found = {};
    (rows[r] || []).forEach((cell, c) => {
      const key = columnFor(cell);
      if (key && found[key] === undefined) found[key] = c;
    });
    if (found.name !== undefined && found.code !== undefined) { headerAt = r; cols = found; }
  }
  if (headerAt < 0) {
    errors.push({ row: 1, text: bi('The file needs a "Name" column and a "Code" column.', 'يجب أن يحتوي الملف على عمود "الاسم" وعمود "الكود".') });
    return { ok: false, errors, plan: null, stats };
  }

  const byCode = new Map();
  for (let r = headerAt + 1; r < rows.length; r += 1) {
    const row = rows[r] || [];
    const name = text(row[cols.name]);
    const code = cellText(row[cols.code]);
    const rawExpiry = cols.expiry === undefined ? '' : row[cols.expiry];
    if (!name && !code && isBlankText(rawExpiry)) continue;
    stats.rows += 1;
    const at = bi(`Row ${r + 1}`, `السطر ${r + 1}`);
    if (!name) errors.push({ row: r + 1, text: `${at}: ${bi('the name is missing.', 'الاسم ناقص.')}` });
    if (!code) errors.push({ row: r + 1, text: `${at}: ${bi('the code is missing.', 'الكود ناقص.')}` });
    const date = normalizeDate(rawExpiry);
    if (!date.ok) errors.push({ row: r + 1, text: `${at}: ${bi('the expiry date is not valid (use YYYY-MM-DD or DD/MM/YYYY).', 'تاريخ الانتهاء غير صحيح (سنة-شهر-يوم أو يوم/شهر/سنة).')}` });
    if (!name || !code) continue;
    const key = codeKey(code);
    let entry = byCode.get(key);
    if (!entry) {
      entry = { name, code, expiries: new Set() };
      byCode.set(key, entry);
    } else if (nameKey(entry.name) !== nameKey(name)) {
      errors.push({ row: r + 1, text: `${at}: ${bi(`the code "${code}" appears with two different names.`, `الكود "${code}" مكرر باسمين مختلفين.`)}` });
    }
    if (date.ok && date.value) entry.expiries.add(date.value);
  }

  const current = new Map();
  (o.currentItems || []).forEach((item) => current.set(codeKey(item.code), item));
  const plan = { add: [], update: [] };
  byCode.forEach((entry, key) => {
    const expiries = [...entry.expiries].sort();
    const item = current.get(key);
    if (!item) {
      plan.add.push({ name: entry.name, code: entry.code, expiries });
      stats.added += 1;
      stats.expiries += expiries.length;
      return;
    }
    const newName = nameKey(item.name) !== nameKey(entry.name) ? entry.name : '';
    const have = new Set(item.batches.map((b) => b.expiry).filter(Boolean));
    const emptySlots = item.batches.filter((b) => !b.expiry).map((b) => b.id);
    const fill = [];
    const append = [];
    expiries.forEach((expiry) => {
      if (have.has(expiry)) return;
      if (emptySlots.length) fill.push({ batchId: emptySlots.shift(), expiry });
      else append.push(expiry);
    });
    if (!newName && !fill.length && !append.length) { stats.unchanged += 1; return; }
    plan.update.push({ id: item.id, code: item.code, oldName: item.name, newName, fill, append });
    stats.updated += 1;
    stats.expiries += fill.length + append.length;
  });
  const limit = o.maxItems || MAX_ITEMS;
  if (current.size + plan.add.length > limit) {
    errors.push({ row: 0, text: bi(`This would take the list past ${limit} items.`, `سيتجاوز هذا الاستيراد ${limit} صنفاً.`) });
  }
  return { ok: errors.length === 0, errors, plan, stats };
}

/* The full records to write for a plan that passed readSheet. */
export function applyImport(items, plan, ctx) {
  const c = ctx || {};
  const stamp = c.now || new Date().toISOString();
  const by = c.by || '';
  const byId = new Map((items || []).map((i) => [i.id, i]));
  const out = [];
  plan.add.forEach((a) => out.push(normalizeItem({
    id: newId('i'), name: a.name, code: a.code, createdAt: stamp, updatedAt: stamp, updatedBy: by,
    batches: a.expiries.map((expiry) => ({ id: newId('b'), expiry })),
  })));
  plan.update.forEach((u) => {
    const base = byId.get(u.id);
    if (!base) return;
    const next = JSON.parse(JSON.stringify(base));
    if (u.newName) next.name = u.newName;
    u.fill.forEach((f) => {
      const batch = next.batches.find((b) => b.id === f.batchId);
      if (batch) batch.expiry = f.expiry;
    });
    u.append.forEach((expiry) => next.batches.push({ id: newId('b'), batch: '', expiry, qty: null }));
    next.updatedAt = stamp;
    next.updatedBy = by;
    out.push(next);
  });
  return out;
}
