import { expect, test } from './fixtures.js';
import { prepare } from './role-walk.js';

/* The crash-cart expiry list is on the Print page for everyone who works the
   carts from the pharmacy side — and only the carts of departments that person
   may open. Both halves are checked in a real page, because the scoping is the
   part that must never be wrong: a total that includes a cart the person cannot
   see leaks it. */

const soon = (days) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

async function openTab(page, profile, restrictedDepts = []) {
  await prepare(page, profile);
  await page.evaluate(({ expiring, restricted, who }) => {
    const item = (generic, qty, expiry) => ({ id: 'i-' + generic, name: generic, genericName: generic, qty, present: qty, batches: [{ batchId: 'b', expiry, qty }] });
    Object.assign(window.S.cache, {
      crash_carts: [
        { id: 'cart-a', name: 'Cart A', deptId: 'dept-a', items: [item('Calcium Gluconate', 2, expiring), item('Atropine', 1, expiring)] },
        { id: 'cart-b', name: 'Cart B', deptId: 'dept-b', items: [item('Calcium Gluconate', 5, expiring)] },
      ],
      user_dept_restrictions_v1: restricted.length ? { [who.id]: restricted } : {},
    });
    window.showPg('pg-print');
  }, { expiring: soon(20), restricted: restrictedDepts, who: { id: profile.id || 'audit-user' } });
  await page.waitForTimeout(400);
}

test('pharmacy-side roles and the master get the tab; department users do not', async ({ page }) => {
  for (const profile of [{ role: 'pharmacy' }, { role: 'pharmacy_staff' }, { role: 'inpatient_supervisor' }, { role: 'master', master: true }]) {
    await openTab(page, profile);
    await page.evaluate(() => document.getElementById('pg-print-tab-orders').click());
    await expect(page.locator('#pg-print-tab-crashexpiry'), profile.role).toBeVisible();
  }
  await openTab(page, { role: 'department', deptId: 'dept-a', deptName: 'Ward A' });
  await page.evaluate(() => document.getElementById('pg-print-tab-orders').click());
  await expect(page.locator('#pg-print-tab-crashexpiry')).toBeHidden();
});

test('the tab shows every cart to a full-access user and only permitted departments to a restricted one', async ({ page }) => {
  await openTab(page, { role: 'pharmacy_staff', id: 'staff-1' });
  await page.evaluate(() => document.getElementById('pg-print-tab-orders').click());
  await page.locator('#pg-print-tab-crashexpiry').click();
  await expect(page.locator('#pg-print-panel-orders')).toBeHidden();
  await expect(page.locator('#crashexpiry-out')).toContainText('Cart A');
  await expect(page.locator('#crashexpiry-out')).toContainText('Cart B');
  await expect(page.locator('#crashexpiry-out table.sum tfoot')).toContainText('8');

  await openTab(page, { role: 'pharmacy_staff', id: 'staff-1' }, ['dept-b']);
  await page.evaluate(() => document.getElementById('pg-print-tab-orders').click());
  await page.locator('#pg-print-tab-crashexpiry').click();
  await expect(page.locator('#crashexpiry-out')).toContainText('Cart A');
  await expect(page.locator('#crashexpiry-out')).not.toContainText('Cart B');
  await expect(page.locator('#crashexpiry-out table.sum tfoot')).toContainText('3');
});

test('the window is editable, bad input is refused, and leaving the tab hides it again', async ({ page }) => {
  await openTab(page, { role: 'pharmacy' });
  await page.evaluate(() => document.getElementById('pg-print-tab-orders').click());
  await page.locator('#pg-print-tab-crashexpiry').click();
  await page.locator('#crashexpiry-days').fill('10');
  await expect(page.locator('#crashexpiry-out')).toContainText('Nothing expires');
  await expect(page.locator('#crashexpiry-print')).toBeDisabled();
  await page.locator('#crashexpiry-days').fill('0');
  await expect(page.locator('#crashexpiry-out')).toContainText('1');
  await expect(page.locator('#crashexpiry-print')).toBeDisabled();
  await page.locator('#crashexpiry-days').fill('25');
  await expect(page.locator('#crashexpiry-out')).toContainText('Cart A');
  await page.locator('#pg-print-tab-orders').click();
  await expect(page.locator('#pg-print-panel-crashexpiry')).toBeHidden();
  await expect(page.locator('#pg-print-panel-orders')).toBeVisible();
});

test('printing opens one sheet with the new-seal column, no letterhead, and only permitted carts', async ({ page }) => {
  await openTab(page, { role: 'pharmacy_staff', id: 'staff-1' }, ['dept-b']);
  await page.evaluate(() => {
    window.__sheet = null;
    const original = URL.createObjectURL.bind(URL);
    URL.createObjectURL = (blob) => { blob.text().then((t) => { window.__sheet = t; }); return original(blob); };
    window.open = () => null;
    document.getElementById('pg-print-tab-orders').click();
  });
  await page.locator('#pg-print-tab-crashexpiry').click();
  await page.locator('#crashexpiry-print').click();
  await expect.poll(() => page.evaluate(() => window.__sheet)).not.toBeNull();
  const sheet = await page.evaluate(() => window.__sheet);
  expect(sheet).toContain('Cart A');
  expect(sheet).not.toContain('Cart B');
  expect(sheet).toContain('class="seal"');
  expect(sheet).not.toMatch(/<img/);
  expect(sheet).toMatch(/@page\{size:A4/);
});
