import { expect, test } from '@playwright/test';
import { VISIBLE, STATES, ROLES, prepare, visiblePages } from './role-walk.js';

/* Every control a role can see must survive being pressed.

   button-permissions.spec.js measures the controls that answer "no permission".
   This measures the ones that answer NOTHING — the button that throws and
   leaves no toast, no error on screen, no trace at all. From the ward's side
   those two failures look identical, but only one of them was being tested.

   That blind spot is what shipped: `installActions(root, {act: () => doThing()})`
   registered from a sibling IIFE parses cleanly and throws ReferenceError only
   on the click, so the print filter buttons were silent for weeks and then the
   same reference aborted renderPrintTable and emptied the whole print page for
   every role. Nothing in the suite could see it, because nothing in the suite
   listened for a page error.

   So: walk every role, open every page that role's own navigation offers, press
   every visible control, and fail on any uncaught error — attributed to the
   role, the page and the button, because "something threw" is not a bug report. */

/* Errors that belong to the stubbed world rather than the code under test: the
   harness blanks window.open and the state writers, so a control that genuinely
   opens a window or fetches is expected to complain. Anything reaching for the
   network is out of scope here — the point of this spec is reference and type
   errors in our own handlers. */
const HARNESS_NOISE = /Failed to fetch|NetworkError|ERR_|net::|Firebase|firestore|permission-denied|Target closed|blob:|Not implemented/i;

function isOurBug(message) {
  if (HARNESS_NOISE.test(message)) return false;
  return /ReferenceError|TypeError|SyntaxError|is not defined|is not a function|Cannot read propert/i.test(message);
}

test('no control throws when the role that can see it presses it', async ({ page }) => {
  const failures = [];
  let pressed = 0;
  let current = { role: '', page: '', label: '' };

  const note = (message) => {
    const text = String(message || '');
    if (!isOurBug(text)) return;
    const where = `${current.role} · ${current.page} · "${current.label}"`;
    if (!failures.some((entry) => entry.startsWith(where) && entry.endsWith(text))) {
      failures.push(`${where} → ${text}`);
    }
  };

  page.on('pageerror', (error) => note(error && error.message));
  page.on('console', (message) => { if (message.type() === 'error') note(message.text()); });

  for (const profile of ROLES) for (const state of STATES) {
    current = { role: `${profile.role}/${state}`, page: '(load)', label: '(navigation)' };
    await prepare(page, profile, state);

    for (const pageId of await visiblePages(page)) {
      current.page = pageId;
      current.label = '(render)';
      const controls = await page.evaluate((id) => {
        try { if (typeof window.showPg === 'function') window.showPg(id); } catch (error) { /* recorded by the pageerror listener */ }
        const host = document.getElementById(id);
        if (!host || host.offsetParent === null) return [];
        const visible = new Function('return ' + window.__auditVisible)();
        return Array.from(host.querySelectorAll('button, [role="button"]'))
          .filter((node) => visible(node) && !node.disabled)
          .map((node, index) => ({ index, label: (node.textContent || '').trim().slice(0, 40) || '(unlabelled)' }));
      }, pageId);

      for (const control of controls) {
        current.label = control.label;
        pressed += 1;
        await page.evaluate(({ id, index }) => {
          const host = document.getElementById(id);
          if (!host) return;
          const visible = new Function('return ' + window.__auditVisible)();
          const node = Array.from(host.querySelectorAll('button, [role="button"]'))
            .filter((candidate) => visible(candidate) && !candidate.disabled)[index];
          /* Let it throw: the listeners above are the measurement. Swallowing it
             here is exactly the mistake that let these bugs live. */
          if (node) node.click();
        }, { id: pageId, index: control.index });
        /* A handler that defers its work still has to not throw. */
        await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 0)));
      }
    }
  }

  console.log(`Pressed ${pressed} control(s) across ${ROLES.length} role(s) × ${STATES.length} state(s).`);
  expect(pressed, 'the walk pressed nothing — the harness stopped working, not the app').toBeGreaterThan(100);
  expect(failures, `controls that threw:\n  ${failures.join('\n  ')}`).toEqual([]);
});
