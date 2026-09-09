/* Runs the scheduled upkeep against the emulators, with real documents.

   This is the job that deletes rows on a timer with nobody watching, so the
   things worth proving are not "does it work" but:

     it does nothing while disabled;
     a dry run reports and changes NOTHING;
     it never touches a record — only the two declared instrumentation classes;
     running it twice changes nothing the second time.

   The last one is the test my migration failed in production this morning.

   Run with:  npm run test:upkeep
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
    method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' },
    body: JSON.stringify({ fields: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, enc(v)])) }),
  });
  if (!r.ok) throw new Error(`seed ${path}: ${await r.text()}`);
}
async function get(path) {
  const r = await fetch(`${FS}/${path}`, { headers: { Authorization: 'Bearer owner' } });
  return r.ok ? r.json() : null;
}
function rows(doc) {
  return (doc?.fields?.value?.arrayValue?.values || []).map((v) => v.mapValue?.fields || {});
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

const daysAgo = (days) => new Date(Date.now() - days * 86400000).toISOString();
const master = await signUp('master-upkeep@test.local');
await put(`users/${master.uid}`, { uid: master.uid, email: 'master-upkeep@test.local', active: true, role: 'pharmacy', master: true, tenantId: '' });

/* Instrumentation, half of it older than its 400-day ceiling. */
await put('floorstock_state/user_activity_daily_v1_g2026-09', {
  value: [{ id: 'u1_2026-09-01', date: daysAgo(5), activeMinutes: 10 }],
  updatedAt: new Date().toISOString(),
});
await put('floorstock_state/user_activity_daily_v1_g2023-01', {
  value: [{ id: 'u1_2023-01-05', date: daysAgo(900), activeMinutes: 3 }],
  updatedAt: new Date().toISOString(),
});
/* A record of the same age, which must be untouched whatever happens. */
await put('floorstock_state/requests_g2023-01', {
  value: [{ id: 'req_old', created: daysAgo(900), deptId: 'dept-a' }],
  updatedAt: new Date().toISOString(),
});
/* Duplicated rows, of the kind a re-run migration wrote. */
await put('floorstock_state/dept_notes_g2026-08', {
  value: [{ id: 'n1', body: 'x' }, { id: 'n2', body: 'y' }],
  updatedAt: new Date().toISOString(),
});
await put('floorstock_state/dept_notes_g2026-09', {
  value: [{ id: 'n2', body: 'y' }, { id: 'n3', body: 'z' }],
  updatedAt: new Date().toISOString(),
});

// 1 — disabled by default: it must do nothing at all
let r = await call('runUpkeepNow', master.token);
step('it does nothing until a master turns it on',
  r.status === 200 && r.body?.result?.run?.skipped === true, JSON.stringify(r.body?.result?.run || r.body).slice(0, 90));

// 2 — dry run: reports, changes nothing
await call('setUpkeepSettings', master.token, { enabled: true, dryRun: true });
r = await call('runUpkeepNow', master.token);
const dry = r.body?.result?.run;
step('a dry run reports what it would do', r.status === 200 && dry?.dryRun === true && dry.changes.length > 0,
  `${dry?.changes?.length} change(s) planned`);
step('a dry run changes nothing',
  rows(await get('floorstock_state/user_activity_daily_v1_g2023-01')).length === 1
  && rows(await get('floorstock_state/dept_notes_g2026-09')).length === 2, 'documents untouched');

// 3 — for real
await call('setUpkeepSettings', master.token, { dryRun: false });
r = await call('runUpkeepNow', master.token);
const applied = r.body?.result?.run;
step('applied without failures', r.status === 200 && applied?.dryRun === false && applied.failures.length === 0,
  JSON.stringify(applied?.failures || []).slice(0, 120));

const expiredActivity = await get('floorstock_state/user_activity_daily_v1_g2023-01');
step('instrumentation past its ceiling is gone', expiredActivity === null || rows(expiredActivity).length === 0, 'user_activity_daily_v1_g2023-01');
const recentActivity = await get('floorstock_state/user_activity_daily_v1_g2026-09');
step('recent instrumentation is kept', rows(recentActivity).length === 1, 'user_activity_daily_v1_g2026-09');

const oldOrder = await get('floorstock_state/requests_g2023-01');
step('a RECORD of the same age is untouched', rows(oldOrder).length === 1, 'requests_g2023-01 — orders never rotate');

const notes = rows(await get('floorstock_state/dept_notes_g2026-09')).map((f) => f.id?.stringValue);
step('the duplicated row is removed, the first occurrence kept', notes.length === 1 && notes[0] === 'n3', notes.join(','));
step('the other month keeps both of its own rows', rows(await get('floorstock_state/dept_notes_g2026-08')).length === 2, 'dept_notes_g2026-08');

// 4 — the test this morning's migration failed
r = await call('runUpkeepNow', master.token);
const second = r.body?.result?.run;
step('running it again changes nothing', r.status === 200 && second.changes.length === 0,
  `${second?.changes?.length} change(s) on the second run`);

// 5 — the run is written down where somebody can see it
const settings = await get('system/upkeep_settings');
step('every run is recorded', !!settings?.fields?.lastRun, settings?.fields?.lastRun ? 'lastRun present' : 'missing');

const failed = log.filter((entry) => !entry.ok);
console.log(`\n${log.length - failed.length}/${log.length} passed`);
process.exit(failed.length ? 1 : 0);
