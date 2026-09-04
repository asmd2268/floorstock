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
  '03g-requests.js',
].map((name) => fs.readFileSync(`public/assets/js/modules/${name}`, 'utf8')).join('\n');

const users = [
  '07-expiry-requests-and-primary-features.js',
  '07b-inventory-import.js',
  '07c-users.js',
].map((name) => fs.readFileSync(`public/assets/js/modules/${name}`, 'utf8')).join('\n');

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
  // The ?v= stamps used to be hand-maintained numbers, which is why this once
  // asserted a minimum release number. They are now derived from file content by
  // tools/stamp_module_hashes.mjs, so "the version advances when the code changes"
  // holds by construction — and assets can be served immutable. Verifying the
  // recorded stamps still match the files is the stronger check, and it fails
  // loudly if someone edits a module without re-running the stamper.
  const stampOf = (file) =>
    require('crypto').createHash('sha256').update(fs.readFileSync(file)).digest('hex').slice(0, 10);

  const mainVersion = authBootstrap.match(/import\('\.\/main\.js\?v=([0-9a-f]{10})'\)/);
  assert.ok(mainVersion, 'auth bootstrap must load the content-stamped main entrypoint');
  assert.equal(mainVersion[1], stampOf('public/assets/js/main.js'),
    'main.js stamp is stale — run `npm run stamp`');

  const bootstrapVersion = index.match(/assets\/js\/auth-bootstrap\.js\?v=([0-9a-f]{10})/);
  assert.ok(bootstrapVersion, 'index.html must load the content-stamped auth bootstrap');
  assert.equal(bootstrapVersion[1], stampOf('public/assets/js/auth-bootstrap.js'),
    'auth-bootstrap.js stamp is stale — run `npm run stamp`');

  // The checks above only prove the chain is internally consistent. Editing a
  // module without re-stamping leaves main.js byte-identical (it still holds the
  // old hash), so the stale module has to be caught against its own file.
  const mainSrc = fs.readFileSync('public/assets/js/main.js', 'utf8');
  const imports = [...mainSrc.matchAll(/['"]\.\/((?:modules|core)\/[^'"?]+\.js)\?v=([0-9a-f]{10})['"]/g)];
  assert.ok(imports.length > 50, 'main.js should import the full module set with content stamps');
  const stale = imports
    .filter(([, rel, stamp]) => stamp !== stampOf(`public/assets/js/${rel}`))
    .map(([, rel]) => rel);
  assert.deepEqual(stale, [], `these files changed without re-stamping — run \`npm run stamp\`:\n  ${stale.join('\n  ')}`);

  // Every stamped asset must also be reachable under an immutable cache rule,
  // otherwise the hashing buys nothing.
  const vercel = JSON.parse(fs.readFileSync('vercel.json', 'utf8'));
  const immutable = (vercel.headers || []).some((h) =>
    /assets/.test(h.source) && (h.headers || []).some((k) =>
      k.key === 'Cache-Control' && /immutable/.test(k.value)));
  assert.ok(immutable, 'vercel.json must serve hashed assets as immutable');
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
