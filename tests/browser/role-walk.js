/* The one harness that walks this application as each role.

   Two specs ask different questions of the same walk — button-permissions.spec.js
   asks which controls answer "no permission", button-errors.spec.js asks which
   throw — and a second copy of the role list or the seeded state is how the two
   drift until one of them is quietly testing a world the other does not have. */

import { expect } from '@playwright/test';

/* `offsetParent` is null for anything position:fixed — which every dialog in
   this application is — so a visibility test built on it silently skips every
   control inside a dialog. Measured instead. */
const VISIBLE = `(node) => {
  const style = getComputedStyle(node);
  if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
  const rect = node.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}`;

/* Two states of the same world: what is still open, and what has already been
   closed. Different rows carry different buttons — "answer this report" only
   exists while a report is open, "reopen" only after it is closed. */
/* Two states of the same world: what is still open, and what has already been
   closed. Different rows carry different buttons — "answer this report" only
   exists while a report is open, "reopen" only after it is closed. */
const STATES = ['open', 'closed'];

const ROLES = [
  { role: 'department', deptId: 'dept-a', deptName: 'Ward A' },
  { role: 'pharmacy' },
  { role: 'pharmacy_staff' },
  { role: 'inpatient_supervisor' },
  { role: 'outpatient_pharmacy_supervisor', deptId: 'dept-a' },
  { role: 'controlled_pharmacy' },
  { role: 'warehouse' },
  { role: 'master', master: true },
];

async function prepare(page, profile, state = 'open') {
  await page.goto('/');
  await expect.poll(async () => page.locator('html').getAttribute('data-asdh-modules')).toBe('ready');
  await page.evaluate(({ who, visibleSource, state }) => {
    window.__auditVisible = visibleSource;
    window.__refusals = [];
    window.__toasts = [];
    const record = (message, kind) => {
      window.__toasts.push({ message: String(message == null ? '' : message), kind: String(kind || '') });
    };
    window.toast = record;
    window.toast2 = record;
    /* Nothing may be written or navigated away from while we press things. */
    window.uiConfirm = async () => false;
    window.confirm = () => false;
    window.prompt = () => null;
    window.open = () => null;
    window.print = () => {};
    if (window.S) {
      window.S.s = async () => {};
      window.S.upd = async () => {};
      window.S.rm = async () => {};
    }
    window.fsCallFunction = async () => ({});

    window.CU = Object.assign({ username: 'audit', name: 'Audit', email: 'audit@test', active: true }, who);
    window.MASTER_ACTUAL = who.master ? window.CU : null;
    window.MASTER_EFFECTIVE = null;

    /* Screens with nothing on them have no row buttons, and row buttons are
       where the interesting refusals live — "answer this report", "edit this
       custody", "print this list". One plausible record per screen. */
    const today = new Date().toISOString();
    const day = today.slice(0, 10);
    Object.assign(window.S.cache, {
      departments: [{ id: 'dept-a', name: 'Ward A' }, { id: 'dept-b', name: 'Ward B' }],
      'meds_dept-a': [{ id: 'med-a', name: 'Medication A', category: 'Tablets', min: 1, max: 20, qty: 5 }],
      'expiry_dept-a': [{ id: 'exp-a', medId: 'med-a', expiry: '2027-01-01', qty: 3 }],
      'shelves_dept-a': [{ id: 'sh-a', name: 'Shelf A' }],
      requests: [
        { id: 'req-pending', deptId: 'dept-a', status: 'pending', created: today, items: [{ medId: 'med-a', medName: 'Medication A', qty: 2 }] },
        { id: 'req-done', deptId: 'dept-a', status: 'fulfilled', created: today, fulfilledAt: today, items: [{ medId: 'med-a', qty: 2 }], dispensed: [{ medId: 'med-a', qty: 2 }] },
      ],
      crash_carts: [{ id: 'cart-a', name: 'ICU cart', deptId: 'dept-a', seal: 'S-1', items: [{ id: 'item-a', name: 'Adrenaline', qty: 4, present: 4, batches: [{ batchId: 'b1', expiry: '2027-01-01', qty: 4 }] }] }],
      crash_cart_reports: [state === 'open'
        ? { id: 'rep-a', cartId: 'cart-a', deptId: 'dept-a', status: 'open', openedAt: today, reason: 'Cardiac arrest', consumed: [{ itemId: 'item-a', qty: 1 }] }
        : { id: 'rep-a', cartId: 'cart-a', deptId: 'dept-a', status: 'closed', openedAt: today, closedAt: today, reason: 'Cardiac arrest', consumed: [{ itemId: 'item-a', qty: 1 }], replacements: [{ name: 'Adrenaline', qty: 1, expiry: '2027-01-01' }], newSeal: 'S-2', oldSeal: 'S-1' }],
      controlled_catalog: [{ id: 'ctl-a', name: 'Morphine 10mg', classification: 'narcotic', moh: '10012345', min: 2 }],
      'controlled_dept_list_dept-a': [{ medId: 'ctl-a', requiredQty: 4, actualQty: 2, batches: [{ expiry: '2027-01-01', qty: 2 }] }],
      controlled_pharmacy_stock: { 'ctl-a': { qty: 10, batches: [{ expiry: '2027-01-01', qty: 10 }] } },
      accountability_assignments_v2: [{ id: 'asg-a', deptId: 'dept-a', medName: 'Morphine 10mg', quota: 10, balance: 8, reasons: ['Pain'], active: true }],
      accountability_usage_v2: [{
        id: 'use-a', assignmentId: 'asg-a', deptId: 'dept-a', medName: 'Morphine 10mg', units: 2,
        status: state === 'open' ? 'pending_pharmacy' : 'approved_waiting_receipt',
        submittedAt: today, consumptionDate: day,
      }],
      dept_notes: [{ id: 'note-a', deptId: 'dept-a', status: state === 'open' ? 'open' : 'resolved', body: 'Check stock', createdAt: today }],
      pharm_inv_rooms_v1: [{ id: 'room-a', name: 'Main store', cabinets: [{ id: 'cab-a', name: 'Cabinet A', shelves: [{ id: 'sh-1', name: 'A', cells: 2 }] }] }],
      pharm_inv_meds_v1: [{ id: 'pi-a', name: 'Paracetamol 500mg', locations: [{ roomId: 'room-a', cabId: 'cab-a', shelfId: 'sh-1' }], expiry: '2027-01-01' }],
      pharm_inv_txn_v1: [{ id: 'tx-a', type: 'receipt', medName: 'Paracetamol 500mg', qty: 10, date: day, createdAt: today }],
      dept_announcements_v1: [{ id: 'ann-a', ar: 'إعلان', en: 'Announcement', enabled: true, createdAt: today, allDepartments: true }],
      custom_categories: ['Tablets', 'Injections'],
    });
    document.getElementById('auth').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    if (typeof window.buildNav === 'function') window.buildNav();
  }, { who: profile, visibleSource: VISIBLE, state });
}


/* Only the pages the role's own navigation offers. A page with no way in is
   not a page this role can be shown a broken button on. */
async function visiblePages(page) {
  return page.evaluate(() => {
    const nav = document.getElementById('mnav');
    if (!nav) return [];
    const ids = new Set();
    nav.querySelectorAll('*').forEach((node) => {
      /* buildNav stores the destination on the button's dataset. */
      const direct = (node.dataset && (node.dataset.pg || node.dataset.page)) || (node.getAttribute && node.getAttribute('data-page'));
      if (direct) ids.add(direct);
      const source = (node.getAttribute && (node.getAttribute('onclick') || node.getAttribute('data-asdh-onclick'))) || '';
      const match = source.match(/showPg\(['"]([^'"]+)['"]\)/);
      if (match) ids.add(match[1]);
      if (node.__asdhShowPage) ids.add(node.__asdhShowPage);
    });
    return [...ids];
  });
}

export { VISIBLE, STATES, ROLES, prepare, visiblePages };
