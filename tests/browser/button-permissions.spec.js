import { expect, test } from '@playwright/test';

/* Every control a role can SEE should do something for that role.

   A button that is on screen and whose only response is "no permission" is,
   from the person's side, a broken system: they can see it, they press it, it
   scolds them. Either it should not be there, or the refusal should not be.

   This walks the application as each role, opens every page that role can
   reach, presses every visible control, and records any that answer with a
   refusal. Nothing is written while it does: the confirm dialogs answer "no"
   and the state writes are captured rather than sent, so a control that would
   save something stops at its own permission check — which is the only thing
   being measured. */

const REFUSAL = /(no permission|not authorized|permission required|master only|only the|لا توجد صلاحية|غير مصرح|صلاحية)/i;

/* Controls that are supposed to refuse most people, and are meant to be seen:
   they are the doors to a privileged area, and hiding them entirely would leave
   no way to discover the area exists. Each one still has to refuse politely. */
const DELIBERATE_DOORS = new Set([]);


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

test('no role is shown a control whose only answer is "no permission"', async ({ page }) => {
  const findings = [];
  const noControls = [];
  const walked = [];
  let pressed = 0;
  let dialogsSeen = 0;
  let nestedSeen = 0;

  for (const profile of ROLES) for (const state of STATES) {
    await prepare(page, profile, state);
    const pages = await visiblePages(page);
    if (state === 'open') walked.push(`${profile.role}: ${pages.length} page(s)`);

    for (const pageId of pages) {
      const controls = await page.evaluate((id) => {
        try { if (typeof window.showPg === 'function') window.showPg(id); } catch (error) { /* a page that cannot render has no controls to press */ }
        const host = document.getElementById(id);
        if (!host || host.offsetParent === null) return [];
        const visible = new Function('return ' + window.__auditVisible)();
        return Array.from(host.querySelectorAll('button, [role="button"]'))
          .filter((node) => visible(node) && !node.disabled)
          .map((node, index) => ({ index, label: (node.textContent || '').trim().slice(0, 40) }));
      }, pageId);

      if (!controls.length) noControls.push(`${profile.role} · ${pageId}`);
      for (const control of controls) {
        pressed += 1;
        const refusal = await page.evaluate(({ id, index }) => {
          const host = document.getElementById(id);
          if (!host) return null;
          const visible = new Function('return ' + window.__auditVisible)();
          const node = Array.from(host.querySelectorAll('button, [role="button"]'))
            .filter((candidate) => visible(candidate) && !candidate.disabled)[index];
          if (!node) return null;
          window.__toasts.length = 0;
          try { node.click(); } catch (error) { return null; }
          const denial = window.__toasts.find((entry) => entry.kind === 'err');
          return denial ? denial.message : null;
        }, { id: pageId, index: control.index });

        if (refusal && REFUSAL.test(refusal) && !DELIBERATE_DOORS.has(control.label)) {
          findings.push(`${profile.role} (${state}) · ${pageId} · "${control.label}" → ${refusal.split('\n')[0].slice(0, 80)}`);
        }

        /* A control that opened a dialog has put more controls on screen, and
           those are where "answer this report" and "save this custody" live. */
        const inModal = await page.evaluate(() => {
          const visible = new Function('return ' + window.__auditVisible)();
          const modal = [...document.querySelectorAll('.modal-bg.on, #pi-global-modal')].filter(visible).pop();
          if (!modal) return [];
          return [...modal.querySelectorAll('button, [role="button"]')]
            .filter((node) => visible(node) && !node.disabled)
            .map((node, index) => ({ index, label: (node.textContent || '').trim().slice(0, 40) }));
        });

        if (inModal.length) dialogsSeen += 1;
        for (const dialogControl of inModal) {
          const dialogRefusal = await page.evaluate((index) => {
            const visible = new Function('return ' + window.__auditVisible)();
            const modal = [...document.querySelectorAll('.modal-bg.on, #pi-global-modal')].filter(visible).pop();
            if (!modal) return null;
            const node = [...modal.querySelectorAll('button, [role="button"]')]
              .filter((candidate) => visible(candidate) && !candidate.disabled)[index];
            if (!node) return null;
            window.__toasts.length = 0;
            try { node.click(); } catch (error) { return null; }
            const denial = window.__toasts.find((entry) => entry.kind === 'err');
            return denial ? denial.message : null;
          }, dialogControl.index);
          pressed += 1;

          /* A dialog opened from a dialog — a confirmation, a picker — is where
             the last unaudited controls live. One level deeper is enough: past
             that the harness is driving a workflow, not auditing a control. */
          const nested = await page.evaluate(() => {
            const visible = new Function('return ' + window.__auditVisible)();
            const stack = [...document.querySelectorAll('.modal-bg.on, #pi-global-modal')].filter(visible);
            if (stack.length < 2) return [];
            return [...stack[stack.length - 1].querySelectorAll('button, [role="button"]')]
              .filter((node) => visible(node) && !node.disabled)
              .map((node, index) => ({ index, label: (node.textContent || '').trim().slice(0, 40) }));
          });
          for (const deepControl of nested) {
            const deepRefusal = await page.evaluate((index) => {
              const visible = new Function('return ' + window.__auditVisible)();
              const stack = [...document.querySelectorAll('.modal-bg.on, #pi-global-modal')].filter(visible);
              if (stack.length < 2) return null;
              const node = [...stack[stack.length - 1].querySelectorAll('button, [role="button"]')]
                .filter((candidate) => visible(candidate) && !candidate.disabled)[index];
              if (!node) return null;
              window.__toasts.length = 0;
              try { node.click(); } catch (error) { return null; }
              const denial = window.__toasts.find((entry) => entry.kind === 'err');
              return denial ? denial.message : null;
            }, deepControl.index);
            pressed += 1;
            nestedSeen += 1;
            if (deepRefusal && REFUSAL.test(deepRefusal)) {
              findings.push(`${profile.role} (${state}) · ${pageId} · nested dialog "${deepControl.label}" → ${deepRefusal.split('\n')[0].slice(0, 80)}`);
            }
          }

          if (dialogRefusal && REFUSAL.test(dialogRefusal)) {
            findings.push(`${profile.role} (${state}) · ${pageId} · dialog "${dialogControl.label}" → ${dialogRefusal.split('\n')[0].slice(0, 80)}`);
          }
        }

        await page.evaluate(() => {
          document.querySelectorAll('.modal-bg.on').forEach((node) => node.classList.remove('on'));
          document.querySelectorAll('#pi-global-modal').forEach((node) => node.remove());
        });
      }
      /* Close anything a press opened, so the next page starts clean. */
      await page.evaluate(() => {
        document.querySelectorAll('.modal-bg.on').forEach((node) => node.classList.remove('on'));
        document.querySelectorAll('#pi-global-modal, .modal-bg[id]').forEach((node) => {
          if (node.parentNode && node.id && node.id.startsWith('pi-')) node.parentNode.removeChild(node);
        });
      });
    }
  }

  console.log(`Walked ${walked.join(' | ')}\nPressed ${pressed} control(s), ${dialogsSeen} dialog(s), ${nestedSeen} nested control(s). Pages with none: ${noControls.length}`);
  /* If the walk pressed nothing, the audit proved nothing — that is a failure of
     the audit, not a clean bill of health. */
  /* Guards against the audit quietly measuring nothing: a selector change that
     stops finding controls would otherwise read as a clean bill of health. The
     run presses ~450 controls across ~40 pages and opens ~45 dialogs. */
  expect(pressed, 'the audit pressed almost nothing — it is not measuring the application').toBeGreaterThan(300);
  expect(dialogsSeen, 'no dialog opened, so no dialog control was audited').toBeGreaterThan(30);
  /* Nested dialogs are rare here — a save or a cancel usually closes the one it
     is in — so their count is reported rather than required. The pass exists so
     that when one does appear, its controls are audited too. */
  expect(findings, findings.join('\n')).toEqual([]);
});
