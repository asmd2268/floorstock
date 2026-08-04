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

test('user management never dereferences the nullable global Functions handle', () => {
  assert.doesNotMatch(users, /FB_FUNCTIONS\.httpsCallable/);

  for (const callable of [
    'createManagedUser',
    'deleteManagedUser',
    'setMasterAccess',
  ]) {
    assert.match(
      users,
      new RegExp(
        String.raw`functionsClient\.httpsCallable\('${callable}'\)`
      )
    );
  }
});
