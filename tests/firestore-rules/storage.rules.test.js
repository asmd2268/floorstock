import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { after, before, describe, test } from 'node:test';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { ref, uploadString, getBytes, deleteObject } from 'firebase/storage';
import { doc, setDoc } from 'firebase/firestore';

/* Archive files are the only full-detail copy of what an archive removes from
   Firestore, and the custody archive carries patient file numbers, doctors and
   reasons for dispensing. That is why they live here rather than in a shared
   spreadsheet or an inbox: rules decide who reads them, not a link. */

const PROJECT_ID = 'demo-floorstock-storage';
let env;

const ARCHIVE = 'archives/Orders/ASDHealth_Orders_2024-01-01_to_2024-06-30_saved_2026-09-09.json';

before(async () => {
  env = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    storage: { rules: await readFile('storage.rules', 'utf8') },
    firestore: { rules: await readFile('firestore.rules', 'utf8') },
  });
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, 'users', 'master'), { active: true, role: 'pharmacy', master: true });
    await setDoc(doc(db, 'users', 'pharmacy'), { active: true, role: 'pharmacy', master: false });
    await setDoc(doc(db, 'users', 'department'), { active: true, role: 'department', master: false, deptId: 'dept-a' });
    await setDoc(doc(db, 'users', 'retired_master'), { active: false, role: 'pharmacy', master: true });
  });
});

after(async () => { await env.cleanup(); });

function storageFor(uid) {
  return uid === null
    ? env.unauthenticatedContext().storage()
    : env.authenticatedContext(uid).storage();
}

describe('archive storage', () => {
  test('a master can write and read an archive', async () => {
    const store = storageFor('master');
    await assertSucceeds(uploadString(ref(store, ARCHIVE), '{"manifest":{}}', 'raw', { contentType: 'application/json' }));
    await assertSucceeds(getBytes(ref(store, ARCHIVE)));
  });

  test('nobody else can read one, whatever their role', async () => {
    for (const uid of [null, 'pharmacy', 'department']) {
      await assertFails(getBytes(ref(storageFor(uid), ARCHIVE)));
    }
  });

  test('a master whose account was deactivated loses access', async () => {
    await assertFails(getBytes(ref(storageFor('retired_master'), ARCHIVE)));
    await assertFails(uploadString(ref(storageFor('retired_master'), 'archives/Orders/x.json'), '{}', 'raw', { contentType: 'application/json' }));
  });

  test('an archive cannot be overwritten', async () => {
    // Overwriting would destroy the only copy of what that file holds.
    await assertFails(uploadString(ref(storageFor('master'), ARCHIVE), '{"replaced":true}', 'raw', { contentType: 'application/json' }));
  });

  test('nothing outside archives/ is writable', async () => {
    await assertFails(uploadString(ref(storageFor('master'), 'somewhere/else.json'), '{}', 'raw', { contentType: 'application/json' }));
    await assertFails(getBytes(ref(storageFor('master'), 'somewhere/else.json')));
  });

  test('only a master may remove an archive', async () => {
    await assertFails(deleteObject(ref(storageFor('pharmacy'), ARCHIVE)));
    await assertSucceeds(deleteObject(ref(storageFor('master'), ARCHIVE)));
  });
});
