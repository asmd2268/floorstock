import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, test } from 'node:test';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment
} from '@firebase/rules-unit-testing';
import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setLogLevel,
  setDoc,
  updateDoc
} from 'firebase/firestore';
import {
  APPLICATION_STATE_KEYS,
  DEPARTMENT_ID,
  mayWriteState
} from './application-state-keys.js';

const PROJECT_ID = 'demo-floorstock-rules';
const OTHER_DEPARTMENT_ID = 'dept-b';
let env;
setLogLevel('silent');

const profiles = {
  inactive: { active: false, role: 'department', master: false, deptId: DEPARTMENT_ID },
  department: { active: true, role: 'department', master: false, deptId: DEPARTMENT_ID },
  custodian: {
    active: true,
    role: 'department',
    master: false,
    deptId: DEPARTMENT_ID,
    controlledCustodian: true
  },
  pharmacy_staff: { active: true, role: 'pharmacy_staff', master: false },
  inpatient_supervisor: { active: true, role: 'inpatient_supervisor', master: false },
  controlled_pharmacy: { active: true, role: 'controlled_pharmacy', master: false },
  warehouse: { active: true, role: 'warehouse', master: false },
  pharmacy: { active: true, role: 'pharmacy', master: false },
  master: { active: true, role: 'pharmacy', master: true },
  forged_master: { active: true, role: 'department', master: true, deptId: DEPARTMENT_ID }
};

const activeRoles = [
  'department',
  'custodian',
  'pharmacy_staff',
  'inpatient_supervisor',
  'controlled_pharmacy',
  'warehouse',
  'pharmacy',
  'master'
];

function dbFor(name) {
  if (name === 'anonymous') return env.unauthenticatedContext().firestore();
  return env.authenticatedContext(name, { email: `${name}@example.test` }).firestore();
}

function statePayload(value = []) {
  return { value, updatedAt: Timestamp.now() };
}

async function seed(path, value) {
  await env.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), path), value);
  });
}

before(async () => {
  env = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: await readFile('firestore.rules', 'utf8') }
  });
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (context) => {
    const admin = context.firestore();
    await Promise.all(Object.entries(profiles).map(([uid, profile]) =>
      setDoc(doc(admin, 'users', uid), { uid, email: `${uid}@example.test`, ...profile })
    ));
    await setDoc(doc(admin, 'system', 'master'), { uid: 'master', updatedAt: Timestamp.now() });
  });
});

after(async () => {
  await env.cleanup();
});

describe('anonymous and inactive accounts', () => {
  test('anonymous can read only individual public QR documents', async () => {
    const db = dbFor('anonymous');
    await assertSucceeds(getDoc(doc(db, 'public_expiry', DEPARTMENT_ID)));
    await assertSucceeds(getDoc(doc(db, 'public_controlled_expiry', DEPARTMENT_ID)));
    await assertSucceeds(getDoc(doc(db, 'public_controlled_expiry', 'crash_cart-a')));
    await assertFails(getDocs(collection(db, 'public_expiry')));
    await assertFails(getDocs(collection(db, 'public_controlled_expiry')));
    await assertFails(getDoc(doc(db, 'floorstock_state', 'theme')));
    await assertFails(getDoc(doc(db, 'users', 'department')));
    await assertFails(getDoc(doc(db, 'system', 'master')));
    await assertFails(getDoc(doc(db, 'public_crash_carts', 'cart-a')));
  });

  test('inactive user may load their own profile but no operational data', async () => {
    const db = dbFor('inactive');
    await assertSucceeds(getDoc(doc(db, 'users', 'inactive')));
    await assertFails(getDoc(doc(db, 'users', 'department')));
    await assertFails(getDoc(doc(db, 'floorstock_state', 'theme')));
    await assertFails(setDoc(doc(db, 'floorstock_state', 'theme'), statePayload('dark')));
    await assertFails(setDoc(doc(db, 'public_expiry', DEPARTMENT_ID), { updatedAt: Timestamp.now() }));
    await assertFails(getDoc(doc(db, 'system', 'master')));
  });
});

describe('users and system/master', () => {
  for (const role of activeRoles) {
    test(`${role} can read own user profile`, async () => {
      await assertSucceeds(getDoc(doc(dbFor(role), 'users', role)));
    });
  }

  for (const role of ['department', 'custodian', 'pharmacy_staff', 'inpatient_supervisor', 'controlled_pharmacy', 'warehouse']) {
    test(`${role} cannot read another profile or list users`, async () => {
      const db = dbFor(role);
      await assertFails(getDoc(doc(db, 'users', 'master')));
      await assertFails(getDocs(collection(db, 'users')));
    });
  }

  for (const role of ['pharmacy', 'master']) {
    test(`${role} can read and list user profiles`, async () => {
      const db = dbFor(role);
      await assertSucceeds(getDoc(doc(db, 'users', 'department')));
      await assertSucceeds(getDocs(collection(db, 'users')));
    });
  }

  for (const role of ['anonymous', 'inactive', ...activeRoles]) {
    test(`${role} cannot write users or access system/master`, async () => {
      const db = dbFor(role);
      const ownId = role === 'anonymous' ? 'department' : role;
      await assertFails(setDoc(doc(db, 'users', 'new-user'), { active: true, role: 'department' }));
      await assertFails(updateDoc(doc(db, 'users', ownId), { active: false }));
      await assertFails(deleteDoc(doc(db, 'users', ownId)));
      await assertFails(getDoc(doc(db, 'system', 'master')));
      await assertFails(setDoc(doc(db, 'system', 'master'), { uid: role }));
    });
  }

  test('a non-pharmacy profile cannot become master by setting master=true', async () => {
    const db = dbFor('forged_master');
    await assertFails(getDocs(collection(db, 'users')));
    await assertFails(setDoc(doc(db, 'public_crash_carts', 'cart-a'), { legacy: true }));
    await assertFails(setDoc(doc(db, 'floorstock_backups', 'forged_master', 'snapshots', 'one'), { ok: true }));
  });
});

describe('floorstock_state reads, shapes, keys, and deletes', () => {
  test('all active roles can read shared state, anonymous and inactive cannot', async () => {
    await seed('floorstock_state/theme', statePayload('dark'));
    for (const role of activeRoles) {
      await assertSucceeds(getDoc(doc(dbFor(role), 'floorstock_state', 'theme')));
      await assertSucceeds(getDocs(collection(dbFor(role), 'floorstock_state')));
    }
    await assertFails(getDoc(doc(dbFor('anonymous'), 'floorstock_state', 'theme')));
    await assertFails(getDoc(doc(dbFor('inactive'), 'floorstock_state', 'theme')));
  });

  for (const role of activeRoles) {
    test(`${role} has the expected write result for every application state key`, async () => {
      const db = dbFor(role);
      for (const key of APPLICATION_STATE_KEYS) {
        const operation = setDoc(doc(db, 'floorstock_state', key), statePayload({ role, key }));
        if (mayWriteState(role, key)) await assertSucceeds(operation);
        else await assertFails(operation);
      }
    });
  }

  test('department and custodian are limited to their assigned department key families', async () => {
    for (const role of ['department', 'custodian']) {
      const db = dbFor(role);
      for (const prefix of ['meds_', 'expiry_', 'shelves_', 'controlled_dept_list_', 'controlled_dept_shelves_', 'controlled_settings_']) {
        await assertSucceeds(setDoc(doc(db, 'floorstock_state', `${prefix}${DEPARTMENT_ID}`), statePayload([])));
        await assertFails(setDoc(doc(db, 'floorstock_state', `${prefix}${OTHER_DEPARTMENT_ID}`), statePayload([])));
      }
    }
  });

  test('allowed writers must preserve the exact state document shape', async () => {
    const db = dbFor('master');
    await assertFails(setDoc(doc(db, 'floorstock_state', 'theme'), { value: 'dark' }));
    await assertFails(setDoc(doc(db, 'floorstock_state', 'theme'), { value: 'dark', updatedAt: 'now' }));
    await assertFails(setDoc(doc(db, 'floorstock_state', 'theme'), { ...statePayload('dark'), extra: true }));
    await assertSucceeds(setDoc(doc(db, 'floorstock_state', 'theme'), statePayload('dark')));
  });

  test('only pharmacy director and master may delete state documents', async () => {
    for (const role of activeRoles) {
      const key = `delete-${role}`;
      await seed(`floorstock_state/${key}`, statePayload([]));
      const operation = deleteDoc(doc(dbFor(role), 'floorstock_state', key));
      if (role === 'pharmacy' || role === 'master') await assertSucceeds(operation);
      else await assertFails(operation);
    }
  });
});

describe('public QR collections', () => {
  const publicManagers = new Set(['department', 'custodian', 'inpatient_supervisor', 'pharmacy', 'master']);
  const controlledManagers = new Set(['department', 'custodian', 'inpatient_supervisor', 'controlled_pharmacy', 'warehouse', 'pharmacy', 'master']);

  for (const role of activeRoles) {
    test(`${role} public expiry permissions are scoped correctly`, async () => {
      const db = dbFor(role);
      const own = setDoc(doc(db, 'public_expiry', DEPARTMENT_ID), { updatedAt: Timestamp.now() });
      if (publicManagers.has(role)) await assertSucceeds(own);
      else await assertFails(own);

      const other = setDoc(doc(db, 'public_expiry', OTHER_DEPARTMENT_ID), { updatedAt: Timestamp.now() });
      if (['inpatient_supervisor', 'pharmacy', 'master'].includes(role)) await assertSucceeds(other);
      else await assertFails(other);

      const listing = getDocs(collection(db, 'public_expiry'));
      if (role === 'master') await assertSucceeds(listing);
      else await assertFails(listing);
    });

    test(`${role} controlled and crash QR writes are scoped correctly`, async () => {
      const db = dbFor(role);
      const own = setDoc(doc(db, 'public_controlled_expiry', DEPARTMENT_ID), { updatedAt: Timestamp.now() });
      if (controlledManagers.has(role)) await assertSucceeds(own);
      else await assertFails(own);

      const crash = setDoc(doc(db, 'public_controlled_expiry', 'crash_cart-a'), { updatedAt: Timestamp.now() });
      if (['pharmacy_staff', 'inpatient_supervisor', 'controlled_pharmacy', 'warehouse', 'pharmacy', 'master'].includes(role)) {
        await assertSucceeds(crash);
      } else {
        await assertFails(crash);
      }

      const listing = getDocs(collection(db, 'public_controlled_expiry'));
      if (role === 'master') await assertSucceeds(listing);
      else await assertFails(listing);
    });
  }

  test('pharmacy_staff may update crash QR but not controlled department or storage QR documents', async () => {
    const db = dbFor('pharmacy_staff');
    await assertSucceeds(setDoc(doc(db, 'public_controlled_expiry', 'crash_cart-a'), { updatedAt: Timestamp.now() }));
    await assertFails(setDoc(doc(db, 'public_controlled_expiry', DEPARTMENT_ID), { updatedAt: Timestamp.now() }));
    await assertFails(setDoc(doc(db, 'public_controlled_expiry', 'storage_pharmacy_unit-a'), { updatedAt: Timestamp.now() }));
  });

  test('public QR update and delete permissions match production policy', async () => {
    await seed('public_expiry/update-me', { revision: 1 });
    await seed('public_expiry/delete-me', { revision: 1 });
    await seed('public_controlled_expiry/update-me', { revision: 1 });
    await seed('public_controlled_expiry/delete-me', { revision: 1 });

    for (const role of activeRoles) {
      const db = dbFor(role);
      const mayManageAll = role === 'pharmacy' || role === 'master';
      const expiryUpdate = updateDoc(doc(db, 'public_expiry', 'update-me'), { revision: 2 });
      const controlledUpdate = updateDoc(doc(db, 'public_controlled_expiry', 'update-me'), { revision: 2 });
      if (['inpatient_supervisor', 'pharmacy', 'master'].includes(role)) await assertSucceeds(expiryUpdate);
      else await assertFails(expiryUpdate);
      if (['inpatient_supervisor', 'controlled_pharmacy', 'warehouse', 'pharmacy', 'master'].includes(role)) await assertSucceeds(controlledUpdate);
      else await assertFails(controlledUpdate);

      await seed(`public_expiry/delete-${role}`, { revision: 1 });
      await seed(`public_controlled_expiry/delete-${role}`, { revision: 1 });
      const expiryDelete = deleteDoc(doc(db, 'public_expiry', `delete-${role}`));
      const controlledDelete = deleteDoc(doc(db, 'public_controlled_expiry', `delete-${role}`));
      if (mayManageAll) {
        await assertSucceeds(expiryDelete);
        await assertSucceeds(controlledDelete);
      } else {
        await assertFails(expiryDelete);
        await assertFails(controlledDelete);
      }
    }
  });

  test('legacy public_crash_carts is private and writable only by master', async () => {
    for (const role of ['anonymous', 'inactive', ...activeRoles]) {
      const db = dbFor(role);
      await assertFails(getDoc(doc(db, 'public_crash_carts', 'cart-a')));
      const write = setDoc(doc(db, 'public_crash_carts', `cart-${role}`), { legacy: true });
      if (role === 'master') await assertSucceeds(write);
      else await assertFails(write);
    }
    await assertSucceeds(updateDoc(doc(dbFor('master'), 'public_crash_carts', 'cart-master'), { legacy: false }));
    await assertSucceeds(deleteDoc(doc(dbFor('master'), 'public_crash_carts', 'cart-master')));
  });
});

describe('audit logs and cloud backups', () => {
  test('separate audit_logs are readable by pharmacy/master and client-writable by nobody', async () => {
    await seed('audit_logs/event-a', { action: 'seed', createdAt: Timestamp.now() });
    for (const role of ['anonymous', 'inactive', ...activeRoles]) {
      const db = dbFor(role);
      const read = getDoc(doc(db, 'audit_logs', 'event-a'));
      if (role === 'pharmacy' || role === 'master') await assertSucceeds(read);
      else await assertFails(read);
      await assertFails(setDoc(doc(db, 'audit_logs', `event-${role}`), { action: 'client-write' }));
      await assertFails(updateDoc(doc(db, 'audit_logs', 'event-a'), { action: 'client-update' }));
      await assertFails(deleteDoc(doc(db, 'audit_logs', 'event-a')));
    }
  });

  test('only actual master may manage their own backup snapshot and chunks', async () => {
    const snapshotPath = (uid) => doc(dbFor(uid), 'floorstock_backups', uid, 'snapshots', 'snapshot-a');
    const chunkPath = (uid) => doc(dbFor(uid), 'floorstock_backups', uid, 'snapshots', 'snapshot-a', 'chunks', '0000');

    await assertSucceeds(setDoc(snapshotPath('master'), { createdAt: Timestamp.now(), chunks: 1 }));
    await assertSucceeds(setDoc(chunkPath('master'), { index: 0, data: 'encrypted-in-transit' }));
    await assertSucceeds(getDoc(snapshotPath('master')));
    await assertSucceeds(deleteDoc(chunkPath('master')));

    for (const role of ['inactive', 'department', 'custodian', 'pharmacy_staff', 'inpatient_supervisor', 'controlled_pharmacy', 'warehouse', 'pharmacy', 'forged_master']) {
      await assertFails(setDoc(snapshotPath(role), { createdAt: Timestamp.now() }));
    }

    await assertFails(setDoc(doc(dbFor('master'), 'floorstock_backups', 'pharmacy', 'snapshots', 'snapshot-a'), { createdAt: Timestamp.now() }));
  });
});

describe('crash cart and Medication Accountability regression coverage', () => {
  test('pharmacy_staff can perform required crash cart and accountability state writes without master capabilities', async () => {
    const db = dbFor('pharmacy_staff');
    for (const key of [
      'crash_carts',
      'crash_cart_reports',
      'accountability_assignments_v2',
      'accountability_usage_v2',
      'accountability_receipts_v2',
      'accountability_regimens_v2'
    ]) {
      await assertSucceeds(setDoc(doc(db, 'floorstock_state', key), statePayload([])));
    }
    await assertFails(getDocs(collection(db, 'users')));
    await assertFails(setDoc(doc(db, 'public_crash_carts', 'cart-a'), { legacy: true }));
    await assertFails(setDoc(doc(db, 'floorstock_backups', 'pharmacy_staff', 'snapshots', 'one'), { createdAt: Timestamp.now() }));
  });

  test('master seal correction storage path is available to master', async () => {
    const db = dbFor('master');
    await seed('floorstock_state/crash_carts', statePayload([{ id: 'cart-a', seal: 'OLD' }]));
    await assertSucceeds(setDoc(doc(db, 'floorstock_state', 'crash_carts'), statePayload([{ id: 'cart-a', seal: 'NEW' }])));
  });

  test('application exposes seal correction only behind the actual-master gate', async () => {
    const runtime = await readFile('public/assets/js/modules/59-r664-security-complete-runtime.js', 'utf8');
    const correction = runtime.slice(
      runtime.indexOf('window.r664OpenSealCorrection'),
      runtime.indexOf('function installSealButtons')
    );
    assert.notEqual(correction.length, 0);
    assert.equal((correction.match(/if\(!actualMaster\(\)\)/g) || []).length, 2);
    assert.match(correction, /crash_cart_master_seal_correction/);
    assert.match(correction, /openingLog:false/);
  });
});

describe('default deny for unused or accidental collections', () => {
  for (const role of ['anonymous', 'inactive', ...activeRoles]) {
    test(`${role} cannot access undefined collections`, async () => {
      const db = dbFor(role);
      await assertFails(getDoc(doc(db, 'departments', 'dept-a')));
      await assertFails(setDoc(doc(db, 'departments', 'dept-a'), { name: 'ICU' }));
      await assertFails(getDoc(doc(db, 'unknown_collection', 'doc-a')));
      await assertFails(setDoc(doc(db, 'unknown_collection', 'doc-a'), { value: true }));
    });
  }
});
