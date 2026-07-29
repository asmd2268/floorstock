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
    window.S.cache['meds_dept-a'] = [
      { id: 'med-a', name: 'Medication A', category: 'Tablets', classification: 'Regular', min: 1, max: 20 },
      { id: 'med-b', name: 'Medication B', category: 'Tablets', classification: 'Critical', min: 2, max: 8 },
      { id: 'med-hidden-old', name: 'Hidden Previous', category: 'Injections', min: 1, max: 10 },
      { id: 'med-hidden-new', name: 'Hidden New', category: 'Injections', min: 1, max: 10 },
      { id: 'med-frozen', name: 'Frozen Previous', category: 'Injections', min: 1, max: 10 }
    ];
    window.S.cache.medication_visibility_rules_v3 = {
      'med:med-hidden-old': { medId: 'med-hidden-old', departmentIds: ['dept-a'], reason: 'Temporarily hidden' },
      'med:med-hidden-new': { medId: 'med-hidden-new', departmentIds: ['dept-a'], reason: 'Temporarily hidden' }
    };
    window.S.cache.medication_freeze_rules_v3 = {
      'med:med-frozen': { medId: 'med-frozen', departmentIds: ['dept-a'], reason: 'Stock review' }
    };
    window.S.cache.requests = [{
      id: 'req-a',
      deptId: 'dept-a',
      status: 'pending',
      created: new Date().toISOString(),
      editUntil: '2020-01-01T00:00:00.000Z',
      items: [
        { medId: 'med-a', medName: 'Medication A', qty: 2 },
        { medId: 'med-hidden-old', medName: 'Hidden Previous', qty: 3 },
        { medId: 'med-frozen', medName: 'Frozen Previous', qty: 4 },
        { medId: 'med-orphan', medName: 'Removed Previous', qty: 6 }
      ]
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
  await expect(page.locator('#mrlst [data-v16-edit-window]')).toContainText('fulfillment');
  await edit.click();
  await expect(page.locator('#v16-edit-request')).toBeVisible();
  await expect(page.locator('#v16-edit-request thead').first()).toContainText('Min');
  await expect(page.locator('#v16-edit-request thead').first()).toContainText('Max');
  await expect(page.locator('#v16-edit-request [data-med="med-a"]')).toHaveValue('2');
  await expect(page.locator('#v16-edit-request [data-med="med-a"]')).toHaveCSS('font-weight', '700');
  await expect(page.locator('#v16-edit-request [data-med="med-b"]')).toHaveValue('0');
  await expect(page.locator('#v16-edit-request [data-med="med-hidden-new"]')).toHaveCount(0);
  await expect(page.locator('#v16-edit-request [data-med="med-hidden-old"]')).toBeDisabled();
  await expect(page.locator('#v16-edit-request [data-med="med-frozen"]')).toBeDisabled();
  await expect(page.locator('#v16-edit-request [data-med="med-orphan"]')).toBeDisabled();
  await page.locator('#v16-edit-request [data-med="med-a"]').fill('5');
  await page.locator('#v16-edit-request [data-med="med-b"]').fill('2');

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
  await expect.poll(() => page.evaluate(() => {
    const saved = window.__savedRequestEdit;
    if (!saved) return null;
    return { ...saved, changes: { ...saved.changes, items: [...saved.changes.items].sort((a, b) => a.medId.localeCompare(b.medId)) } };
  })).toMatchObject({
    key: 'requests',
    id: 'req-a',
    changes: { items: [
      { medId: 'med-a', qty: 5 },
      { medId: 'med-b', qty: 2 },
      { medId: 'med-frozen', qty: 4 },
      { medId: 'med-hidden-old', qty: 3 },
      { medId: 'med-orphan', qty: 6 }
    ] }
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

test('inpatient supervisor can manage Hide rules without unauthorized login-time writes', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-asdh-modules', 'ready');

  const result = await page.evaluate(async () => {
    window.CU = { role: 'inpatient_supervisor', username: 'inpatient-supervisor', active: true };
    window.FB_AUTH = { currentUser: { uid: 'supervisor-a' } };
    window.S.cache.departments = [{ id: 'dept-a', name: 'Ward A' }];
    window.S.cache.deleted_departments = ['old-dept'];
    window.S.cache.requests = [];
    window.S.cache.crash_carts = [];
    const writes = [];
    window.S.s = async (key) => { writes.push(['set', key]); return true; };
    window.S.rm = async (key) => { writes.push(['remove', key]); return true; };

    await window.repairDeletedDepartments();
    window.finalizePreviewStart();
    await new Promise((resolve) => setTimeout(resolve, 0));

    return {
      hideAllowed: window.fsCanWriteStateKey('medication_visibility_rules_v3'),
      freezeAllowed: window.fsCanWriteStateKey('medication_freeze_rules_v3'),
      migrationAllowed: window.fsCanWriteStateKey('migration_crash_cart_norepinephrine_v3'),
      writes
    };
  });

  expect(result).toEqual({
    hideAllowed: true,
    freezeAllowed: true,
    migrationAllowed: false,
    writes: []
  });
});
