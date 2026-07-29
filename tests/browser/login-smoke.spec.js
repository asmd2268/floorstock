import { expect, test } from '@playwright/test';

test('application modules load and the CSP-safe login action runs in a browser', async ({ page }) => {
  await page.goto('/');

  await expect.poll(async () => page.locator('html').getAttribute('data-asdh-modules')).toBe('ready');
  await expect(page.locator('html')).toHaveAttribute('data-asdh-missing-actions', '');
  await expect(page.locator('#auth button[data-asdh-binding]')).toBeVisible();

  await page.getByRole('button', { name: 'Sign In / دخول' }).click();
  await expect(page.locator('#aerr')).toBeVisible();
  await expect(page.locator('#aerr')).toHaveText('Enter your Firebase email and password');
});

test('App Check Enterprise provider is activated before Firebase services are used', async ({ page }) => {
  await page.route('https://www.gstatic.com/firebasejs/**', async (route) => {
    const url = route.request().url();
    let body = '';
    if (url.includes('firebase-app-compat')) {
      body = `window.firebase={apps:[],initializeApp:function(){this.apps.push({});return{}},app:function(){return{}}};`;
    } else if (url.includes('firebase-auth-compat')) {
      body = `firebase.auth=function(){return{currentUser:null,onAuthStateChanged:function(){},signInWithEmailAndPassword:function(){return Promise.reject(new Error('stub'))},signOut:function(){return Promise.resolve()}}};`;
    } else if (url.includes('firebase-firestore-compat')) {
      body = `firebase.firestore=function(){return{settings:function(){},enablePersistence:function(){return Promise.resolve()}}};`;
    } else if (url.includes('firebase-app-check-compat')) {
      body = `firebase.appCheck=function(){return{activate:function(provider,refresh){window.__appCheckActivation={key:provider.key,refresh:refresh}}}};firebase.appCheck.ReCaptchaEnterpriseProvider=function(key){this.key=key};`;
    }
    await route.fulfill({ status: 200, contentType: 'application/javascript', body });
  });

  await page.goto('/');
  await expect.poll(() => page.evaluate(() => window.__appCheckActivation || null)).toEqual({
    key: '6LfYImotAAAAACo50nBNoL7EIb14ipF9NQYzrJfr',
    refresh: true
  });
});

test('dynamic legacy controls are rebound safely under CSP', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-asdh-csp-bridge', 'ready');

  await page.evaluate(() => {
    window.__legacyCalls = [];
    window.crashPrint = (id) => window.__legacyCalls.push(['print', id]);
    window.crashReportOpen = (id) => window.__legacyCalls.push(['report', id]);
    window.ctlConfirmDepartmentPrint = (event) => window.__legacyCalls.push(['custody-print', event.type]);
    window.openAddExpiryForMed = (id) => window.__legacyCalls.push(['expiry', id]);
    const host = document.createElement('div');
    host.id = 'legacy-test-host';
    host.innerHTML = `
      <button id="legacy-print" onclick="crashPrint('cart-a')">Print</button>
      <button id="legacy-report" onclick="crashReportOpen('cart-a')">Report</button>
      <button id="legacy-custody" onclick="ctlConfirmDepartmentPrint(event)">Custody</button>
      <button id="legacy-expiry" data-mid="med-a" onclick="openAddExpiryForMed(this.dataset.mid)">Expiry</button>
      <div id="legacy-remove"><button id="legacy-remove-button" onclick="this.parentElement.remove()">Remove</button></div>`;
    document.body.appendChild(host);
  });

  await expect(page.locator('#legacy-print')).not.toHaveAttribute('onclick');
  await page.locator('#legacy-print').click();
  await page.locator('#legacy-report').click();
  await page.locator('#legacy-custody').click();
  await page.locator('#legacy-expiry').click();
  await page.locator('#legacy-remove-button').click();

  await expect(page.locator('#legacy-remove')).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => window.__legacyCalls)).toEqual([
    ['print', 'cart-a'],
    ['report', 'cart-a'],
    ['custody-print', 'click'],
    ['expiry', 'med-a']
  ]);
});

test('My Requests exposes and saves edit only while ordering is open and request is pending', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-asdh-modules', 'ready');

  await page.evaluate(() => {
    window.CU = { role: 'department', deptId: 'dept-a', deptName: 'Ward A', username: 'ward-a' };
    window.MASTER_EFFECTIVE = null;
    window.S.cache.departments = [{ id: 'dept-a', name: 'Ward A' }];
    window.S.cache['meds_dept-a'] = [{ id: 'med-a', name: 'Medication A', max: 20 }];
    window.S.cache.requests = [{
      id: 'req-a',
      deptId: 'dept-a',
      status: 'pending',
      created: new Date().toISOString(),
      editUntil: '2020-01-01T00:00:00.000Z',
      items: [{ medId: 'med-a', qty: 2 }]
    }];
    window.isRequestAllowed = () => ({ allowed: true });
    document.getElementById('auth').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    document.querySelectorAll('.pg').forEach((node) => node.classList.remove('on'));
    document.getElementById('pg-myreqs').classList.add('on');
    window.renderMyReqs();
  });

  const edit = page.locator('#mrlst [data-request-action="v16-edit"]');
  await expect(edit).toBeVisible();
  await edit.click();
  await expect(page.locator('#v16-edit-request')).toBeVisible();
  await page.locator('#v16-edit-request .v16-edit-qty').fill('5');

  await page.evaluate(() => {
    window.__savedRequestEdit = null;
    window.S.upd = async (key, id, changes) => {
      window.__savedRequestEdit = { key, id, changes };
      const request = window.S.cache.requests.find((item) => item.id === id);
      Object.assign(request, changes);
      return true;
    };
  });
  await page.locator('#v16-edit-request [data-request-action="v16-save-edit"]').click();
  await expect.poll(() => page.evaluate(() => window.__savedRequestEdit)).toMatchObject({
    key: 'requests',
    id: 'req-a',
    changes: { items: [{ medId: 'med-a', qty: 5 }] }
  });
  await expect(page.locator('#v16-edit-request')).toHaveCount(0);

  await page.evaluate(() => {
    window.isRequestAllowed = () => ({ allowed: false });
    window.renderMyReqs();
  });
  await expect(edit).toHaveCount(0);

  await page.evaluate(() => {
    window.isRequestAllowed = () => ({ allowed: true });
    window.S.cache.requests[0].status = 'fulfilled';
    window.S.cache.requests[0].fulfilledAt = new Date().toISOString();
    window.renderMyReqs();
  });
  await expect(edit).toHaveCount(0);
});
