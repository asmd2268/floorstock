import { expect, test } from '@playwright/test';

/* Buttons in generated markup used to carry `onclick="clPrint('high')"`, which
   needs a global function of that name for the CSP bridge to find. The
   replacement is a data attribute and one listener per screen. This proves the
   replacement actually fires: press a converted button and see the screen
   change, not just the absence of an error. */

test('a delegated action button does its work without a global name', async ({ page }) => {
  await page.goto('/');
  await expect.poll(async () => page.locator('html').getAttribute('data-asdh-modules')).toBe('ready');

  const outcome = await page.evaluate(() => {
    window.toast = () => {};
    window.CU = { role: 'pharmacy', username: 'p', active: true, master: true };
    window.MASTER_ACTUAL = window.CU;
    window.S.cache.departments = [{ id: 'dept-a', name: 'Ward A' }];
    window.S.cache['meds_dept-a'] = [{ id: 'm1', name: 'Adrenaline 1mg', classification: 'high_alert', highAlert: true }];
    document.getElementById('auth').style.display = 'none';
    document.getElementById('app').style.display = 'block';

    const host = document.getElementById('pg-classification-lists');
    host.classList.add('on');
    window.renderClassificationLists();

    /* The names these buttons used to need are gone from the global object. */
    const globalsGone = ['clGenerate', 'clCancelReview', 'clConfirmSave', 'clPrint']
      .filter((name) => typeof window[name] === 'function');

    const generate = host.querySelector('[data-act="generate"]');
    const before = host.innerHTML;
    if (generate) generate.click();
    return {
      globalsGone,
      hadButton: !!generate,
      changed: host.innerHTML !== before,
      inlineHandlers: host.querySelectorAll('[onclick]').length,
    };
  });

  expect(outcome.hadButton, 'the converted button is rendered').toBe(true);
  expect(outcome.globalsGone, 'these names no longer need to be global').toEqual([]);
  expect(outcome.changed, 'pressing the delegated button re-rendered the screen').toBe(true);
  expect(outcome.inlineHandlers, 'no inline handler remains on this screen').toBe(0);
});

test('the pharmacy inventory screen works entirely through delegated actions', async ({ page }) => {
  await page.goto('/');
  await expect.poll(async () => page.locator('html').getAttribute('data-asdh-modules')).toBe('ready');

  const outcome = await page.evaluate(() => {
    window.toast = () => {};
    window.uiConfirm = async () => false;
    window.CU = { role: 'pharmacy', username: 'p', active: true };
    window.S.cache.pharm_inv_rooms_v1 = [{ id: 'room-a', name: 'Main store', cabinets: [{ id: 'cab-a', name: 'Cabinet A', shelves: [{ id: 'sh-1', name: 'A', cells: 2 }] }] }];
    window.S.cache.pharm_inv_meds_v1 = [{ id: 'pi-a', name: 'Paracetamol 500mg', locations: [{ roomId: 'room-a', cabId: 'cab-a', shelfId: 'sh-1' }] }];
    document.getElementById('auth').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    const host = document.getElementById('pg-pharm-inv');
    host.classList.add('on');
    window.renderPharmInv();

    /* Not one of the fifty-five names this screen used to need is global. */
    const stillGlobal = ['piOpenAddRoom', 'piSaveRoom', 'piDeleteRoom', 'piOpenEditMed', 'piDoPrint', 'piCloseModal', 'piSubmitTxnRows']
      .filter((name) => typeof window[name] === 'function');

    /* Pressing "Add room" through delegation opens the dialog. */
    const addRoom = host.querySelector('[data-clickact="piOpenAddRoom"]');
    if (addRoom) addRoom.click();
    const dialogOpened = !!document.getElementById('pi-global-modal');

    /* And its Cancel, also delegated, closes it. */
    const cancel = document.querySelector('#pi-global-modal [data-clickact="piCloseModal"]');
    if (cancel) cancel.click();

    return {
      stillGlobal,
      dialogOpened,
      dialogClosed: !document.getElementById('pi-global-modal'),
      inlineHandlers: host.querySelectorAll('[onclick],[onchange],[oninput]').length,
    };
  });

  expect(outcome.stillGlobal, 'these names are no longer global').toEqual([]);
  expect(outcome.dialogOpened, 'the delegated "Add room" opened its dialog').toBe(true);
  expect(outcome.dialogClosed, 'the delegated Cancel closed it').toBe(true);
  expect(outcome.inlineHandlers, 'no inline handler remains on the screen').toBe(0);
});
