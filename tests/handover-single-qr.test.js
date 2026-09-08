import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

/* The handover used to mint two QR codes: the pharmacist scanned one and retyped
   their own name and employee number, the nurse scanned the other, and nothing
   completed until both had. The pharmacy half was redundant — the pharmacist is
   the signed-in account that just pressed Create — and it added a code to
   distribute and a way for a handover to stall with nobody having received
   anything. Only the department scans now. */

const functionsIndex = await readFile(new URL('../functions/index.js', import.meta.url), 'utf8');
const handoverCore = await readFile(new URL('../functions/accountability-handover-core.js', import.meta.url), 'utf8');
const module70 = await readFile(new URL('../public/assets/js/modules/70-r676-accountability-regimen-roster-and-log.js', import.meta.url), 'utf8');
const publicPage = await readFile(new URL('../public/assets/js/accountability-handover-public.js', import.meta.url), 'utf8');

test('no pharmacy token is minted or stored', () => {
  assert.ok(!/const pharmacyToken = createToken\(\)/.test(functionsIndex), 'the pharmacy token is gone');
  assert.ok(!/pharmacyTokenHash: hashToken/.test(functionsIndex), 'no pharmacy token hash is written');
  // Both creation paths — first issue and reissue — must agree.
  assert.equal((functionsIndex.match(/departmentTokenHash: hashToken\(departmentToken\)/g) || []).length, 2);
  assert.equal((functionsIndex.match(/pharmacyConfirmation: pharmacyConfirmationFromAccount\(caller, nowIso\)/g) || []).length, 2);
});

test('the session starts already confirmed on the pharmacy side', () => {
  // Nothing is left waiting on the pharmacist, so the status and the row status
  // both name what is actually still outstanding.
  assert.ok(!/status: 'waiting_both_confirmations',/.test(functionsIndex));
  assert.equal((functionsIndex.match(/status: 'pharmacy_confirmed',/g) || []).length, 2);
  assert.equal((functionsIndex.match(/row\.handoverStatus = 'waiting_department';/g) || []).length, 2);
});

test('a pharmacy confirmation has no route in for a new session', () => {
  assert.match(handoverCore, /if \(party === 'pharmacy' && !session\.pharmacyTokenHash\)/);
  assert.match(handoverCore, /only needs the receiving department to confirm/);
});

test('the pharmacist is identified from the account, email as the identifier', () => {
  // User profiles carry no employee-number field, so the account email is what
  // the receipt records in its place.
  assert.match(handoverCore, /function pharmacyConfirmationFromAccount\(caller, nowIso\)/);
  assert.match(handoverCore, /fromAccount: true/);
  assert.match(handoverCore, /employeeId: cleanIdentity\(email \|\| \(caller && caller\.uid\), 60\)/);
});

test('the modal shows one code, and names who delivered', () => {
  const modal = module70.slice(module70.indexOf('function showModal(data){'), module70.indexOf('async function reissueHandoverOne('));
  assert.ok(!/pharmacyToken/.test(modal), 'no pharmacy link is built');
  assert.ok(!/handoverUrl\(data,'pharmacy'/.test(modal), 'no pharmacy URL is built');
  assert.equal((modal.match(/handoverUrl\(data,'department'/g) || []).length, 1);
  assert.equal((modal.match(/qrPanel\(/g) || []).length, 1, 'exactly one QR panel');
  assert.match(modal, /pharmacyConfirmation&&data\.pharmacyConfirmation\.name/);
});

test('the nurse is told whose delivery they are signing for', () => {
  assert.match(functionsIndex, /deliveredBy: \(session\.pharmacyConfirmation && session\.pharmacyConfirmation\.name\)/);
  assert.match(publicPage, /handover-delivered-by/);
});

test('receipts say which flow produced them', () => {
  // Existing receipts keep 'temporary_dual_qr'; new ones are single-code.
  assert.match(handoverCore, /confirmationMethod: 'temporary_qr'/);
  assert.match(module70, /value==='temporary_qr'/);
  assert.match(module70, /value==='temporary_dual_qr'/, 'older receipts must still label correctly');
});
