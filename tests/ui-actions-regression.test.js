import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const usersSource = fs.readFileSync(
  new URL('../public/assets/js/modules/07-expiry-requests-and-primary-features.js', import.meta.url),
  'utf8',
);
const masterTestSource = fs.readFileSync(
  new URL('../public/assets/js/modules/51-asdhealth-canonical-r6-32-20260727.js', import.meta.url),
  'utf8',
);
const inventorySafetySource = fs.readFileSync(
  new URL('../public/assets/js/modules/53-r661-authoritative-inventory-safety.js', import.meta.url),
  'utf8',
);
const requestSource = fs.readFileSync(
  new URL('../public/assets/js/modules/03-core-application-firebase-state-auth.js', import.meta.url),
  'utf8',
);
const requestEnhancementSource = fs.readFileSync(
  new URL('../public/assets/js/modules/38-v16-user-operations-main.js', import.meta.url),
  'utf8',
);
const cspBridgeSource = fs.readFileSync(
  new URL('../public/assets/js/modules/60-csp-legacy-event-bridge.js', import.meta.url),
  'utf8',
);
const crashBootSource = fs.readFileSync(
  new URL('../public/assets/js/modules/55-r647-crash-cart-authoritative-boot.js', import.meta.url),
  'utf8',
);
const controlledCustodySource = fs.readFileSync(
  new URL('../public/assets/js/modules/51-asdhealth-canonical-r6-32-20260727.js', import.meta.url),
  'utf8',
);

test('Users page actions use CSP-safe delegated event bindings', () => {
  assert.doesNotMatch(usersSource, /onclick=["'][^"']*delUser/);
  assert.doesNotMatch(usersSource, /onclick=["'][^"']*toggleMasterUser/);
  assert.match(usersSource, /data-user-action="delete"/);
  assert.match(usersSource, /data-user-action="toggle-master"/);
  assert.match(usersSource, /userTable\.addEventListener\('click'/);
});

test('Master Test Mode modal actions do not rely on blocked inline handlers', () => {
  assert.doesNotMatch(masterTestSource, /onclick=["'][^"']*masterApplyRole/);
  assert.doesNotMatch(masterTestSource, /onclick=["'][^"']*masterResetRole/);
  assert.match(masterTestSource, /data-master-test-action="apply"/);
  assert.match(masterTestSource, /data-master-test-action="exit"/);
  assert.match(masterTestSource, /modal\.addEventListener\('click'/);
});

test('Inventory snapshots are removed and denied outside the actual Master session', () => {
  assert.match(inventorySafetySource, /if\(window\.MASTER_EFFECTIVE\)return false/);
  assert.match(inventorySafetySource, /function removeSnapshotManager\(\)/);
  assert.match(inventorySafetySource, /if\(!masterAllowed\(\)\)\{removeSnapshotManager\(\);return\}/);
  assert.match(inventorySafetySource, /window\.undoLatestInventorySafetySnapshot=async function\(\)\{\s*if\(!masterAllowed\(\)\)/);
});

test('Requests page actions use CSP-safe delegated event bindings', () => {
  assert.doesNotMatch(requestSource, /onclick=["'][^"']*(?:openFulfill|viewReq|masterDeleteRequestNow|receiveFulfilledRequest)/);
  assert.match(requestSource, /data-request-action="fulfill"/);
  assert.match(requestSource, /data-request-action="view"/);
  assert.match(requestSource, /document\.addEventListener\('click'/);
  assert.doesNotMatch(requestEnhancementSource, /onclick=["'][^"']*(?:v16EditRequest|v16DeleteRequest|v16ConfirmDelete|v16SaveEdit)/);
  assert.doesNotMatch(requestEnhancementSource, /on(?:change|input)=["'][^"']*v16FilterRequests/);
  assert.match(requestEnhancementSource, /requestAction='v16-edit'/);
  assert.match(requestEnhancementSource, /requestAction='v16-delete'/);
  assert.match(requestEnhancementSource, /control\.addEventListener\(control\.tagName==='INPUT'\?'input':'change',window\.v16FilterRequests\)/);
  assert.match(requestEnhancementSource, /\[data-request-action="master-delete"\],\[data-request-action="edit-fulfillment"\]/);
});

test('department login hydrates its directory before assignment validation and scopes local cache per account', () => {
  const hydrateAt = requestSource.indexOf('await fsHydrateDepartmentDirectoryForLogin(profile)');
  const validateAt = requestSource.indexOf("if(profile.role==='department'&&!dept)throw new Error('Your department assignment is missing.')");
  assert.ok(hydrateAt > 0);
  assert.ok(validateAt > hydrateAt);
  assert.match(requestSource, /floorstock_last_cache_v2_['"]?\+cacheUid/);
  assert.match(requestSource, /localStorage\.removeItem\('floorstock_last_cache_v1'\)/);
  assert.doesNotMatch(requestSource, /localStorage\.setItem\(\s*['"]floorstock_last_cache_v1/);
  assert.match(requestSource, /fsStateLoadFloorstockForProfileViaRest\(profileHint\)/);
  assert.match(requestSource, /'crash_carts','crash_cart_reports'/);
  assert.match(requestSource, /function fsStateScopeCacheForProfile\(cache,profile\)/);
  assert.match(requestSource, /String\(cart&&cart\.deptId\|\|''\)===deptId/);
  assert.match(requestSource, /ownCartIds\.has\(String\(report&&report\.cartId\|\|''\)\)/);
});

test('login waits for Floor Stock state before opening the application shell', () => {
  const initAt = requestSource.indexOf('await S.init(setLoginStage,stateProfile)');
  const startAt = requestSource.indexOf('window.startApp();', initAt);
  assert.ok(initAt > 0);
  assert.ok(startAt > initAt);
  assert.match(requestSource, /Loading data… \/ جاري تحميل البيانات…/);
  assert.doesNotMatch(requestSource, /S\.init background|Background Floor Stock initialization failed/);
});

test('Firebase App Check activates the Enterprise provider with token auto-refresh', () => {
  assert.match(
    requestSource,
    /FB_APPCHECK\.activate\(\s*new firebase\.appCheck\.ReCaptchaEnterpriseProvider\([^)]+\),\s*true\s*\)/,
  );
});

test('legacy dynamic controls use a CSP-safe allowlisted bridge without eval', () => {
  assert.match(cspBridgeSource, /var ALLOWED=new Set/);
  assert.match(cspBridgeSource, /element\.removeAttribute\(attribute\)/);
  assert.match(cspBridgeSource, /new MutationObserver/);
  assert.doesNotMatch(cspBridgeSource, /\beval\s*\(|new Function\s*\(|['"]unsafe-inline['"]/);
});

test('every legacy inline action name in the module set is covered by the CSP bridge', () => {
  const modulesDir = new URL('../public/assets/js/modules/', import.meta.url);
  const ignored = new Set([
    'if',
    'setTimeout',
    'clearTimeout',
    'Math',
    'min',
    'max',
    'getElementById',
    'getAttribute',
    'closest',
    'remove',
    'toggle',
    'blur',
    'esc',
    'escA',
    'escx',
    'stringify',
  ]);
  const names = new Set();
  for (const file of fs.readdirSync(modulesDir)) {
    if (!file.endsWith('.js') || file === '60-csp-legacy-event-bridge.js') continue;
    const source = fs.readFileSync(new URL(file, modulesDir), 'utf8');
    for (const handler of source.matchAll(/on(?:click|change|input|submit|keydown|keyup)=(["'])([\s\S]*?)\1/g)) {
      for (const call of handler[2].matchAll(/(?:window\.)?([A-Za-z_$][\w$]*)\s*\(/g)) {
        if (!ignored.has(call[1])) names.add(call[1]);
      }
    }
  }
  const missing = [...names].filter((name) => !new RegExp(`\\b${name}\\b`).test(cspBridgeSource));
  assert.deepEqual(missing, []);
});

test('department Crash Cart boot is read-only and controlled custody loading is deduplicated', () => {
  assert.match(crashBootSource, /canReconcile=.*\['pharmacy','inpatient_supervisor','pharmacy_staff'\]/);
  assert.match(crashBootSource, /if\(window\.CU&&!canReconcile\)\{done=true;return\}/);
  assert.match(controlledCustodySource, /if\(host\.dataset\.controlledLoading==='1'\)return false/);
  assert.match(controlledCustodySource, /delete host\.dataset\.controlledLoading/);
});
