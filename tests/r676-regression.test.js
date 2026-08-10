import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { formatOrderingUnavailable } from '../public/assets/js/core/bilingual-ordering-message.js';

const clientSource = fs.readFileSync(new URL('../public/assets/js/modules/66-r676-crash-report-ordering-notes-fixes.js', import.meta.url), 'utf8');
const functionSource = fs.readFileSync(new URL('../functions/crash-cart-report.js', import.meta.url), 'utf8');
const coreSource = fs.readFileSync(new URL('../functions/crash-cart-report-core.js', import.meta.url), 'utf8');
const functionsPackage = JSON.parse(fs.readFileSync(new URL('../functions/package.json', import.meta.url), 'utf8'));

// These checks protect the architectural fix: department reports must never write
// the scoped crash_carts array directly from the browser.
test('Crash Cart department reporting uses the authenticated callable and updates local cache only after server confirmation', () => {
  assert.match(clientSource, /fsCallFunction\('submitCrashCartReport'/);
  const submitBody = clientSource.match(/window\.ccSubmitReport=async function\(\)\{([\s\S]*?)\n\};\nwindow\.ccSubmitReport\.__r676SecureCallable/);
  assert.ok(submitBody);
  assert.doesNotMatch(submitBody[1], /setCrashCarts\s*\(/);
  assert.match(submitBody[1], /replaceCachedCrashState\(data\.cart,data\.report\)/);
});

test('Crash Cart callable validates department ownership and updates the private state plus public QR in one transaction', () => {
  assert.match(functionSource, /String\(profile\.role \|\| ''\) !== 'department'/);
  assert.match(coreSource, /not assigned to the authenticated department/);
  assert.match(functionSource, /db\.runTransaction/);
  assert.match(functionSource, /transaction\.set\(refs\.carts/);
  assert.match(functionSource, /transaction\.set\(refs\.reports/);
  assert.match(functionSource, /publicCollection\.doc\(`crash_\$\{cartId\}`\)/);
  assert.match(coreSource, /publicCrashCartPayload/);
  assert.doesNotMatch(coreSource.match(/function publicCrashCartPayload[\s\S]*?module\.exports/)[0], /seal|updatedBy/i);
});

test('department Notes badge counts unresolved replied notes only', () => {
  assert.match(clientSource, /status==='open'\|\|status==='urgent'/);
  assert.match(clientSource, /unresolvedNote\(note\)&&!!note\.reply&&!note\._replyRead/);
});

test('ordering unavailable banner renders Arabic and English on separate directional lines', () => {
  assert.match(clientSource, /dir=\"rtl\" style=\"display:block/);
  assert.match(clientSource, /formatOrderingUnavailable/);
  assert.match(clientSource, /dir=\"ltr\" style=\"display:block/);
  assert.match(clientSource, /mixed\.remove\(\)/);
  const lines = formatOrderingUnavailable({ next: { dayIndex: 3, time: '00:00' } });
  assert.equal(lines.ar, '🚫 الطلب غير متاح الآن .. أقرب وقت متاح الأربعاء 00:00');
  assert.equal(lines.en, 'Ordering is currently unavailable. Next available time: Wednesday 00:00');
  assert.equal(lines.ar.includes('Wednesday'), false);
  assert.equal(lines.en.includes('الأربعاء'), false);
});

test('Cloud Functions package loads the combined entrypoint and validates all new files', () => {
  assert.equal(functionsPackage.main, 'main.js');
  assert.match(functionsPackage.scripts.lint, /crash-cart-report\.js/);
  assert.match(functionsPackage.scripts.test, /crash-cart-report-core\.test\.js/);
});
