/* Runs the pharmacy's Crash Cart response against the emulators, for real.

   The close moved out of the browser because the arithmetic was never checked
   and the two writes were not atomic. So the things worth proving here are not
   "does it save" but:

     the quantities are computed and enforced by the SERVER, whatever the client
     sends — an oversized deduction and an over-standard result are refused;
     the cart and the report land together, in one transaction;
     a report already answered cannot be answered twice;
     and only the roles allowed to operate a cart may do it.

   Run with:  npm run test:close
*/
const PROJECT = 'demo-floorstock-cf';
const REGION = 'us-central1';
const FN = `http://127.0.0.1:5001/${PROJECT}/${REGION}`;
const AUTH = 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1';
const FS = `http://127.0.0.1:8080/v1/projects/${PROJECT}/databases/(default)/documents`;

const log = [];
function step(name, ok, detail) {
  log.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
}

function enc(value) {
  if (value === null) return { nullValue: null };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(enc) } };
  if (typeof value === 'object') return { mapValue: { fields: Object.fromEntries(Object.entries(value).map(([k, v]) => [k, enc(v)])) } };
  return { stringValue: String(value) };
}
function dec(field) {
  if (!field) return undefined;
  if ('stringValue' in field) return field.stringValue;
  if ('integerValue' in field) return Number(field.integerValue);
  if ('doubleValue' in field) return field.doubleValue;
  if ('booleanValue' in field) return field.booleanValue;
  if ('arrayValue' in field) return (field.arrayValue.values || []).map(dec);
  if ('mapValue' in field) return Object.fromEntries(Object.entries(field.mapValue.fields || {}).map(([k, v]) => [k, dec(v)]));
  return undefined;
}
async function put(path, data) {
  const r = await fetch(`${FS}/${path}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' },
    body: JSON.stringify({ fields: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, enc(v)])) }),
  });
  if (!r.ok) throw new Error(`seed ${path}: ${await r.text()}`);
}
async function get(path) {
  const r = await fetch(`${FS}/${path}`, { headers: { Authorization: 'Bearer owner' } });
  return r.ok ? r.json() : null;
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
async function call(name, token, data) {
  const r = await fetch(`${FN}/${name}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ data: data || {} }),
  });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}

const staff = await signUp('close-staff@test.local');
const nurse = await signUp('close-nurse@test.local');
await put(`users/${staff.uid}`, { uid: staff.uid, email: 'close-staff@test.local', displayName: 'Sara', active: true, role: 'pharmacy_staff', master: false, tenantId: '' });
await put(`users/${nurse.uid}`, { uid: nurse.uid, email: 'close-nurse@test.local', active: true, role: 'department', master: false, deptId: 'dept-a', tenantId: '' });

const cart = {
  id: 'cart-close', name: 'ICU trolley', deptId: 'dept-a', seal: 'OLD-1',
  items: [{ id: 'i1', name: 'Magnesium Sulfate', qty: 2, present: 1, batches: [{ expiry: '2026-11-30', qty: 1 }] }],
};
await put('floorstock_state/crash_carts', { value: [cart], updatedAt: new Date().toISOString() });
await put('crash_cart_reports_v2/rep-close', {
  id: 'rep-close', cartId: 'cart-close', deptId: 'dept-a', status: 'pending', openedAt: '2026-09-09T06:00:00.000Z',
  consumed: [{ itemId: 'i1', qty: 1, reportedExpiry: '2026-11-30' }],
});

// 1 — a role that may not operate a cart is refused
let r = await call('closeCrashCartReport', nurse.token, { reportId: 'rep-close', newSeal: 'X', rows: [] });
step('a department cannot answer a report', r.status !== 200, String(r.body?.error?.status || r.status));

// 2 — the server refuses a deduction bigger than the batch holds
r = await call('closeCrashCartReport', staff.token, {
  reportId: 'rep-close', newSeal: 'NEW-1',
  rows: [{ itemId: 'i1', removeQty: 9, sourceExpiry: '2026-11-30', qty: 1, expiry: '2027-06-30' }],
});
step('the server refuses a deduction larger than the batch holds',
  r.status !== 200 && /less than the 9/.test(JSON.stringify(r.body)), String(r.body?.error?.message || '').slice(0, 70));

// 3 — and a result above the cart standard
r = await call('closeCrashCartReport', staff.token, {
  reportId: 'rep-close', newSeal: 'NEW-1',
  rows: [{ itemId: 'i1', removeQty: 0, qty: 5, expiry: '2027-06-30' }],
});
step('the server refuses a result above the cart standard',
  r.status !== 200 && /above the cart standard/.test(JSON.stringify(r.body)), String(r.body?.error?.message || '').slice(0, 70));

// nothing was written by either refusal
let cartDoc = await get('floorstock_state/crash_carts');
let live = dec(cartDoc.fields.value)[0];
step('a refused close changes nothing', live.seal === 'OLD-1' && live.items[0].batches.length === 1, `seal=${live.seal}`);

// 4 — a valid close
r = await call('closeCrashCartReport', staff.token, {
  reportId: 'rep-close', newSeal: 'NEW-1', pharmacyNote: 'replaced',
  rows: [{ itemId: 'i1', removeQty: 1, sourceExpiry: '2026-11-30', qty: 2, expiry: '2027-06-30' }],
});
step('a pharmacy staff member can close the report', r.status === 200 && r.body?.result?.ok === true,
  String(r.body?.error?.message || 'ok').slice(0, 80));

cartDoc = await get('floorstock_state/crash_carts');
live = dec(cartDoc.fields.value)[0];
/* By value, not by serialised text: Firestore returns a document's fields in its
   own order, so comparing JSON strings fails on identical data. */
const batches = live.items[0].batches;
step('the batches were recomputed by the server',
  batches.length === 1 && batches[0].expiry === '2027-06-30' && batches[0].qty === 2 && batches[0].addedBy === 'rep-close',
  JSON.stringify(batches));
step('the cart count follows its batches and is resealed',
  live.items[0].present === 2 && live.items[0].stockStatus === 'available' && live.seal === 'NEW-1',
  `present=${live.items[0].present} seal=${live.seal}`);

const reportDoc = await get('crash_cart_reports_v2/rep-close');
const report = Object.fromEntries(Object.entries(reportDoc.fields).map(([k, v]) => [k, dec(v)]));
step('the report landed in the same transaction',
  report.status === 'closed' && report.newSeal === 'NEW-1' && report.closedByName === 'Sara',
  `${report.status} by ${report.closedByName}`);

// 5 — and cannot be answered twice
r = await call('closeCrashCartReport', staff.token, {
  reportId: 'rep-close', newSeal: 'NEW-2', rows: [{ itemId: 'i1', removeQty: 0, qty: 0 }],
});
step('an answered report cannot be answered again',
  r.status !== 200 && /already been answered/.test(JSON.stringify(r.body)), String(r.body?.error?.message || '').slice(0, 60));

const failed = log.filter((entry) => !entry.ok);
console.log(`\n${log.length - failed.length}/${log.length} passed`);
process.exit(failed.length ? 1 : 0);
