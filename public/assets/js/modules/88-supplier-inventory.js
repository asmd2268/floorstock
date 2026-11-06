/* Supplier Inventory — a department's own list of supplies (not medicines).
   Visible and editable only by that department and the Master; the Firestore
   rules enforce it, this page just does not offer what the rules would refuse.
   Rules live in core/supplier-inventory-model.js, storage in ...-store.js,
   markup in ...-views.js, printing in ...-print.js, Excel in ...-excel.js. */
import { installActions } from '../core/delegated-actions.js?v=078b8d25e6';
import { openBlobPrint } from '../core/print-window.js?v=dafb959d71';
import {
  FEATURE_LABEL, MAX_ITEMS, bi, newId, normalizeDoc, validateDraft, alertConfig, daysUntil, filterItems, summarize,
  assignCabinet, printSections, applyImport,
} from '../core/supplier-inventory-model.js?v=66a68fd8e9';
import * as store from '../core/supplier-inventory-store.js?v=525482128d';
import * as V from '../core/supplier-inventory-views.js?v=594f5a15e5';
import { listHtml, qrSheetHtml, PRINT_CSS } from '../core/supplier-inventory-print.js?v=0ff618327c';
import { buildWorkbook, readWorkbookFile } from '../core/supplier-inventory-excel.js?v=ad968b5477';

const PAGE = 'pg-supplier-inv';
const BRAND = '<div style="text-align:center;font-size:8.5pt;color:#555;margin-top:14px">By Ali Abudahash</div>';
const st = {
  deptId: '', doc: normalizeDoc(null, ''), conn: 'loading', unsub: null, selected: new Set(),
  filters: { q: '', groupId: '', cabinetId: '', status: 'all' }, plan: null,
};

const toast = (m, k) => { if (typeof window.toast === 'function') window.toast(m, k || 'info'); };
const user = () => window.CU || {};
const isMaster = () => typeof window.isMasterActual === 'function' && window.isMasterActual();
const depts = () => (typeof window.gd === 'function' ? window.gd() || [] : []).map((d) => ({ id: String(d.id), name: String(d.name || d.nameEn || d.id) }));
const deptName = (id) => (depts().find((d) => d.id === id) || {}).name || id;
const canUse = (id) => !!id && (isMaster() || (user().role === 'department' && String(user().deptId) === String(id)));
const cfg = () => alertConfig(window.S && window.S.g && window.S.g(`alerts_${st.deptId}`));
const ctx = () => ({ cfg: cfg(), settings: st.doc.settings, today: new Date() });
const el = (id) => document.getElementById(id);
const clone = (x) => JSON.parse(JSON.stringify(x));
const nameOf = (list) => (id) => (list.find((r) => r.id === id) || {}).name || '';

/* ------------------------------------------------------------- data flow */
function connect(deptId) {
  if (st.unsub) { st.unsub(); st.unsub = null; }
  st.deptId = deptId; st.selected.clear(); st.conn = 'loading'; st.doc = normalizeDoc(null, deptId);
  render();
  if (!canUse(deptId) || !window.FB_DB) { st.conn = 'error'; render(); return; }
  st.unsub = store.subscribe({
    db: window.FB_DB, profile: user(), deptId,
    onDoc: (raw) => { st.doc = normalizeDoc(raw, deptId); render(); },
    onState: (s) => { st.conn = s; render(); },
  });
}

async function mutate(change) {
  const prev = st.doc;
  const next = clone(prev);
  const error = change(next);
  if (error) { toast(error, 'err'); return false; }
  try {
    await store.commit({ db: window.FB_DB, profile: user(), deptId: st.deptId, fieldValue: window.firebase.firestore.FieldValue, prev, next });
    publish(next);
    return true;
  } catch (e) {
    console.error('Supplier inventory save failed', e);
    toast(`${bi('Could not save', 'تعذر الحفظ')}: ${e.code || e.message || e}`, 'err');
    return false;
  }
}
async function publish(doc) {
  try {
    await store.publicRef(window.FB_DB, user(), st.deptId).set(store.buildPublicSnapshot(doc, { deptName: deptName(st.deptId), cfg: cfg() }));
    return true;
  } catch (e) { console.warn('Supplier inventory public mirror failed', e); return false; }
}
const stamp = (item) => { item.updatedAt = new Date().toISOString(); item.updatedBy = String(user().name || user().username || ''); };

/* ---------------------------------------------------------------- render */
function render() {
  const page = el(PAGE);
  if (!page || !page.classList.contains('on')) return;
  const c = ctx();
  const items = filterItems(st.doc.items, st.filters, c);
  const focus = document.activeElement && document.activeElement.dataset && document.activeElement.dataset.sinp;
  const caret = focus ? document.activeElement.selectionStart : 0;
  const rowCtx = { cfg: c.cfg, today: c.today, settings: c.settings, selected: st.selected, groupName: nameOf(st.doc.groups), cabinetName: nameOf(st.doc.cabinets) };
  page.innerHTML = V.pageHtml({
    filters: st.filters, summary: summarize(st.doc.items, c), conn: st.conn, isMaster: isMaster(), depts: depts(), deptId: st.deptId,
    deptName: deptName(st.deptId), groups: st.doc.groups, cabinets: st.doc.cabinets, selected: st.selected, items, total: st.doc.items.length,
    rows: items.map((i) => V.rowHtml(i, rowCtx)).join(''),
  });
  if (focus) { const input = page.querySelector('[data-sinp="q"]'); if (input) { input.focus(); input.setSelectionRange(caret, caret); } }
}

/* ---------------------------------------------------------------- modals */
function modal(title, body, buttons) {
  closeModal();
  const bg = document.createElement('div');
  bg.className = 'modal-bg on'; bg.id = 'si-modal';
  bg.innerHTML = `<div class="modal" style="max-width:680px;max-height:90vh;overflow:auto"><div class="mh"><div class="mt">${title}</div><button type="button" class="xbtn" data-sact="close">✕</button></div><div class="mb">${body}</div><div class="mf" style="display:flex;gap:8px;justify-content:flex-end;padding:10px;flex-wrap:wrap">${buttons || ''}</div></div>`;
  document.body.appendChild(bg);
}
function closeModal() { const m = el('si-modal'); if (m) m.remove(); }
const footer = (act, label) => `<button type="button" class="btn bg" data-sact="close">${bi('Cancel', 'إلغاء')}</button><button type="button" class="btn bp" data-sact="${act}">${label}</button>`;

let draft = null;
function readForm() {
  const root = el('si-form');
  const f = (k) => root.querySelector(`[data-f="${k}"]`);
  draft = {
    id: draft.id, name: f('name').value, code: f('code').value, groupId: f('groupId').value, notes: f('notes').value, outOfStock: f('outOfStock').checked,
    cabinetIds: [...root.querySelectorAll('[data-cab]')].filter((x) => x.checked).map((x) => x.dataset.cab),
    batches: [...root.querySelectorAll('.si-batch')].map((r) => ({ id: r.dataset.bid, batch: r.querySelector('[data-f="batch"]').value, expiry: r.querySelector('[data-f="expiry"]').value, qty: r.querySelector('[data-f="qty"]').value })),
    createdAt: draft.createdAt,
  };
}
function openItem(item) {
  draft = item ? clone(item) : { id: '', name: '', code: '', groupId: '', cabinetIds: [], notes: '', outOfStock: false, batches: [], createdAt: '' };
  modal(item ? bi('Edit item', 'تعديل صنف') : bi('Add item', 'إضافة صنف'), V.itemFormHtml(draft, st.doc), footer('save-item', bi('Save', 'حفظ')));
}
async function saveItem() {
  readForm();
  const others = st.doc.items.filter((i) => i.id !== draft.id);
  const result = validateDraft(draft, st.doc.settings, others);
  if (!result.ok) { el('si-errors').innerHTML = result.errors.map((e) => `• ${V.esc(e.text)}`).join('<br>'); return; }
  if (!draft.id && st.doc.items.length >= MAX_ITEMS) { el('si-errors').textContent = `${bi('Item limit reached', 'تم بلوغ الحد الأقصى')} (${MAX_ITEMS})`; return; }
  const saved = result.item;
  const ok = await mutate((next) => {
    const refs = { groups: new Set(next.groups.map((g) => g.id)), cabinets: new Set(next.cabinets.map((c) => c.id)) };
    saved.id = draft.id || newId('i');
    saved.createdAt = draft.createdAt || new Date().toISOString();
    if (!refs.groups.has(saved.groupId)) saved.groupId = '';
    saved.cabinetIds = saved.cabinetIds.filter((id) => refs.cabinets.has(id));
    stamp(saved);
    const at = next.items.findIndex((i) => i.id === saved.id);
    if (at >= 0) next.items[at] = saved; else next.items.push(saved);
  });
  if (ok) closeModal();
}

function openNames(kind) {
  const rows = clone(kind === 'group' ? st.doc.groups : st.doc.cabinets);
  modal(kind === 'group' ? bi('Groups', 'المجموعات') : bi('Cabinets', 'الدواليب'), V.nameListHtml(kind, rows, kind === 'cabinet'), footer(`save-${kind}`, bi('Save', 'حفظ')));
  el('si-modal').dataset.kind = kind;
}
async function saveNames(kind) {
  const rows = [...document.querySelectorAll('#si-names [data-rid]')].map((r) => ({
    id: r.dataset.rid, name: r.querySelector('[data-f="name"]').value.trim(), desc: (r.querySelector('[data-f="desc"]') || { value: '' }).value.trim(),
  })).filter((r) => r.name);
  const names = rows.map((r) => r.name.toLowerCase());
  if (new Set(names).size !== names.length) { toast(bi('Names must be different.', 'الأسماء يجب أن تكون مختلفة.'), 'err'); return; }
  const ok = await mutate((next) => {
    const list = kind === 'group' ? 'groups' : 'cabinets';
    next[list] = rows.map((r) => (kind === 'group' ? { id: r.id, name: r.name } : r));
    const live = new Set(rows.map((r) => r.id));
    next.items.forEach((i) => {
      if (kind === 'group' && i.groupId && !live.has(i.groupId)) { i.groupId = ''; stamp(i); }
      if (kind === 'cabinet' && i.cabinetIds.some((id) => !live.has(id))) { i.cabinetIds = i.cabinetIds.filter((id) => live.has(id)); stamp(i); }
    });
  });
  if (ok) closeModal();
}

async function saveSettings() {
  const required = {};
  document.querySelectorAll('[data-req]').forEach((x) => { required[x.dataset.req] = x.checked; });
  if (await mutate((next) => { next.settings = { required }; })) closeModal();
}

/* ---------------------------------------------------------------- Excel */
async function exportExcel() {
  try {
    await window.ensureXLSX();
    const built = buildWorkbook(window.XLSX, st.doc.items, {
      deptName: deptName(st.deptId), groupName: nameOf(st.doc.groups), cabinetName: nameOf(st.doc.cabinets), daysUntil: (iso) => daysUntil(iso, new Date()),
    });
    window.XLSX.writeFile(built.wb, `MedicalSupplies_${deptName(st.deptId).replace(/[^\w؀-ۿ]+/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast(`${built.rows} ${bi('rows exported', 'سطر تم تصديره')}`, 'ok');
  } catch (e) { console.error(e); toast(bi('Export failed', 'فشل التصدير'), 'err'); }
}
async function onFile(input) {
  const file = input.files && input.files[0];
  input.value = '';
  if (!file) return;
  try {
    await window.ensureXLSX();
    const read = await readWorkbookFile(window.XLSX, file, st.doc.items, MAX_ITEMS);
    st.plan = read.ok ? read.plan : null;
    const changes = read.ok ? read.plan.add.length + read.plan.update.length : 0;
    modal(bi('Import preview', 'معاينة الاستيراد'), V.importPreviewHtml(read, file.name), read.ok && changes
      ? footer('apply-import', `${bi('Apply', 'تطبيق')} (${changes})` ) : `<button type="button" class="btn bg" data-sact="close">${bi('Close', 'إغلاق')}</button>`);
  } catch (e) { console.error(e); toast(bi('The file could not be read.', 'تعذرت قراءة الملف.'), 'err'); }
}
async function applyPlan() {
  const plan = st.plan;
  if (!plan) return;
  const ok = await mutate((next) => {
    const written = applyImport(next.items, plan, { by: String(user().name || '') });
    written.forEach((item) => {
      const refs = { groups: new Set(next.groups.map((g) => g.id)), cabinets: new Set(next.cabinets.map((c) => c.id)) };
      item.groupId = refs.groups.has(item.groupId) ? item.groupId : '';
      const at = next.items.findIndex((i) => i.id === item.id);
      if (at >= 0) next.items[at] = item; else next.items.push(item);
    });
  });
  if (ok) { st.plan = null; closeModal(); toast(bi('Import applied', 'تم تطبيق الاستيراد'), 'ok'); }
}

/* ------------------------------------------------------------- printing */
function printMenu(kind) {
  if (kind === 'qr') { modal(bi('QR codes', 'رموز QR'), `<p class="ssub">${bi('One QR for the whole list and one per cabinet. Scanning opens the live list with no sign-in.', 'رمز للقائمة كاملة ورمز لكل دولاب. السكان يفتح القائمة مباشرة بدون تسجيل دخول.')}</p>`, footer('do-print-qr', bi('Print', 'طباعة'))); return; }
  modal(bi('Print list', 'طباعة القائمة'),
    `<label>${bi('Scope', 'النطاق')}</label><select id="si-p-only" style="width:100%"><option value="">${bi('Everything', 'الكل')}</option>${st.doc.cabinets.map((c) => `<option value="${V.esc(c.id)}">${V.esc(c.name)}</option>`).join('')}</select>`
    + (`<label>${bi('Arrange by', 'الترتيب حسب')}</label><select id="si-p-by" style="width:100%"><option value="cabinet">${bi('Cabinet', 'الدولاب')}</option><option value="group">${bi('Group', 'المجموعة')}</option></select>`
      + `<label style="display:block;margin-top:8px"><input type="checkbox" id="si-p-exp" checked> ${bi('Include batch, quantity and expiry', 'تضمين الباتش والكمية والانتهاء')}</label><div class="ssub">${bi('Untick to print names and codes only; expiry is then tracked by the QR codes.', 'ألغِ التحديد لطباعة الأسماء والأكواد فقط، ويكون التتبع عبر رموز QR.')}</div>`),
    footer(`do-print-${kind}`, bi('Print', 'طباعة')));
}
async function doPrint(kind) {
  const header = typeof window.officialPrintHeaderHTML === 'function' ? window.officialPrintHeaderHTML() : '';
  const title = `<h1 style="font-size:15pt;margin:6px 0">${V.esc(FEATURE_LABEL)} — ${V.esc(deptName(st.deptId))}</h1><div class="sub">${new Date().toLocaleDateString('en-GB')}</div>`;
  let body;
  if (kind === 'list') {
    const c = ctx();
    const sections = printSections(st.doc.items, st.doc.cabinets, st.doc.groups, { by: el('si-p-by').value, only: el('si-p-only').value });
    body = listHtml({ sections, withExpiry: el('si-p-exp').checked, cfg: c.cfg, today: c.today, groupName: nameOf(st.doc.groups) });
  } else {
    if (typeof window.makeReadableQR !== 'function') { toast('QR generator unavailable', 'err'); return; }
    if (!(await publish(st.doc))) { toast(bi('Could not publish the live list; the QR may show old data.', 'تعذر نشر القائمة الحية؛ قد يعرض الرمز بيانات قديمة.'), 'err'); }
    const base = { deptId: st.deptId, tenantId: String(user().tenantId || '') };
    const targets = [{ title: bi('Whole list', 'القائمة كاملة'), sub: deptName(st.deptId), url: store.publicUrl(location.origin, base) }]
      .concat(st.doc.cabinets.map((c) => ({ title: c.name, sub: deptName(st.deptId), url: store.publicUrl(location.origin, Object.assign({ cabinetId: c.id }, base)) })));
    body = qrSheetHtml({ targets, qrFor: window.makeReadableQR });
  }
  openBlobPrint(`<!doctype html><html><head><meta charset="utf-8"><title>${V.esc(FEATURE_LABEL)}</title><style>@page{size:A4;margin:10mm}body{font-family:Arial,Tahoma,sans-serif;margin:0;color:#111}${PRINT_CSS}</style></head><body>${header}${title}${body}${BRAND}</body></html>`);
  closeModal();
}

/* --------------------------------------------------------------- actions */
const byId = (el0) => st.doc.items.find((i) => i.id === el0.dataset.id);
const bulk = async (fn) => {
  const ids = new Set(st.selected);
  if (await mutate((next) => { next.items.forEach((i) => { if (ids.has(i.id)) { fn(i); stamp(i); } }); })) { st.selected.clear(); render(); }
};
installActions(document.body, {
  close: closeModal,
  add: () => openItem(null),
  edit: (b) => { const i = byId(b); if (i) openItem(i); },
  'save-item': saveItem,
  del: async (b) => {
    const i = byId(b);
    if (i && window.confirm(`${bi('Delete', 'حذف')} "${i.name}"?`)) await mutate((next) => { next.items = next.items.filter((x) => x.id !== i.id); });
  },
  'add-batch': () => { readForm(); draft.batches.push({ id: newId('b'), batch: '', expiry: '', qty: '' }); el('si-batches').innerHTML = draft.batches.map(V.batchRowHtml).join(''); },
  'rm-batch': (b) => { readForm(); draft.batches = draft.batches.filter((x) => x.id !== b.dataset.bid); el('si-batches').innerHTML = draft.batches.map(V.batchRowHtml).join(''); },
  groups: () => openNames('group'),
  cabinets: () => openNames('cabinet'),
  'add-name': () => {
    const box = el('si-names'); const kind = el('si-modal').dataset.kind;
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:6px;margin-bottom:6px'; row.dataset.rid = newId(kind === 'group' ? 'g' : 'c');
    row.innerHTML = `<input data-f="name" maxlength="60" style="flex:1">${kind === 'cabinet' ? `<input data-f="desc" maxlength="120" style="flex:1">` : ''}<button type="button" class="btn bg bsm" data-sact="rm-name" data-rid="${row.dataset.rid}">🗑</button>`;
    box.appendChild(row);
  },
  'rm-name': (b) => { const row = document.querySelector(`#si-names [data-rid="${b.dataset.rid}"]`); if (row) row.remove(); },
  'save-group': () => saveNames('group'),
  'save-cabinet': () => saveNames('cabinet'),
  settings: () => modal(bi('Required fields', 'الحقول الإلزامية'), V.settingsHtml(st.doc.settings), footer('save-settings', bi('Save', 'حفظ'))),
  'save-settings': saveSettings,
  export: exportExcel,
  import: () => el('si-file').click(),
  'apply-import': applyPlan,
  print: () => printMenu('list'),
  labels: () => printMenu('qr'),
  'do-print-list': () => doPrint('list'),
  'do-print-qr': () => doPrint('qr'),
  status: (b) => { st.filters.status = b.dataset.status; render(); },
  'bulk-add': () => { const t = el('si-bulk-target').value; if (t) bulk((i) => { i.cabinetIds = assignCabinet(i, t, 'add'); }); },
  'bulk-move': () => { const t = el('si-bulk-target').value; if (t) bulk((i) => { i.cabinetIds = assignCabinet(i, t, 'move'); }); },
  'bulk-group': () => { const g = el('si-bulk-group').value; bulk((i) => { i.groupId = g; }); },
  'bulk-clear': () => { st.selected.clear(); render(); },
}, { attribute: 'sact' });
installActions(document.body, {
  pick: (b) => { if (b.checked) st.selected.add(b.dataset.id); else st.selected.delete(b.dataset.id); render(); },
  dept: (s) => connect(s.value),
  group: (s) => { st.filters.groupId = s.value; render(); },
  cabinet: (s) => { st.filters.cabinetId = s.value; render(); },
  file: onFile,
}, { event: 'change', attribute: 'schg' });
installActions(document.body, { q: (i) => { st.filters.q = i.value; render(); } }, { event: 'input', attribute: 'sinp' });

/* ------------------------------------------------------------ nav & page */
function open() {
  const page = el(PAGE);
  if (!page) return;
  const own = String(user().deptId || '');
  const target = st.deptId || (canUse(own) ? own : (depts()[0] || {}).id || '');
  if (target !== st.deptId || !st.unsub) connect(target); else render();
}
function addNavButton() {
  const nav = el('mnav');
  if (!nav || nav.querySelector(`[data-pg="${PAGE}"]`)) return;
  const role = typeof window.fsEffectiveRole === 'function' ? window.fsEffectiveRole() : user().role;
  if (role !== 'department' && !isMaster()) return;
  if (typeof window.plIsHiddenForCurrentRole === 'function' && window.plIsHiddenForCurrentRole(PAGE) && !isMaster()) return;
  const b = document.createElement('button');
  b.className = 'nb'; b.dataset.pg = PAGE; b.innerHTML = `📦 ${V.esc(FEATURE_LABEL)}`;
  b.onclick = () => window.showPg(PAGE);
  const shelves = nav.querySelector('[data-pg="pg-shelves"]');
  if (shelves && shelves.nextSibling) nav.insertBefore(b, shelves.nextSibling); else nav.appendChild(b);
}
window.__buildNavAfterExtensions = window.__buildNavAfterExtensions || [];
window.__buildNavAfterExtensions.push(addNavButton);
window.__showPgAfterExtensions = window.__showPgAfterExtensions || [];
window.__showPgAfterExtensions.push((id) => { if (id === PAGE) open(); });
window.__showPgGuards = window.__showPgGuards || [];
window.__showPgGuards.push((id) => id !== PAGE || isMaster() || user().role === 'department');
export {};
