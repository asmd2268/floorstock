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
