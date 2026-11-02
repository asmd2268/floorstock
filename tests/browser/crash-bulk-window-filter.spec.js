import { expect, test } from './fixtures.js';
import { prepare } from './role-walk.js';

/* The bulk-replacement filter takes everything expired or inside a window the
   pharmacist types. The three fixed levels cannot: each is one band. */

const at = (days) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

test('expired and within-N-days medicines are listed and selected together, and N can change', async ({ page }) => {
  await prepare(page, { role: 'pharmacy' });
  await page.evaluate((dates) => {
    const item = (name, expiry) => ({ id: 'i-' + name, name, genericName: name, qty: 2, present: 2, batches: [{ batchId: 'b-' + name, expiry, qty: 2 }] });
    Object.assign(window.S.cache, {
      crash_carts: [{ id: 'cart-a', name: 'Cart A', deptId: 'dept-a', seal: 'S-1', items: [
        item('Expiredmed', dates.expired), item('Soonmed', dates.soon), item('Midmed', dates.mid), item('Latemed', dates.late)] }],
    });
    window.showPg('pg-crashcart');
  }, { expired: at(-5), soon: at(20), mid: at(45), late: at(100) });
  await page.waitForSelector('#ccx-expiry');

  await page.selectOption('#ccx-expiry', 'window');
  await expect(page.locator('#ccx-window-days')).toBeVisible();
  const cart = page.locator('#ccx-cart-cart-a');
  await expect(cart).toContainText('Expiredmed');
  await expect(cart).toContainText('Soonmed');
  await expect(cart).toContainText('Midmed');
  await expect(cart).not.toContainText('Latemed');

  await page.click('#fsr6-crash-select-all');
  await expect(page.locator('#fsr6-crash-count')).toContainText('3 selected');

  await page.fill('#ccx-window-days', '30');
  await page.dispatchEvent('#ccx-window-days', 'change');
  await expect(cart).toContainText('Soonmed');
  await expect(cart).not.toContainText('Midmed');
  await expect(page.locator('#fsr6-crash-count')).toContainText('0 selected');

  await page.fill('#ccx-window-days', 'abc');
  await page.dispatchEvent('#ccx-window-days', 'change');
  await expect(page.locator('#ccx-window-days')).toHaveValue('60');
});

test('the fixed levels still work as before', async ({ page }) => {
  await prepare(page, { role: 'pharmacy' });
  await page.evaluate((dates) => {
    const item = (name, expiry) => ({ id: 'i-' + name, name, genericName: name, qty: 2, present: 2, batches: [{ batchId: 'b-' + name, expiry, qty: 2 }] });
    Object.assign(window.S.cache, { crash_carts: [{ id: 'cart-a', name: 'Cart A', deptId: 'dept-a', seal: 'S-1', items: [
      item('Expiredmed', dates.expired), item('Latemed', dates.late)] }] });
    window.showPg('pg-crashcart');
  }, { expired: at(-5), late: at(100) });
  await page.waitForSelector('#ccx-expiry');
  await page.selectOption('#ccx-expiry', 'expired');
  await expect(page.locator('#ccx-cart-cart-a')).toContainText('Expiredmed');
  await expect(page.locator('#ccx-cart-cart-a')).not.toContainText('Latemed');
  await expect(page.locator('#ccx-window-days')).toBeHidden();
});
