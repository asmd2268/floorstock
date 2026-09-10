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

async function prepare(page, profile) {
  await page.goto('/');
  await expect.poll(async () => page.locator('html').getAttribute('data-asdh-modules')).toBe('ready');
  await page.evaluate((who) => {
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
    window.S.cache.departments = [{ id: 'dept-a', name: 'Ward A' }, { id: 'dept-b', name: 'Ward B' }];
    document.getElementById('auth').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    if (typeof window.buildNav === 'function') window.buildNav();
  }, profile);
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

  for (const profile of ROLES) {
    await prepare(page, profile);
    const pages = await visiblePages(page);
    walked.push(`${profile.role}: ${pages.length} page(s)`);

    for (const pageId of pages) {
      const controls = await page.evaluate((id) => {
        try { if (typeof window.showPg === 'function') window.showPg(id); } catch (error) { /* a page that cannot render has no controls to press */ }
        const host = document.getElementById(id);
        if (!host || host.offsetParent === null) return [];
        return Array.from(host.querySelectorAll('button, [role="button"]'))
          .filter((node) => node.offsetParent !== null && !node.disabled)
          .map((node, index) => ({ index, label: (node.textContent || '').trim().slice(0, 40) }));
      }, pageId);

      if (!controls.length) noControls.push(`${profile.role} · ${pageId}`);
      for (const control of controls) {
        pressed += 1;
        const refusal = await page.evaluate(({ id, index }) => {
          const host = document.getElementById(id);
          if (!host) return null;
          const node = Array.from(host.querySelectorAll('button, [role="button"]'))
            .filter((candidate) => candidate.offsetParent !== null && !candidate.disabled)[index];
          if (!node) return null;
          window.__toasts.length = 0;
          try { node.click(); } catch (error) { return null; }
          const denial = window.__toasts.find((entry) => entry.kind === 'err');
          return denial ? denial.message : null;
        }, { id: pageId, index: control.index });

        if (refusal && REFUSAL.test(refusal) && !DELIBERATE_DOORS.has(control.label)) {
          findings.push(`${profile.role} · ${pageId} · "${control.label}" → ${refusal.split('\n')[0].slice(0, 80)}`);
        }
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

  console.log(`Walked ${walked.join(' | ')}\nPressed ${pressed} control(s). Pages with none: ${noControls.length}`);
  /* If the walk pressed nothing, the audit proved nothing — that is a failure of
     the audit, not a clean bill of health. */
  expect(pressed, 'the audit pressed no controls at all').toBeGreaterThan(20);
  expect(findings, findings.join('\n')).toEqual([]);
});
