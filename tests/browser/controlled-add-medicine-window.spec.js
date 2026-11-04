import { expect, test } from './fixtures.js';
import { prepare } from './role-walk.js';

/* "Add medicine" in the controlled pharmacy opens one full window with every
   field, not a chain of single-field prompts. */

test('Add medicine opens the full window and saves what is typed', async ({ page }) => {
  await prepare(page, { role: 'controlled_pharmacy' });
  const saved = await page.evaluate(() => {
    window.__catalog = null;
    window.ctlSetCatalog = async (a) => { window.__catalog = a; };
    window.ctlSaveMovementLog = async () => true;
    window.ctlCanAddCatalog = () => true;
    window.ctlAddCatalogMedicine();
    return true;
  });
  expect(saved).toBe(true);
  await expect(page.locator('#v13x-med-modal')).toHaveClass(/on/);
  await expect(page.locator('#v13x-med-title')).toContainText('Add controlled medicine');
  for (const id of ['name', 'class', 'moh', 'nupco', 'min', 'max', 'ha', 'lasa', 'fridge']) {
    await expect(page.locator('#v13x-med-' + id)).toBeVisible();
  }
  await page.fill('#v13x-med-name', 'Zz Testmed 10mg');
  await page.selectOption('#v13x-med-class', 'narcotic');
  await page.fill('#v13x-med-min', '5');
  await page.fill('#v13x-med-max', '20');
  await page.check('#v13x-med-ha');
  await page.click('[data-clickact="v13XSaveCatalogMed"]');
  await expect(page.locator('#v13x-med-modal')).not.toHaveClass(/on/);
  const added = await page.evaluate(() => (window.__catalog || []).find((m) => m.name === 'Zz Testmed 10mg'));
  expect(added).toMatchObject({ classification: 'narcotic', min: 5, max: 20, highAlert: true });
});

test('an empty name is refused and nothing is saved', async ({ page }) => {
  await prepare(page, { role: 'controlled_pharmacy' });
  await page.evaluate(() => {
    window.__catalog = null;
    window.ctlSetCatalog = async (a) => { window.__catalog = a; };
    window.ctlCanAddCatalog = () => true;
    window.ctlAddCatalogMedicine();
  });
  await page.click('[data-clickact="v13XSaveCatalogMed"]');
  await expect(page.locator('#v13x-med-modal')).toHaveClass(/on/);
  expect(await page.evaluate(() => window.__catalog)).toBeNull();
});
