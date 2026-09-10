/* Runs the accountability and handover Cloud Functions for real, against the
   emulators, with no production data touched.

   These eight transactions — including the one enforcing that a department
   cannot spend past its custody balance — had unit-tested logic but had never
   been executed: this repository has no functions test harness, so the partition
   arithmetic was covered while the transaction plumbing around it was not. This
   closes that. It signs two users in through the Auth emulator, seeds a custody
   assignment, and drives the real callables over HTTP exactly as the browser
   does.

   Run with:
     npm run test:cf
*/
const PROJECT = 'demo-floorstock-cf';
const REGION = 'us-central1';
const FN = `http://127.0.0.1:5001/${PROJECT}/${REGION}`;
const AUTH = 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1';
const FS = `http://127.0.0.1:8080/v1/projects/${PROJECT}/databases/(default)/documents`;

const log = [];
function step(name, ok, detail) {
  log.push({ step: name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
}

async function signUp(email) {
  const r = await fetch(`${AUTH}/accounts:signUp?key=fake`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'password123', returnSecureToken: true }),
  });
  const b = await r.json();
  if (!b.idToken) throw new Error('signUp failed: ' + JSON.stringify(b));
  return { uid: b.localId, token: b.idToken };
}

// Firestore REST needs typed values; these documents are simple.
function enc(value) {
  if (value === null) return { nullValue: null };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(enc) } };
  if (typeof value === 'object') return { mapValue: { fields: Object.fromEntries(Object.entries(value).map(([k, v]) => [k, enc(v)])) } };
  return { stringValue: String(value) };
}
async function put(path, data) {
  const r = await fetch(`${FS}/${path}`, {
    // 'owner' bypasses rules in the emulator — this is test setup, not the app.
    method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' },
    body: JSON.stringify({ fields: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, enc(v)])) }),
  });
  if (!r.ok) throw new Error(`seed ${path}: ${await r.text()}`);
}
async function get(path) {
  const r = await fetch(`${FS}/${path}`, { headers: { Authorization: 'Bearer owner' } });
  return r.ok ? r.json() : null;
}

async function call(name, token, data) {
  const r = await fetch(`${FN}/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ data }),
  });
  const body = await r.json().catch(() => ({}));
  return { status: r.status, body };
}

const nurse = await signUp('nurse@test.local');
const pharmacist = await signUp('pharmacist@test.local');

await put(`users/${nurse.uid}`, { uid: nurse.uid, email: 'nurse@test.local', active: true, role: 'department', master: false, deptId: 'dept-a' });
await put(`users/${pharmacist.uid}`, { uid: pharmacist.uid, email: 'pharmacist@test.local', displayName: 'Ahmed Al-Qahtani', active: true, role: 'pharmacy', master: true });
await put('floorstock_state/departments', { value: [{ id: 'dept-a', name: 'Neonatal ICU' }], updatedAt: new Date().toISOString() });
await put('floorstock_state/accountability_assignments_v2', {
  value: [{ id: 'asg1', deptId: 'dept-a', medName: 'Morphine 10mg', quota: 50, balance: 50, reasons: ['Pain'], active: true }],
  updatedAt: new Date().toISOString(),
});

// 0b — the custody's clinical settings must survive the callable
let r = await call('accountabilityMutation', pharmacist.token, {
  action: 'saveAssignment', deptId: 'dept-a', medName: 'Vancomycin', quota: 10,
  reasons: ['Infection'], active: true,
  unitSize: 500, unitSizeLabel: 'mg', inputMode: 'dose', requireWeight: 'required',
  genderRestriction: 'female', pregnancyAllowed: 'caution', trimesterRestriction: 'avoid_1',
  minAge: 12, maxAge: 80,
});
/* Firestore REST returns typed fields; read the row back the way the other
   assertions in this file do. */
const plainRow = (doc, medName) => (doc?.fields?.value?.arrayValue?.values || [])
  .map((entry) => Object.fromEntries(Object.entries(entry.mapValue?.fields || {}).map(([key, value]) => [
    key,
    value.stringValue ?? (value.integerValue != null ? Number(value.integerValue)
      : value.doubleValue != null ? Number(value.doubleValue)
        : value.booleanValue ?? (value.nullValue !== undefined ? null : undefined)),
  ])))
  .find((row) => row.medName === medName) || {};
const savedVanco = plainRow(await get('floorstock_state/accountability_assignments_v2'), 'Vancomycin');
step('the concentration and clinical settings are stored, not dropped',
  r.status === 200 && savedVanco.unitSize === 500 && savedVanco.unitSizeLabel === 'mg'
  && savedVanco.inputMode === 'dose' && savedVanco.requireWeight === 'required'
  && savedVanco.genderRestriction === 'female' && savedVanco.minAge === 12,
  JSON.stringify({ unitSize: savedVanco.unitSize, inputMode: savedVanco.inputMode, minAge: savedVanco.minAge }));

// 0c — dose mode without a concentration cannot convert anything, so it is refused
r = await call('accountabilityMutation', pharmacist.token, {
  action: 'saveAssignment', deptId: 'dept-a', medName: 'No Concentration', quota: 5,
  reasons: ['Test'], active: true, inputMode: 'dose', unitSize: 0,
});
step('dose mode without a concentration is refused',
  r.status !== 200 && /concentration/i.test(JSON.stringify(r.body)), JSON.stringify(r.body?.error?.message || r.body).slice(0, 80));

// 0d — an unknown value for a restriction falls back rather than being stored
r = await call('accountabilityMutation', pharmacist.token, {
  action: 'saveAssignment', deptId: 'dept-a', medName: 'Odd Settings', quota: 5,
  reasons: ['Test'], active: true, genderRestriction: 'martian', requireWeight: 'sometimes',
});
const odd = plainRow(await get('floorstock_state/accountability_assignments_v2'), 'Odd Settings');
step('an unrecognised restriction is stored as "any", not as typed',
  r.status === 200 && odd.genderRestriction === 'any' && odd.requireWeight === 'no',
  JSON.stringify({ gender: odd.genderRestriction, weight: odd.requireWeight }));

// 1 — a department submits a usage entry
r = await call('accountabilityMutation', nurse.token, {
  action: 'submitUsage', assignmentId: 'asg1', units: 4,
  consumptionDate: new Date().toISOString().slice(0, 10),
  patientFile: 'MRN-1', doctor: 'Dr Sara', reasonLabel: 'Post-op pain',
});
const usageId = r.body?.result?.id;
step('submitUsage writes into a Hijri month partition', r.status === 200 && !!usageId, usageId || JSON.stringify(r.body));

const monthKey = (() => {
  const p = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', { year: 'numeric', month: 'numeric' }).formatToParts(new Date());
  const y = p.find(x => x.type === 'year').value, m = p.find(x => x.type === 'month').value;
  return `${y}-${String(m).padStart(2, '0')}`;
})();
const partition = await get(`floorstock_state/accountability_usage_v2_h${monthKey}`);
step('the partition document exists and is the one it should be',
  !!partition, `accountability_usage_v2_h${monthKey}`);
step('the legacy single document was not created',
  !(await get('floorstock_state/accountability_usage_v2')));

// 1b — a fraction of a unit is refused by the callable, not only by the screen
r = await call('accountabilityMutation', nurse.token, {
  action: 'submitUsage', assignmentId: 'asg1', units: 1.5,
  consumptionDate: new Date().toISOString().slice(0, 10),
  patientFile: 'MRN-1b', doctor: 'Dr Sara', reasonLabel: 'Pain',
});
step('half a unit is refused server-side',
  r.status !== 200 && /whole number/i.test(JSON.stringify(r.body)), JSON.stringify(r.body?.error?.message || r.body).slice(0, 90));

// 2 — the balance check must see the pending row across partitions
r = await call('accountabilityMutation', nurse.token, {
  action: 'submitUsage', assignmentId: 'asg1', units: 47,
  consumptionDate: new Date().toISOString().slice(0, 10),
  patientFile: 'MRN-2', doctor: 'Dr Sara', reasonLabel: 'Pain',
});
step('the custody balance is enforced across partitions',
  r.status !== 200 && /exceed/i.test(JSON.stringify(r.body)), JSON.stringify(r.body?.error?.message || r.body).slice(0, 90));

// 3 — pharmacy approves, deducting the balance
r = await call('accountabilityMutation', pharmacist.token, { action: 'decision', id: usageId, decision: 'approve', note: 'ok' });
let assignments = await get('floorstock_state/accountability_assignments_v2');
let balance = assignments?.fields?.value?.arrayValue?.values?.[0]?.mapValue?.fields?.balance;
step('approve deducts the balance', r.status === 200 && Number(balance?.integerValue ?? balance?.doubleValue) === 46,
  `balance=${balance?.integerValue ?? balance?.doubleValue}`);

// 4 — undo restores it
r = await call('accountabilityMutation', pharmacist.token, { action: 'undo_approve', id: usageId });
assignments = await get('floorstock_state/accountability_assignments_v2');
balance = assignments?.fields?.value?.arrayValue?.values?.[0]?.mapValue?.fields?.balance;
step('undo_approve restores the balance', r.status === 200 && Number(balance?.integerValue ?? balance?.doubleValue) === 50,
  `balance=${balance?.integerValue ?? balance?.doubleValue}`);

// 5 — approve again, then hand over
await call('accountabilityMutation', pharmacist.token, { action: 'decision', id: usageId, decision: 'approve', note: 'ok' });
r = await call('createAccountabilityHandover', pharmacist.token, { usageIds: [usageId], expiresInMinutes: 30 });
const session = r.body?.result;
step('createAccountabilityHandover issues ONE token, for the department',
  r.status === 200 && !!session?.departmentToken && !session?.pharmacyToken,
  session ? `department=${!!session.departmentToken} pharmacy=${!!session.pharmacyToken}` : JSON.stringify(r.body));
step('the pharmacist is stamped from the account that created it',
  session?.pharmacyConfirmation?.name === 'Ahmed Al-Qahtani' && session?.pharmacyConfirmation?.fromAccount === true,
  JSON.stringify(session?.pharmacyConfirmation || null));

// 6 — the nurse confirms, which alone completes the handover
const confirm = await fetch(`${FN}/confirmAccountabilityHandover`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ session: session.sessionId, party: 'department', token: session.departmentToken, name: 'Fatimah', employeeId: 'N-77' }),
});
const confirmBody = await confirm.json().catch(() => ({}));
step('the nurse alone completes the handover', confirm.ok && confirmBody.completed === true, JSON.stringify(confirmBody).slice(0, 120));

/* The completed handover is filed in its own Hijri month, not in a single
   accountability_receipts_v2 document — that document is the last append-forever
   custody record and would have met the same 1 MiB wall the usage rows did. The
   month is computed here the same way the function computes it, so the test
   proves the write landed where a reader will look for it. */
const hijriNow = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', { year: 'numeric', month: 'numeric' })
  .formatToParts(new Date())
  .reduce((acc, part) => (part.type === 'year' || part.type === 'month' ? { ...acc, [part.type]: Number(part.value) } : acc), {});
const receiptMonth = `${hijriNow.year}-${String(hijriNow.month).padStart(2, '0')}`;
const legacyReceipts = await get('floorstock_state/accountability_receipts_v2');
step('the legacy single receipts document is not created', !legacyReceipts?.fields,
  legacyReceipts?.fields ? 'legacy document was written' : 'absent');
const receipts = await get(`floorstock_state/accountability_receipts_v2_h${receiptMonth}`);
step('the receipt is filed in its Hijri month', !!receipts?.fields?.value?.arrayValue?.values?.length,
  `accountability_receipts_v2_h${receiptMonth}`);
const receipt = receipts?.fields?.value?.arrayValue?.values?.[0]?.mapValue?.fields;
step('the receipt names both parties',
  receipt?.pharmacyName?.stringValue === 'Ahmed Al-Qahtani' && receipt?.nurseName?.stringValue === 'Fatimah',
  `pharmacy=${receipt?.pharmacyName?.stringValue} nurse=${receipt?.nurseName?.stringValue}`);
step('the receipt records the single-code flow',
  receipt?.confirmationMethod?.stringValue === 'temporary_qr', receipt?.confirmationMethod?.stringValue);

const failed = log.filter(l => !l.ok);
console.log(`\n${log.length - failed.length}/${log.length} passed`);
process.exit(failed.length ? 1 : 0);
