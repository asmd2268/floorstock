import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {
  canEditRequestBeforeDeadline,
  canEditRequestWhileWindowIsOpen,
  requestWindowDeadlineFromGrid,
} from '../public/assets/js/core/request-edit-policy.js';
import {
  decodeLegacySymbolEntities,
  formatBilingualText,
} from '../public/assets/js/core/ui-text-normalization.js';
import {
  deriveNewRequestGateState,
  findPendingDepartmentRequest,
  isPendingDepartmentRequest,
} from '../public/assets/js/core/new-request-gate-policy.js';
import {
  normalizeRole,
  resolvePermissionProfile,
  hasCapability,
  canWriteStateKey,
  canDeleteStateKey,
} from '../public/assets/js/core/role-capabilities.js';
import { planFor, subscriptionIsWritable } from '../public/assets/js/core/subscription-plans.js';
import {
  DEFAULT_FULFILLMENT_EDIT_HOURS,
  canEditFulfillment,
  fulfillmentEditDeadline,
  normalizeFulfillmentEditHours,
} from '../public/assets/js/core/fulfillment-edit-policy.js';
import { APPLICATION_STATE_KEYS, mayWriteState } from './firestore-rules/application-state-keys.js';

const indexSource = fs.readFileSync(
  new URL('../public/index.html', import.meta.url),
  'utf8',
);

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
const inventoryStatusSource = fs.readFileSync(
  new URL('../public/assets/js/modules/41-v16-inventory-status-merge-clean-script.js', import.meta.url),
  'utf8',
);
const securityRuntimeSource = fs.readFileSync(
  new URL('../public/assets/js/modules/59-r664-security-complete-runtime.js', import.meta.url),
  'utf8',
);
const fulfillmentSettingsSource = fs.readFileSync(
  new URL('../public/assets/js/modules/67-r676-fulfillment-edit-settings.js', import.meta.url),
  'utf8',
);
const startupRepairSource = fs.readFileSync(
  new URL('../public/assets/js/modules/47-asdh-authoritative-final-fixes-script.js', import.meta.url),
  'utf8',
);
const requestScheduleSource = fs.readFileSync(
  new URL('../public/assets/js/modules/42-weekly-request-grid-bulk-classification-clean-script.js', import.meta.url),
  'utf8',
);
const crashReportSource = fs.readFileSync(
  new URL('../public/assets/js/modules/14-controlled-print-layout-and-tools.js', import.meta.url),
  'utf8',
);
const scheduleSource = fs.readFileSync(
  new URL('../public/assets/js/modules/35-v14nrse-main.js', import.meta.url),
  'utf8',
);
const backupSource = fs.readFileSync(
  new URL('../public/assets/js/modules/12-local-daily-backups-system-health.js', import.meta.url),
  'utf8',
);
const draftProtectionSource = fs.readFileSync(
  new URL('../public/assets/js/modules/61-r666-form-draft-and-crash-report-protection.js', import.meta.url),
  'utf8',
);
const persistenceSource = fs.readFileSync(
  new URL('../public/assets/js/modules/49-asdh-final-persistence-actions-20260725.js', import.meta.url),
  'utf8',
);
const uiTextSource = fs.readFileSync(
  new URL('../public/assets/js/modules/62-r667-ui-text-and-icon-normalization.js', import.meta.url),
  'utf8',
);
const sessionGuardSource = fs.readFileSync(
  new URL('../public/assets/js/modules/63-r668-request-lock-drafts-and-session-defaults.js', import.meta.url),
  'utf8',
);
const printOrdersRuntimeSource = fs.readFileSync(
  new URL('../public/assets/js/print-orders-runtime.js', import.meta.url),
  'utf8',
);
const printOrdersPageSource = fs.readFileSync(
  new URL('../public/print-orders.html', import.meta.url),
  'utf8',
);
const accountabilitySource = fs.readFileSync(
  new URL('../public/assets/js/modules/50-r617-integrated-operations.js', import.meta.url),
  'utf8',
);
const accountabilityDraftProtectionSource = fs.readFileSync(
  new URL('../public/assets/js/modules/54-r662-accountability-draft-protection.js', import.meta.url),
  'utf8',
);
const permissionQrSource = fs.readFileSync(
  new URL('../public/assets/js/modules/64-r671-permissions-and-accountability-qr.js', import.meta.url),
  'utf8',
);
const publicHandoverSource = fs.readFileSync(
  new URL('../public/assets/js/accountability-handover-public.js', import.meta.url),
  'utf8',
);
const publicHandoverPage = fs.readFileSync(
  new URL('../public/accountability-handover.html', import.meta.url),
  'utf8',
);
const firestoreRulesSource = fs.readFileSync(
  new URL('../firestore.rules', import.meta.url),
  'utf8',
);
const allInventorySource = fs.readFileSync(new URL('../public/assets/js/modules/30-v13-w-supervisor-inventory-main.js', import.meta.url), 'utf8');
const crashOpeningSource = fs.readFileSync(new URL('../public/assets/js/modules/34-v13-as-crash-opening-log.js', import.meta.url), 'utf8');
const crashInventorySource = fs.readFileSync(new URL('../public/assets/js/modules/44-ccx-inventory-redesign-script.js', import.meta.url), 'utf8');
const inventoryMergeSource = fs.readFileSync(new URL('../public/assets/js/modules/24-inventory-name-merge-feature.js', import.meta.url), 'utf8');
const localQrRuntimeSource = fs.readFileSync(new URL('../public/assets/js/modules/00-r674-local-qr-runtime.js', import.meta.url), 'utf8');
const localQrVendorSource = fs.readFileSync(new URL('../public/assets/js/vendor/qrcode-generator.js', import.meta.url), 'utf8');
const controlledRuntimeSource = fs.readFileSync(new URL('../public/assets/js/modules/40-v16-clean-optimized-script.js', import.meta.url), 'utf8');
const crashPrintSource = fs.readFileSync(new URL('../public/assets/js/modules/48-asdh-final-request-completion-script.js', import.meta.url), 'utf8');
const publicJsSource = fs.readdirSync(new URL('../public/assets/js/modules/', import.meta.url))
  .filter((name) => name.endsWith('.js'))
  .map((name) => fs.readFileSync(new URL(`../public/assets/js/modules/${name}`, import.meta.url), 'utf8'))
  .join('\n');

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
  assert.match(requestEnhancementSource, /\[data-request-action="master-delete"\]/);
  assert.doesNotMatch(requestEnhancementSource, /master-delete"\],\[data-request-action="edit-fulfillment/);
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
  assert.match(requestSource, /function belongs\(row\)/);
  assert.match(requestSource, /Neonatal Intensive Care Unit/);
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

test('scoped Crash Cart state uses permitted document reads and keeps the department id', () => {
  assert.match(requestSource, /function fsUsesDocumentScope\(profile\)/);
  assert.match(requestSource, /if\(fsStateKeysForProfile\(S\.scopeProfile\)\)/);
  assert.match(requestSource, /Promise\.allSettled/);
  assert.match(requestSource, /state\.failedKeys/);
  assert.match(requestSource, /keys\.push\('controlled_dept_list_'\+deptId\)/);
  assert.match(firestoreRulesSource, /docId == 'controlled_dept_list_' \+ departmentId\(\)/);
  assert.match(crashInventorySource, /scopedDepartment=isDepartment\(\)\|\|scopedOutpatient/);
  assert.match(crashInventorySource, /scopeDept=scopedDepartment\?String\(CU\.deptId\|\|''\):''/);
  assert.match(crashInventorySource, /isDept=\['department','department_employee'\]/);
});

test('Hide and Frozen controls remain visible to inpatient supervisor, pharmacy director, and master', () => {
  assert.match(inventoryStatusSource, /\['pharmacy','inpatient_supervisor'\]\.indexOf\(R\(\)\)>-1/);
  assert.match(inventoryStatusSource, /CU\.master===true/);
  assert.match(inventoryStatusSource, /v16-hide-head/);
  assert.match(inventoryStatusSource, /v16-freeze-head/);
  assert.match(inventoryStatusSource, /h\.onclick=window\.openHide/);
  assert.match(inventoryStatusSource, /f\.onclick=window\.openFreeze/);
  assert.equal(canWriteStateKey({ role: 'inpatient_supervisor' }, 'medication_visibility_rules_v3'), true);
  assert.equal(canWriteStateKey({ role: 'inpatient_supervisor' }, 'medication_freeze_rules_v3'), true);
  assert.match(requestSource, /CU\.master===true\|\|String\(CU\.role\|\|''\)==='pharmacy'/);
  assert.match(startupRepairSource, /!window\.fsCanWriteStateKey\(NOREPI_MIGRATION_KEY_Z\)/);
});

test('request editing follows the department current open window and stops after fulfillment', () => {
  const grid = Array.from({ length: 7 }, () => Array(24).fill(false));
  grid[4][6] = true;
  grid[4][7] = true;
  const submittedAt = '2026-07-30T04:15:00.000Z'; // Thursday 07:15 in Riyadh.
  const deadline = requestWindowDeadlineFromGrid(grid, submittedAt);

  assert.equal(deadline, Date.parse('2026-07-30T05:00:00.000Z'));
  assert.equal(canEditRequestBeforeDeadline({ status: 'pending' }, '2026-07-30T04:59:59.999Z', deadline), true);
  assert.equal(canEditRequestBeforeDeadline({ status: 'pending' }, '2026-07-30T05:00:00.000Z', deadline), false);
  assert.equal(canEditRequestBeforeDeadline({ status: 'pending', fulfilledAt: '2026-07-30T04:30:00.000Z' }, '2026-07-30T04:40:00.000Z', deadline), false);
  assert.equal(canEditRequestWhileWindowIsOpen({ status: 'pending' }, true), true);
  assert.equal(canEditRequestWhileWindowIsOpen({ status: 'pending', editUntil: '2020-01-01T00:00:00.000Z' }, true), true);
  assert.equal(canEditRequestWhileWindowIsOpen({ status: 'pending' }, false), false);
  assert.equal(canEditRequestWhileWindowIsOpen({ status: 'fulfilled' }, true), false);
  assert.equal(canEditRequestWhileWindowIsOpen({ status: 'pending', fulfilledAt: '2026-07-30T04:30:00.000Z' }, true), false);
  assert.equal(requestWindowDeadlineFromGrid(grid, '2026-07-30T05:01:00.000Z'), 0);

  const alwaysOpen = Array.from({ length: 7 }, () => Array(24).fill(true));
  assert.equal(requestWindowDeadlineFromGrid(alwaysOpen, submittedAt), null);
  assert.equal(canEditRequestBeforeDeadline({ status: 'pending' }, '2027-07-30T05:00:00.000Z', null), true);

  assert.doesNotMatch(requestEnhancementSource, /7200000|Edit \(2h\)|Edit fulfilled/);
  assert.match(requestEnhancementSource, /canEditRequestBySchedule/);
  assert.match(requestEnhancementSource, /requestEditRestriction/);
  assert.match(requestEnhancementSource, /data-edit-locked/);
  assert.match(requestEnhancementSource, /data-v16-edit-window/);
  assert.match(requestEnhancementSource, /<th>Min<\/th><th>Max<\/th>/);
  assert.match(requestScheduleSource, /getCurrentRequestEditDeadline/);
  assert.match(requestSource, /data-request-id=/);
  assert.match(requestEnhancementSource, /data-request-actions/);
  assert.match(requestEnhancementSource, /S\.upd\('requests',id/);
  assert.match(requestScheduleSource, /window\.getRequestEditDeadline/);
  assert.match(requestScheduleSource, /canEditRequestWhileWindowIsOpen/);
  assert.match(persistenceSource, /editUntil:Number\.isFinite\(deadline\)/);
});

test('fulfilled dispensing edits use the permanent 24-hour policy and exact role scope', () => {
  const request = { status: 'fulfilled', deptId: 'dept-a', fulfilledAt: '2026-08-01T10:00:00.000Z' };
  assert.equal(DEFAULT_FULFILLMENT_EDIT_HOURS, 24);
  assert.equal(normalizeFulfillmentEditHours(undefined), 24);
  assert.equal(normalizeFulfillmentEditHours({ hours: 12.5 }), 12.5);
  assert.equal(fulfillmentEditDeadline(request, undefined), Date.parse('2026-08-02T10:00:00.000Z'));
  assert.equal(canEditFulfillment(request, { role: 'inpatient_supervisor' }, undefined, '2026-08-02T09:59:59.999Z'), true);
  assert.equal(canEditFulfillment(request, { role: 'inpatient_supervisor' }, undefined, '2026-08-02T10:00:00.001Z'), false);
  assert.equal(canEditFulfillment(request, { role: 'department', deptId: 'dept-a' }, undefined, '2026-08-01T11:00:00.000Z'), true);
  assert.equal(canEditFulfillment(request, { role: 'department', deptId: 'dept-b' }, undefined, '2026-08-01T11:00:00.000Z'), false);
  assert.equal(canEditFulfillment(request, { role: 'pharmacy', allowedDepartmentIds: ['dept-a'] }, { hours: 1 }, '2026-08-01T10:30:00.000Z'), true);
  assert.equal(canEditFulfillment(request, { role: 'pharmacy', allowedDepartmentIds: ['dept-b'] }, { hours: 1 }, '2026-08-01T10:30:00.000Z'), false);
  assert.equal(canEditFulfillment(request, { role: 'pharmacy_staff' }, { hours: 1 }, '2026-08-01T10:30:00.000Z'), true);
  assert.equal(canEditFulfillment(request, { role: 'warehouse' }, undefined, '2026-08-01T11:00:00.000Z'), false);
  assert.equal(canEditFulfillment(request, { role: 'pharmacy', master: true }, { hours: 0 }, '2030-08-01T11:00:00.000Z'), true);
  assert.equal(canEditFulfillment({ ...request, status: 'pending' }, { role: 'pharmacy', master: true }, undefined, '2026-08-01T11:00:00.000Z'), false);
  assert.equal(canWriteStateKey({ role: 'pharmacy', master: true }, 'fulfillment_edit_settings_v1'), true);
  assert.equal(canWriteStateKey({ role: 'pharmacy' }, 'fulfillment_edit_settings_v1'), false);
  assert.match(requestSource, /canEditFulfillmentRequest/);
  assert.match(persistenceSource, /request_fulfillment_edited/);
  assert.match(persistenceSource, /fulfillmentEditRevision/);
  assert.match(fulfillmentSettingsSource, /S\.s\(FULFILLMENT_EDIT_SETTINGS_KEY/);
  assert.match(fulfillmentSettingsSource, /fulfillment_edit_window_changed/);
});

test('external pharmacy supervisor is a distinct assignable role with scoped fulfillment access', () => {
  assert.equal(normalizeRole('external pharmacy supervisor'), 'outpatient_pharmacy_supervisor');
  assert.equal(hasCapability({ role: 'outpatient_pharmacy_supervisor' }, 'requests.manage'), true);
  assert.equal(canEditFulfillment({ status: 'fulfilled', fulfilledAt: '2026-08-02T10:00:00.000Z', deptId: 'outpatient' }, { role: 'outpatient_pharmacy_supervisor', deptId: 'outpatient' }, { hours: 24 }, '2026-08-02T11:00:00.000Z'), true);
  assert.equal(canEditFulfillment({ status: 'fulfilled', fulfilledAt: '2026-08-02T10:00:00.000Z', deptId: 'other' }, { role: 'outpatient_pharmacy_supervisor', deptId: 'outpatient' }, { hours: 24 }, '2026-08-02T11:00:00.000Z'), false);
});


test('Crash Cart reports deduct immediately and replacement does not deduct twice', () => {
  assert.match(crashReportSource, /inventoryDeductedAtReport:true/);
  assert.match(crashReportSource, /ccDeductReported\(it,qty,reportedExpiry\)/);
  assert.match(crashReportSource, /alreadyDeducted\?0:/);
  assert.match(crashReportSource, /reported deductions were not deducted twice/);
});

test('Schedule rendering is read-only and supervisor inventory metadata is permitted', () => {
  const renderStart = scheduleSource.indexOf('window.renderRequestCountLimitsSection=function()');
  const saveStart = scheduleSource.indexOf('window.saveRequestCountLimits=async function()');
  const renderBody = scheduleSource.slice(renderStart, saveStart);
  assert.doesNotMatch(renderBody, /migrateRequestCountLimits\(\)/);
  assert.doesNotMatch(scheduleSource.slice(saveStart, saveStart + 1200), /S\.rm\(/);
  assert.equal(canWriteStateKey({ role: 'inpatient_supervisor' }, 'inventory_integrity_nicu'), true);
  assert.match(inventorySafetySource, /var getMeds=function/);
  assert.match(inventorySafetySource, /window\.inventorySafetySetMeds=authoritativeSetMeds/);
  assert.doesNotMatch(inventorySafetySource, /window\.getMeds=getMeds=function/);
  assert.match(requestSource, /globalThis\.inventorySafetySetMeds/);
});

test('Chrome backup transactions and unsent request forms are protected', () => {
  assert.match(backupSource, /tx\.oncomplete=function\(\)\{resolve\(rec\)\}/);
  assert.match(backupSource, /AH_TRANSIENT/);
  assert.match(backupSource, /storageMetaError/);
  assert.match(requestSource, /experimentalAutoDetectLongPolling:true/);
  assert.doesNotMatch(requestSource, /experimentalForceLongPolling:true/);
  assert.match(draftProtectionSource, /Unsaved form protected from automatic refresh/);
  assert.match(draftProtectionSource, /asdh_r666_draft_/);
});


test('legacy icon entities render as symbols and bilingual alerts use Arabic then English lines', () => {
  assert.equal(decodeLegacySymbolEntities('&#x1F3F7; Classification'), '🏷 Classification');
  assert.equal(
    formatBilingualText('Editable until tomorrow / يمكن التعديل حتى الغد'),
    'يمكن التعديل حتى الغد\nEditable until tomorrow',
  );
  assert.equal(
    formatBilingualText('يمكن التعديل حتى الغد / Editable until tomorrow'),
    'يمكن التعديل حتى الغد\nEditable until tomorrow',
  );
  assert.equal(
    formatBilingualText('Editable until tomorrow\nيمكن التعديل حتى الغد'),
    'يمكن التعديل حتى الغد\nEditable until tomorrow',
  );
  assert.match(usersSource, /classification:'🏷 Classification'/);
  assert.doesNotMatch(usersSource, /classification:'&#x1F3F7;/);
  assert.match(requestEnhancementSource, /requestEditDeadlineHtml/);
  assert.match(requestEnhancementSource, /<div dir="rtl"><b>✏ صلاحية التعديل:<\/b>/);
  assert.match(requestEnhancementSource, /<div dir="ltr"><b>Request editing:<\/b>/);
  assert.match(uiTextSource, /installUiTextNormalization/);
  assert.match(scheduleSource, /وصلت إلى الحد الأعلى المسموح للطلبات خلال 24 ساعة/);
  assert.match(scheduleSource, /You have reached the maximum number of requests allowed within 24 hours/);
  assert.doesNotMatch(scheduleSource, /تم الوصول إلى الحد المسموح خلال 24 ساعة/);
  assert.match(scheduleSource, /warning\.textContent='🚫 '\+check\.reason/);
});


test('request limits freeze New Request, drafts never expire, and session filters reset to defaults', () => {
  assert.match(sessionGuardSource, /new-request-gate-locked/);
  assert.match(sessionGuardSource, /checkRequestCountLimits/);
  assert.match(sessionGuardSource, /getMonthlyLimit/);
  assert.match(sessionGuardSource, /getNewRequestGateState/);
  assert.match(sessionGuardSource, /'ccx-state':''/);
  assert.match(sessionGuardSource, /resetFloorstockSessionFilters/);
  assert.match(sessionGuardSource, /previousStart=window\.startApp/);
  assert.match(sessionGuardSource, /previousLogout=window\.doLogout/);
  assert.match(sessionGuardSource, /preserveDraftAround\('renderReqForm','pg-newreq'\)/);
  assert.match(sessionGuardSource, /preserveDraftAround\('renderCrashOperations','pg-crash-ops'\)/);
  assert.match(draftProtectionSource, /localStorage\.setItem\(key\(type\),raw\)/);
  assert.match(draftProtectionSource, /window\.addEventListener\('pagehide',persist\)/);
  assert.match(scheduleSource, /will not be cleared because of inactivity/);
  assert.doesNotMatch(scheduleSource, /The request was cleared after 15 minutes of inactivity/);
  assert.doesNotMatch(scheduleSource, /document\.querySelectorAll\('#rfbody \.rqi'\)\.forEach\(function\(i\)\{i\.value=''\;\}\)/);
});


test('Print Orders uses a CSP-safe external runtime and creates a PDF matching the selected orientation', () => {
  assert.match(masterTestSource, /new URL\('\.\/print-orders\.html',window\.location\.href\)/);
  assert.match(masterTestSource, /localStorage\.setItem\(storageKey,JSON\.stringify\(payload\)\)/);
  assert.match(masterTestSource, /__ASDH_PRINT_ORDER_JOBS__/);
  assert.doesNotMatch(masterTestSource, /popup\.document\.write\(fsR5OrdersHtml\(orders\)\)/);
  assert.doesNotMatch(masterTestSource, /Preparing Landscape PDF/);

  assert.match(printOrdersPageSource, /src="\.\/assets\/js\/print-orders-runtime\.js\?v=R6\.75\.0"/);
  assert.doesNotMatch(printOrdersPageSource, /<script>(?!\s*<\/script>)/);

  assert.match(printOrdersRuntimeSource, /function readPrintRows\(\)/);
  assert.match(printOrdersRuntimeSource, /function buildPdf\(jpegBytes,pixelWidth,pixelHeight,orientation\)/);
  assert.match(printOrdersRuntimeSource, /var portrait=orientation==='portrait'/);
  assert.match(printOrdersRuntimeSource, /layout\.page\.name/);
  assert.match(printOrdersRuntimeSource, /orientation:layout\.page\.name/);
  assert.doesNotMatch(printOrdersRuntimeSource, /function buildLandscapePdf/);
  assert.match(printOrdersRuntimeSource, /async function runStart\(\)/);
  assert.match(printOrdersRuntimeSource, /Print preparation failed:/);
  assert.match(printOrdersRuntimeSource, /Print preparation timed out/);
});

test('QR print pages wait for decoded QR images and stop on non-scannable fallback', () => {
  assert.match(localQrRuntimeSource, /function printRuntimeScript\(options\)/);
  assert.match(localQrRuntimeSource, /img\.naturalWidth>0/);
  assert.match(localQrRuntimeSource, /QR image load timed out/);
  assert.match(localQrRuntimeSource, /automatic printing was stopped/);
  assert.match(localQrRuntimeSource, /data-qr-state/);
  assert.match(usersSource, /ASD_QR\.printRuntimeScript\(\{closeAfter:true\}\)/);
  assert.match(usersSource, /shelfQrPrintRuntime/);
  assert.match(accountabilitySource, /qrPrintRuntime/);
  assert.match(crashPrintSource, /data-qr-print-button disabled/);
  assert.match(crashPrintSource, /ASD_QR\.printRuntimeScript/);
  assert.doesNotMatch(crashPrintSource, /image\.onerror=go|setTimeout\(go,2200\)/);
  assert.match(controlledCustodySource, /showQrFailure/);
  assert.match(controlledCustodySource, /QR generator returned a placeholder/);
});


test('pending department requests are the first New Request gate and use one authoritative edit policy', () => {
  const pending = { id: 'r1', deptId: 'nicu', status: 'pending', created: '2026-07-30T04:00:00.000Z' };
  const fulfilled = { id: 'r2', deptId: 'nicu', status: 'fulfilled', fulfilledAt: '2026-07-30T05:00:00.000Z' };
  const otherDepartment = { id: 'r3', deptId: 'icu', status: 'pending' };

  assert.equal(isPendingDepartmentRequest(pending), true);
  assert.equal(isPendingDepartmentRequest(fulfilled), false);
  assert.equal(findPendingDepartmentRequest([fulfilled, otherDepartment, pending], 'nicu'), pending);

  const openGate = deriveNewRequestGateState({
    isDepartment: true,
    departmentId: 'nicu',
    requests: [pending],
    schedule: { allowed: true },
    rollingLimit: { blocked: true, period: '24h', reason: 'limit' },
    monthlyLimit: 1,
    monthlyUsed: 1,
  });
  assert.equal(openGate.blocked, true);
  assert.equal(openGate.kind, 'pending');
  assert.equal(openGate.canEditPending, true);
  assert.match(openGate.reasonAr, /يوجد لديك طلب معلّق/);
  assert.match(openGate.reasonEn, /You have a pending request/);

  const closedGate = deriveNewRequestGateState({
    isDepartment: true,
    departmentId: 'nicu',
    requests: [pending],
    schedule: { allowed: false },
  });
  assert.equal(closedGate.kind, 'pending');
  assert.equal(closedGate.canEditPending, false);
  assert.match(closedGate.reasonAr, /عند فتح نافذة الطلب/);

  const scheduleGate = deriveNewRequestGateState({
    isDepartment: true,
    departmentId: 'nicu',
    requests: [fulfilled],
    schedule: { allowed: false },
    rollingLimit: { blocked: true, period: '24h', reason: 'limit' },
  });
  assert.equal(scheduleGate.kind, 'schedule');

  const rollingGate = deriveNewRequestGateState({
    isDepartment: true,
    departmentId: 'nicu',
    requests: [fulfilled],
    schedule: { allowed: true },
    rollingLimit: {
      blocked: true,
      period: '24h',
      reason: 'وصلت إلى الحد الأعلى.\nYou reached the maximum.',
    },
  });
  assert.equal(rollingGate.kind, '24h');

  assert.match(sessionGuardSource, /deriveNewRequestGateState/);
  assert.match(sessionGuardSource, /pending-request-locked/);
  assert.match(sessionGuardSource, /r670-new-request-gate-warning/);
  assert.match(persistenceSource, /getNewRequestGateState/);
  assert.match(persistenceSource, /refreshNewRequestGate/);
  assert.doesNotMatch(scheduleSource, /7200000|within_two_hours|Edit window closed \(2 hours\)/);
  assert.match(scheduleSource, /window\.v16EditRequest/);
});

test('department expiry and inventory saves retain own safety snapshots without cross-department access', () => {
  const department = { role: 'department', active: true, deptId: 'emergency' };
  for (const key of [
    'meds_emergency', 'expiry_emergency', 'shelves_emergency',
    'inventory_integrity_emergency', 'inventory_snapshot_index_emergency',
    'inventory_snapshot_emergency_change_meds', 'inventory_snapshot_emergency_change_expiry',
  ]) assert.equal(canWriteStateKey(department, key), true, key);

  for (const key of [
    'meds_nicu', 'expiry_nicu', 'inventory_integrity_nicu',
    'inventory_snapshot_index_nicu', 'inventory_snapshot_nicu_change_meds',
  ]) assert.equal(canWriteStateKey(department, key), false, key);

  assert.equal(canDeleteStateKey(department, 'inventory_snapshot_emergency_old_meds'), true);
  assert.equal(canDeleteStateKey(department, 'inventory_snapshot_nicu_old_meds'), false);
  assert.match(requestSource, /inventory_integrity_','inventory_snapshot_index_/);
  assert.match(persistenceSource, /setExpiry\(CU\.deptId,arr\)/);
  assert.match(persistenceSource, /S\.upd\('requests',requestId/);
});

test('authoritative permission profile allows actual Master and inpatient supervisor state writes', () => {
  const actualMaster = resolvePermissionProfile({
    currentUser: { role: 'master', master: true, email: 'master@example.test' },
    effectiveUser: { role: 'master', master: true, email: 'master@example.test' },
    actualUser: { role: 'master', master: true, email: 'master@example.test' },
  });
  assert.equal(actualMaster.role, 'pharmacy');
  assert.equal(actualMaster.master, true);
  assert.equal(canWriteStateKey(actualMaster, 'crash_carts'), true);
  assert.equal(canWriteStateKey(actualMaster, 'inventory_name_merge_history'), true);

  const supervisor = resolvePermissionProfile({
    currentUser: { role: 'inpatient pharmacy supervisor', email: 'supervisor@example.test' },
    effectiveUser: { role: 'inpatient pharmacy supervisor', email: 'supervisor@example.test' },
    actualUser: { role: 'inpatient pharmacy supervisor', email: 'supervisor@example.test' },
  });
  assert.equal(supervisor.role, 'inpatient_supervisor');
  assert.equal(canWriteStateKey(supervisor, 'crash_carts'), true);
  assert.equal(canWriteStateKey(supervisor, 'inventory_name_merge_history'), true);

  const preview = resolvePermissionProfile({
    currentUser: actualMaster,
    effectiveUser: actualMaster,
    actualUser: actualMaster,
    previewUser: { role: 'department', deptId: 'nicu' },
  });
  assert.equal(preview.master, false);
  assert.equal(preview.role, 'department');
  assert.equal(canWriteStateKey(preview, 'crash_carts'), false);
  assert.equal(canWriteStateKey(preview, 'shelves_nicu'), true);

  assert.match(securityRuntimeSource, /resolvePermissionProfile/);
  assert.doesNotMatch(securityRuntimeSource, /FB_AUTH&&FB_AUTH\.currentUser/);
});

test('department Shelves always exposes CSP-safe print controls for its own department', () => {
  assert.match(indexSource, /id="shelf-print-top-btn"/);
  assert.match(usersSource, /shelfPrintTop\.onclick=printShelfList/);
  assert.match(usersSource, /printRole!=='department'/);
  assert.match(usersSource, /getMeds\(deptId\)/);
  assert.match(usersSource, /shelfQrPrintRuntime/);
  assert.match(usersSource, /ASD_QR\.printRuntimeScript/);
  assert.doesNotMatch(usersSource, /<script>setTimeout\(function\(\)\{window\.print/);
});

test('inventory name merge is explicitly authorized for inpatient supervisor and actual Master', () => {
  assert.equal(hasCapability({ role: 'inpatient_supervisor' }, 'inventory.manage'), true);
  assert.equal(hasCapability({ role: 'master', master: true }, 'inventory.manage'), true);
  assert.match(inventoryStatusSource, /Not authorized to merge inventory names/);
  assert.match(inventoryStatusSource, /window\.openMergeInventoryNames=function\(\)\{if\(!manageAllowed\(\)\)/);
  assert.match(inventoryStatusSource, /window\.confirmMergeInventoryNames=async function\(\)\{if\(!manageAllowed\(\)\)/);
});

test('inpatient supervisor capabilities align across Inventory, Crash Cart, Accountability, and Firestore', () => {
  const supervisor = { role: 'inpatient_pharmacy_supervisor', active: true };
  assert.equal(normalizeRole(supervisor.role), 'inpatient_supervisor');
  for (const capability of ['inventory.manage', 'requests.manage', 'crashCart.operate', 'crashCart.configure', 'accountability.manage', 'accountability.handover.create']) {
    assert.equal(hasCapability(supervisor, capability), true, capability);
  }
  assert.equal(hasCapability(supervisor, 'schedule.manage'), false);
  assert.equal(hasCapability(supervisor, 'controlled.manage'), false);
  assert.equal(hasCapability(supervisor, 'departments.manage'), false);
  assert.equal(hasCapability(supervisor, 'users.manage'), false);

  for (const key of [
    'meds_nicu', 'expiry_nicu', 'shelves_nicu', 'alerts_nicu',
    'inventory_integrity_nicu', 'inventory_name_merge_history',
    'hidden_request_categories_v1', 'global_request_freeze_v2',
    'medication_visibility_rules_v3', 'medication_freeze_rules_v3',
    'crash_carts', 'crash_cart_reports', 'crash_cart_medication_names_v1',
    'accountability_assignments_v2', 'accountability_usage_v2', 'accountability_regimens_v2',
    'requests', 'request_analytics_archive', 'deleted_request_audit_v4', 'department_request_notifications_v1',
  ]) assert.equal(canWriteStateKey(supervisor, key), true, key);

  for (const key of ['req_windows', 'disp_slots', 'monthly_limits', 'controlled_catalog', 'departments', 'deleted_departments']) {
    assert.equal(canWriteStateKey(supervisor, key), false, key);
  }
  assert.equal(canDeleteStateKey(supervisor, 'inventory_snapshot_nicu_old_meds'), true);
  assert.equal(canDeleteStateKey(supervisor, 'requests'), false);

  assert.match(securityRuntimeSource, /canDeleteStateKey/);
  assert.match(securityRuntimeSource, /Not authorized to modify/);
  assert.match(permissionQrSource, /schedule\.manage/);
  assert.match(permissionQrSource, /Schedule is read-only for the Inpatient Pharmacy Supervisor/);
  assert.match(firestoreRulesSource, /alerts_\.\*/);
  assert.match(firestoreRulesSource, /hidden_request_categories_v1/);
  assert.match(firestoreRulesSource, /accountability_handover_sessions/);
  assert.match(allInventorySource, /fsHasCapability\('inventory\.manage'\)/);
  assert.match(inventoryStatusSource, /fsHasCapability\('inventory\.manage'\)/);
  assert.match(inventoryMergeSource, /fsHasCapability\('inventory\.manage'\)/);
  assert.match(crashOpeningSource, /fsHasCapability\('crashCart\.operate'\)/);
  assert.match(crashInventorySource, /fsHasCapability\('crashCart\.configure'\)/);

  const rulesMatch = firestoreRulesSource.match(/r in \['inpatient_supervisor', 'inpatient_pharmacy_supervisor', 'inpatient pharmacy supervisor'\]\s*&& docId\.matches\('([^']+)'\)/);
  assert.ok(rulesMatch, 'inpatient supervisor Firestore regex was not found');
  const firestoreSupervisorRegex = new RegExp(rulesMatch[1]);
  for (const key of APPLICATION_STATE_KEYS) {
    const clientDecision = canWriteStateKey(supervisor, key);
    assert.equal(
      clientDecision,
      mayWriteState('inpatient_supervisor', key),
      `client/rules test-matrix mismatch for ${key}`,
    );
    assert.equal(
      clientDecision,
      firestoreSupervisorRegex.test(key),
      `client/firestore.rules mismatch for ${key}`,
    );
  }
});

test('Accountability supports independent medicines and temporary two-party QR confirmation without OTP', () => {
  assert.match(accountabilitySource, /Independent department custody/);
  assert.match(accountabilitySource, /never adds it to meds_&lt;department&gt;/);
  assert.match(accountabilitySource, /Temporary dual-QR handover/);
  assert.match(accountabilitySource, /Expired — may reissue/);
  assert.match(permissionQrSource, /httpsCallable\('createAccountabilityHandover'\)/);
  assert.match(permissionQrSource, /window\.ASD_QR\.imageMarkup/);
  assert.match(permissionQrSource, /url\.hash=new URLSearchParams/);
  assert.doesNotMatch(permissionQrSource, /api\.qrserver\.com|cdn\.jsdelivr\.net/);
  assert.doesNotMatch(permissionQrSource, /otp|one[- ]time password/i);
  assert.match(publicHandoverSource, /location\.hash/);
  assert.match(publicHandoverSource, /history\.replaceState/);
  assert.match(publicHandoverSource, /getAccountabilityHandover/);
  assert.match(publicHandoverSource, /confirmAccountabilityHandover/);
  assert.match(publicHandoverPage, /noindex,nofollow/);
  assert.match(publicHandoverPage, /no-referrer/);
});

test('Accountability keeps an unsaved draft intact across live refreshes', () => {
  assert.match(accountabilityDraftProtectionSource, /floorstockShouldProtectAutoRefresh/);
  assert.match(accountabilityDraftProtectionSource, /pageId==='pg-med-accountability'/);
  assert.match(accountabilityDraftProtectionSource, /persist\(\);indicator\(\);return true/);
  assert.match(accountabilityDraftProtectionSource, /sessionStorage\.setItem/);
  assert.match(accountabilityDraftProtectionSource, /localStorage\.setItem/);
  assert.match(accountabilityDraftProtectionSource, /restorePageTransientUi/);
  assert.match(accountabilityDraftProtectionSource, /acc2SaveAssignment/);
});

test('all QR features use one local generator and printing continues with a visible fallback', () => {
  assert.match(indexSource, /assets\/js\/vendor\/qrcode-generator\.js\?v=R6\.74\.0/);
  assert.match(localQrVendorSource, /Licensed under the MIT license/);
  assert.match(localQrRuntimeSource, /window\.ASD_QR=api/);
  assert.match(localQrRuntimeSource, /window\.makeReadableQR=createQrDataUrl/);
  assert.match(localQrRuntimeSource, /placeholderDataUrl/);
  assert.match(localQrRuntimeSource, /printing will continue without a scannable QR code/);
  assert.equal((publicJsSource.match(/window\.makeReadableQR=/g) || []).length, 1);
  assert.doesNotMatch(publicJsSource, /api\.qrserver\.com|cdn\.jsdelivr\.net\/npm\/qrcode-generator/);
  assert.match(usersSource, /window\.makeReadableQR\(getPublicExpiryUrl\(deptId\)\)/);
  assert.match(accountabilitySource, /window\.makeReadableQR\(publicUrl\)/);
  assert.match(controlledCustodySource, /window\.makeReadableQR\(url\)/);
  assert.match(crashPrintSource, /window\.makeReadableQR\(publicUrl\.toString\(\)\)/);
});

test('controlled inpatient-department editing is restricted to controlled officer and actual Master', () => {
  const officer = { role: 'controlled_pharmacy', active: true };
  const master = { role: 'master', master: true, active: true };
  assert.equal(hasCapability(officer, 'controlled.manage'), true);
  assert.equal(hasCapability(master, 'controlled.manage'), true);
  for (const key of ['controlled_dept_list_nicu', 'controlled_dept_shelves_nicu', 'controlled_settings_nicu']) {
    assert.equal(canWriteStateKey(officer, key), true, key);
    assert.equal(canWriteStateKey(master, key), true, key);
  }
  assert.equal(hasCapability({ role: 'pharmacy_staff' }, 'controlled.manage'), false);
  assert.equal(hasCapability({ role: 'inpatient_supervisor' }, 'controlled.manage'), false);
  assert.match(usersSource, /function ctlCanManage\(\)/);
  assert.match(usersSource, /fsHasCapability\('controlled\.manage'\)/);
  assert.match(usersSource, /function ctlCanEditDept\(\)\{return ctlCanManage\(\)\}/);
  assert.match(controlledRuntimeSource, /effectiveRole==='controlled_pharmacy'/);
});

test('subscription plans expose selected features and enforce read-only expiry', () => {
  assert.equal(planFor('starter').features.includes('requests'), true);
  assert.equal(planFor('starter').features.includes('crash_cart'), false);
  assert.equal(planFor('professional').features.includes('crash_cart'), true);
  assert.equal(planFor('enterprise').features.includes('branding'), true);
  assert.equal(planFor('starter').maxDepartments, 10);
  assert.equal(subscriptionIsWritable({ status: 'active', currentPeriodEnd: '2099-01-01T00:00:00Z' }), true);
  assert.equal(subscriptionIsWritable({ status: 'trialing', currentPeriodEnd: '2020-01-01T00:00:00Z' }), false);
  assert.equal(subscriptionIsWritable({ status: 'past_due', currentPeriodEnd: '2099-01-01T00:00:00Z' }), false);
});
