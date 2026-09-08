import assert from 'node:assert/strict';
import { test, beforeEach } from 'node:test';

/* Temporary, master-granted permission to export the controlled ledger.

   Exporting lifts full per-movement detail, patient context included, out of the
   system as a file — so it is not a standing ability, but it is one a master
   needs to delegate for an audit or a due report. The grant is therefore a record
   with an expiry: nothing has to be remembered or revoked for it to end. */

const state = { cache: {} };
globalThis.S = {
  cache: state.cache,
  g: (key) => (Object.prototype.hasOwnProperty.call(state.cache, key) ? state.cache[key] : null),
  s: async (key, value) => { state.cache[key] = value; },
};
globalThis.toast = () => {};
globalThis.auditAction = async () => {};

const grants = await import('../public/assets/js/core/export-grants.js');

function asOfficer() { globalThis.CU = { username: 'officer1', master: false, role: 'controlled_pharmacy' }; }
function asMaster() { globalThis.CU = { username: 'boss', master: true, role: 'pharmacy' }; }

beforeEach(() => { state.cache[grants.EXPORT_GRANTS_KEY] = []; });

test('a master may always export; anyone else needs a grant', async () => {
  asMaster();
  assert.equal(grants.mayExportMonths(['1448-03']), true);
  asOfficer();
  assert.equal(grants.mayExportMonths(['1448-03']), false);
  assert.match(grants.exportPermissionReason(['1448-03']), /temporary permission from the Master/);
});

test('a grant covers exactly the months it names', async () => {
  asMaster();
  await grants.grantExportPermission({ userKey: 'officer1', fromMonth: '1448-01', toMonth: '1448-03', hours: 2 });
  asOfficer();
  assert.equal(grants.mayExportMonths(['1448-01', '1448-02', '1448-03']), true);
  assert.equal(grants.mayExportMonths(['1448-04']), false);
  // A range that is only partly covered is refused outright rather than
  // quietly exporting the covered half.
  assert.equal(grants.mayExportMonths(['1448-03', '1448-04']), false);
});

test('a grant belongs to one user', async () => {
  asMaster();
  await grants.grantExportPermission({ userKey: 'officer1', fromMonth: '1448-03', toMonth: '1448-03', hours: 2 });
  globalThis.CU = { username: 'officer2', master: false, role: 'controlled_pharmacy' };
  assert.equal(grants.mayExportMonths(['1448-03']), false);
});

test('an expired grant stops matching without anyone revoking it', async () => {
  state.cache[grants.EXPORT_GRANTS_KEY] = [{
    id: 'g1', userKey: 'officer1', fromMonth: '1448-01', toMonth: '1448-03',
    grantedAt: '2026-01-01T00:00:00.000Z',
    expiresAt: new Date(Date.now() - 1000).toISOString(),
    revokedAt: '',
  }];
  asOfficer();
  assert.equal(grants.mayExportMonths(['1448-02']), false);
  assert.deepEqual(grants.liveGrantsFor('officer1'), []);
});

test('a master can revoke early', async () => {
  asMaster();
  const grant = await grants.grantExportPermission({ userKey: 'officer1', fromMonth: '1448-03', toMonth: '1448-03', hours: 24 });
  asOfficer();
  assert.equal(grants.mayExportMonths(['1448-03']), true);
  asMaster();
  await grants.revokeExportPermission(grant.id);
  asOfficer();
  assert.equal(grants.mayExportMonths(['1448-03']), false);
});

test('only a master issues or revokes a grant', async () => {
  asOfficer();
  assert.equal(await grants.grantExportPermission({ userKey: 'officer1', fromMonth: '1448-03', toMonth: '1448-03', hours: 24 }), null);
  assert.deepEqual(state.cache[grants.EXPORT_GRANTS_KEY], [], 'nothing may be written by a non-master');
  assert.equal(await grants.revokeExportPermission('anything'), false);
});

test('a grant cannot outlive its reason', async () => {
  asMaster();
  // Capped at 30 days, and a bad or missing duration falls back to a day.
  const long = await grants.grantExportPermission({ userKey: 'u', fromMonth: '1448-01', toMonth: '1448-01', hours: 99999 });
  const hours = (Date.parse(long.expiresAt) - Date.parse(long.grantedAt)) / 3600000;
  assert.ok(hours <= 720, `expected a cap, got ${hours}h`);
  const missing = await grants.grantExportPermission({ userKey: 'u', fromMonth: '1448-01', toMonth: '1448-01' });
  assert.equal(Math.round((Date.parse(missing.expiresAt) - Date.parse(missing.grantedAt)) / 3600000), 24);
});

test('a malformed range is refused', async () => {
  asMaster();
  assert.equal(await grants.grantExportPermission({ userKey: 'u', fromMonth: '1448-05', toMonth: '1448-02', hours: 2 }), null, 'reversed');
  assert.equal(await grants.grantExportPermission({ userKey: 'u', fromMonth: 'nope', toMonth: '1448-02', hours: 2 }), null, 'not a month');
  assert.equal(await grants.grantExportPermission({ userKey: '', fromMonth: '1448-01', toMonth: '1448-01', hours: 2 }), null, 'no user');
});
