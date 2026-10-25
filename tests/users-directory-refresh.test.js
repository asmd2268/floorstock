import test from 'node:test';
import assert from 'node:assert/strict';
import { canManageUsers, refreshUsersDirectory } from '../public/assets/js/core/users-directory-refresh.js';

test('master, pharmacy and pharmacy director manage users; nobody else does', () => {
  assert.equal(canManageUsers({ master: true, role: 'department' }), true);
  assert.equal(canManageUsers({ role: 'pharmacy' }), true);
  assert.equal(canManageUsers({ role: 'pharmacy_director' }), true);
  assert.equal(canManageUsers({ role: 'department' }), false);
  assert.equal(canManageUsers({ role: 'controlled_pharmacy' }), false);
  assert.equal(canManageUsers(null), false);
});

const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

async function run({ before, after, onUsersPage }) {
  const cache = { users: before };
  let refreshes = 0;
  await refreshUsersDirectory({
    cache,
    loadUsers: async () => { cache.users = after; return after; },
    valuesEqual: eq,
    usersPageActive: () => onUsersPage,
    scheduleRefresh: () => { refreshes += 1; },
  });
  return refreshes;
}

test('a changed list redraws only when the Users page is on screen', async () => {
  assert.equal(await run({ before: [1], after: [1, 2], onUsersPage: true }), 1);
  assert.equal(await run({ before: [1], after: [1, 2], onUsersPage: false }), 0);
});

test('an unchanged list never redraws', async () => {
  assert.equal(await run({ before: [1], after: [1], onUsersPage: true }), 0);
});

test('a missing list compares as empty', async () => {
  assert.equal(await run({ before: undefined, after: [], onUsersPage: true }), 0);
  assert.equal(await run({ before: undefined, after: undefined, onUsersPage: true }), 0);
});

test('a failed load rejects so the caller can warn, and redraws nothing', async () => {
  let refreshes = 0;
  await assert.rejects(refreshUsersDirectory({
    cache: {}, loadUsers: async () => { throw new Error('offline'); },
    valuesEqual: eq, usersPageActive: () => true, scheduleRefresh: () => { refreshes += 1; },
  }));
  assert.equal(refreshes, 0);
});
