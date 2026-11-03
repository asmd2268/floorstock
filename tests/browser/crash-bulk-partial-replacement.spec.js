import { expect, test } from './fixtures.js';
import { prepare } from './role-walk.js';

/* A pharmacist who removes two expiring units but has only one to put back must
   be warned that the cart will be closed below its standard — and still be able
   to save. */

const at = (d) => { const x = new Date(); x.setDate(x.getDate() + d); return x.toISOString().slice(0, 10); };

async function openModal(page) {
  await prepare(page, { role: 'pharmacy' });
  await page.evaluate((dates) => {
    const item = { id: 'i1', name: 'Magnesium Sulfate', genericName: 'Magnesium Sulfate', strength: '2g/20ml', qty: 2, present: 2, batches: [{ batchId: 'b1', expiry: dates.soon, qty: 2 }] };
    Object.assign(window.S.cache, { crash_cart_reports: [], crash_carts: [{ id: 'cart-a', name: 'Cart A', deptId: 'dept-a', seal: 'OLD-A1', items: [item] }] });
    /* The page has no database here: keep the saved value where the page reads it. */
    window.__asked = []; window.__answer = true;
    window.confirm = (message) => { window.__asked.push(message); return window.__answer; };
    window.setCrashCarts = async (v) => { window.S.cache.crash_carts = JSON.parse(JSON.stringify(v)); return window.S.cache.crash_carts; };
    window.showPg('pg-crashcart');
  }, { soon: at(10) });
  await page.waitForSelector('#ccx-expiry');
  await page.selectOption('#ccx-expiry', 'window');
  await page.click('#fsr6-crash-select-all');
  await page.click('#fsr6-crash-open');
  await page.waitForSelector('#fsr6-crash-modal');
}

async function fill(page, qty) {
  await page.fill('.fsr6-alloc-expiry', '2028-01-31');
  await page.dispatchEvent('.fsr6-alloc-expiry', 'change');
  await page.fill('.fsr6-alloc-qty', String(qty));
  await page.dispatchEvent('.fsr6-alloc-qty', 'input');
  await page.evaluate(() => {
    const i = document.querySelector('#fsr6-review-host [data-cart="cart-a"] .fsr6-seal-input');
    i.value = 'B300001';
    i.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

test('replacing fewer than removed warns, then saves and leaves the cart short', async ({ page }) => {
  await openModal(page);
  await fill(page, 1);
  await page.click('#fsr6-save');
  await expect(page.locator('#fsr6-crash-modal')).toHaveCount(0);
  const asked = await page.evaluate(() => window.__asked);
  expect(asked).toHaveLength(1);
  expect(asked[0]).toContain('standard 2');
  expect(asked[0]).toContain('will hold 1');
  const cart = await page.evaluate(() => window.S.cache.crash_carts[0]);
  expect(cart.seal).toBe('B300001');
  expect(cart.items[0].present).toBe(1);
  expect(cart.items[0].batches.map((b) => [b.expiry, b.qty])).toEqual([['2028-01-31', 1]]);
});

test('declining the warning saves nothing', async ({ page }) => {
  await openModal(page);
  await fill(page, 1);
  await page.evaluate(() => { window.__answer = false; });
  await page.click('#fsr6-save');
  await expect(page.locator('#fsr6-status')).toContainText('Cancelled');
  const cart = await page.evaluate(() => window.S.cache.crash_carts[0]);
  expect(cart.seal).toBe('OLD-A1');
  expect(cart.items[0].present).toBe(2);
});

test('replacing the full quantity asks nothing, and more than removed is refused', async ({ page }) => {
  await openModal(page);
  await fill(page, 3);
  await page.click('#fsr6-save');
  await expect(page.locator('#fsr6-status')).toContainText('cannot exceed');
  await page.fill('.fsr6-alloc-qty', '2');
  await page.dispatchEvent('.fsr6-alloc-qty', 'input');
  await page.click('#fsr6-save');
  await expect(page.locator('#fsr6-crash-modal')).toHaveCount(0);
  expect(await page.evaluate(() => window.__asked)).toHaveLength(0);
  const cart = await page.evaluate(() => window.S.cache.crash_carts[0]);
  expect(cart.items[0].present).toBe(2);
});

test('quantity 0 removes the expiring units and puts nothing back', async ({ page }) => {
  await openModal(page);
  await fill(page, 0);
  await page.click('#fsr6-save');
  await expect(page.locator('#fsr6-crash-modal')).toHaveCount(0);
  const asked = await page.evaluate(() => window.__asked);
  expect(asked).toHaveLength(1);
  expect(asked[0]).toContain('standard 2');
  expect(asked[0]).toContain('will hold 0');
  const cart = await page.evaluate(() => window.S.cache.crash_carts[0]);
  expect(cart.seal).toBe('B300001');
  expect(cart.items[0].present).toBe(0);
  expect(cart.items[0].batches).toEqual([]);
});

test('choosing a medicine in the window filter gathers its other dates from every cart', async ({ page }) => {
  await prepare(page, { role: 'pharmacy' });
  await page.evaluate((d) => {
    const item = (id, name, expiry) => ({ id, name, genericName: name, strength: '2g/20ml', qty: 2, present: 2, batches: [{ batchId: 'b-' + id, expiry, qty: 2 }] });
    Object.assign(window.S.cache, { crash_cart_reports: [], crash_carts: [
      { id: 'cart-a', name: 'Cart A', deptId: 'dept-a', seal: 'OLD-A1', items: [item('i1', 'Magnesium Sulfate', d.one), item('i9', 'Atropine', d.one)] },
      { id: 'cart-b', name: 'Cart B', deptId: 'dept-b', seal: 'OLD-B1', items: [item('i2', 'Magnesium Sulfate', d.two)] },
      { id: 'cart-c', name: 'Cart C', deptId: 'dept-b', seal: 'OLD-C1', items: [item('i3', 'Magnesium Sulfate', d.late)] }] });
    window.showPg('pg-crashcart');
  }, { one: at(10), two: at(40), late: at(300) });
  await page.waitForSelector('#ccx-expiry');
  await page.selectOption('#ccx-expiry', 'window');
  /* Tick only Cart A's Magnesium row. */
  await page.locator('#ccx-cart-cart-a tbody tr', { hasText: 'Magnesium' }).locator('input[type=checkbox]').click();
  await page.click('#fsr6-crash-open');
  await page.waitForSelector('#fsr6-crash-modal');
  const plans = await page.locator('.fsr6-plan-meta').allTextContents();
  expect(plans).toHaveLength(2);
  expect(plans.join(' ')).toContain(at(10));
  expect(plans.join(' ')).toContain(at(40));
  expect(plans.join(' ')).not.toContain(at(300));
  expect(await page.locator('#fsr6-review-host [data-cart]').count()).toBe(2);
  await expect(page.locator('#fsr6-crash-modal')).not.toContainText('Atropine');
});
