'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const core = fs.readFileSync(
  'public/assets/js/modules/03-core-application-firebase-state-auth.js',
  'utf8'
);

const users = fs.readFileSync(
  'public/assets/js/modules/07-expiry-requests-and-primary-features.js',
  'utf8'
);

test('Firebase Functions loader publishes and returns the initialized client', () => {
  assert.match(core, /window\.FB_FUNCTIONS=FB_FUNCTIONS/);
  assert.match(
    core,
    /FB_FUNCTIONS&&typeof FB_FUNCTIONS\.httpsCallable==='function'/
  );
  assert.match(
    core,
    /window\.FB_FUNCTIONS&&typeof window\.FB_FUNCTIONS\.httpsCallable==='function'/
  );
  assert.match(core, /return FB_FUNCTIONS/);
});

test('user management uses the central authenticated callable transport', () => {
  assert.doesNotMatch(users, /FB_FUNCTIONS\.httpsCallable/);
  for (const callable of [
    'createManagedUser',
    'deleteManagedUser',
    'setMasterAccess',
  ]) {
    assert.match(
      users,
      new RegExp(
        String.raw`window\.fsCallFunction\('${callable}'`
      )
    );
  }
  assert.match(core, /async function fsCallFunction\(name,data\)/);
  assert.match(core, /'Authorization':'Bearer '\+token/);
});

test('managed-user directory is loaded through the authoritative callable first', () => {
  assert.match(core, /users=await fsStateLoadUsersViaCallable\(\)/);
  assert.doesNotMatch(core, /loadUsers:async function\(\)\{\s*var users=await fsStateFirstSuccess/);
  assert.match(core, /Always refresh through the canonical directory callable/);
});

test('the production entrypoint cache version advances with authenticated-operation fixes', () => {
  const index = fs.readFileSync('public/index.html', 'utf8');
  assert.match(index, /assets\/js\/main\.js\?v=R6\.76\.23/);
  assert.match(core, /window\.__fsAuthenticatedUser=credential\.user/);
  assert.match(core, /remembered&&window\.CU&&String\(remembered\.uid\|\|''\)===String\(CU\.id\|\|''\)/);
  assert.match(core, /window\.__fsAuthenticatedUser=null/);
});
