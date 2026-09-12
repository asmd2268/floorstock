import { expect, test } from '@playwright/test';
import { VISIBLE, STATES, ROLES, prepare, visiblePages } from './role-walk.js';

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
