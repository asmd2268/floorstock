'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const core = [
  '03-core-application-firebase-state-auth.js',
  '03b-controlled-psychotropic-medicines.js',
  '03c-medication-expiry-shelf-helpers.js',
  '03d-seed-medication-catalog.js',
  '03e-date-dialog-permission-helpers.js',
  '03f-app-shell-nav-dashboard-inventory.js',
].map((name) => fs.readFileSync(`public/assets/js/modules/${name}`, 'utf8')).join('\n');

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

test('managed-user directory uses the authenticated callable before any legacy client fallback', () => {
  assert.match(core, /users=await fsStateLoadUsersViaCallable\(\)/);
  assert.match(core, /async function fsStateLoadLegacyUserDirectory\(\)/);
  assert.match(core, /var loaders=\[fsStateLoadUsersViaCallable,fsStateLoadUsersViaSdk,fsStateLoadUsersViaRest\]/);
  assert.match(core, /Managed-user directory callable was unavailable; using a read-only fallback/);
  assert.doesNotMatch(core, /loadUsers:async function\(\)\{\s*var users=await fsStateFirstSuccess/);
  assert.match(core, /User-list refresh was unavailable/);
});

test('the production entrypoint cache version advances with authenticated-operation fixes', () => {
  const index = fs.readFileSync('public/index.html', 'utf8');
  const authBootstrap = fs.readFileSync('public/assets/js/auth-bootstrap.js', 'utf8');
  assert.match(index, /assets\/js\/auth-bootstrap\.js/);
  const mainVersion = authBootstrap.match(/import\('\.\/main\.js\?v=R6\.76\.(\d+)'\)/);
  assert.ok(mainVersion, 'auth bootstrap must load the versioned main entrypoint');
  assert.ok(Number(mainVersion[1]) >= 30, 'main entrypoint cache version must include authenticated-operation fixes');
  assert.match(core, /window\.__fsAuthenticatedUser=credential\.user/);
  assert.match(core, /rememberedMatchesCurrentProfile/);
  assert.match(core, /String\(remembered\.email\|\|''\)\.trim\(\)\.toLowerCase\(\)/);
  assert.match(core, /window\.__fsAuthenticatedUser=null/);
  assert.match(core, /Firebase callable SDK transport was unavailable/);
  assert.match(core, /functions\.httpsCallable\(name\)/);
});

test('managed-user refresh retains a known-good directory after a transient empty fallback', () => {
  assert.match(core, /var previousUsers=Array\.isArray\(S\.cache&&S\.cache\.users\)\?S\.cache\.users:\[\];/);
  assert.match(core, /users\.length===0&&previousUsers\.length/);
  assert.match(core, /retaining the last verified directory/);
});

test('managed-user callables support legacy administrator directories during migration', () => {
  const functions = fs.readFileSync('functions/index.js', 'utf8');
  assert.match(functions, /async function legacyCallerProfile\(identity\)/);
  assert.match(functions, /const legacy = await legacyCallerProfile\(request\.auth\)/);
  assert.match(functions, /migratedFromLegacyDirectoryAt: FieldValue\.serverTimestamp\(\)/);
  assert.match(functions, /original legacy directory is left untouched/);
  assert.match(functions, /knownEmails/);
});
