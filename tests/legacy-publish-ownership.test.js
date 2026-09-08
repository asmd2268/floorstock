import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

/* One owner per published name.

   publishLegacy() now throws when a module publishes a name another module
   already published, which is what makes wrapper-on-wrapper impossible: the
   `canonicalX` alias plus pass-through pattern only existed to survive that
   second publish. The throw fires at startup in the browser, which is the right
   place for it but a late place to find out — this reproduces the registry's
   ownership rule statically, in main.js import order, so a re-publish fails the
   build instead of the app. */

const jsRoot = new URL('../public/assets/js/', import.meta.url);
const main = await readFile(new URL('main.js', jsRoot), 'utf8');
const moduleOrder = [...main.matchAll(/import ['"]\.\/(modules\/[^?'"]+)(?:\?[^'"]*)?['"]/g)].map(match => match[1]);

/* publishLegacy is called two ways: with an inline object literal, and with a
   variable holding one (`publishLegacy("mod.js", __asdhLegacyApi)`). Only reading
   the literal form missed every module that uses the second — which is exactly
   how a real conflict (the FB_* handles) reached the browser instead of this
   test. Both forms are resolved here. */
function publishedNames(source) {
  const results = [];
  for (const call of source.matchAll(/publishLegacy\(\s*["']([^"']+)["']\s*,\s*([\s\S]*?)\)\s*;/g)) {
    const moduleName = call[1];
    let body = call[2].trim();
    if (!body.startsWith('{')) {
      // A bare identifier: find `const <identifier> = { ... };` in the same file.
      const declaration = new RegExp(`(?:const|let|var)\\s+${body.replace(/[^\w$]/g, '')}\\s*=\\s*\\{([\\s\\S]*?)\\n\\};`).exec(source);
      if (!declaration) continue;
      body = `{${declaration[1]}}`;
    }
    const names = [...body.matchAll(/^\s*([A-Za-z_$][\w$]*)\s*[,:]/gm)].map(match => match[1]);
    results.push({ moduleName, names });
  }
  return results;
}

async function collectOwnership() {
  const owners = new Map();
  const conflicts = [];
  const seen = [];
  for (const relativePath of moduleOrder) {
    const source = await readFile(new URL(relativePath, jsRoot), 'utf8');
    for (const { moduleName, names } of publishedNames(source)) {
      seen.push(moduleName);
      for (const name of names) {
        if (owners.has(name) && owners.get(name) !== moduleName) {
          conflicts.push(`${name}: owned by ${owners.get(name)}, re-published by ${moduleName}`);
        }
        owners.set(name, moduleName);
      }
    }
  }
  return { owners, conflicts, seen };
}

const { owners, conflicts, seen } = await collectOwnership();

test('no module re-publishes a name another module already owns', () => {
  assert.deepEqual(conflicts, [], 'publishLegacy would throw at startup for these');
});

test('the registry enforces single ownership at runtime too', async () => {
  const registry = await readFile(new URL('core/legacy-registry.js', jsRoot), 'utf8');
  assert.match(registry, /const owners = new Map\(\)/);
  assert.match(registry, /throw new Error\(/);
  assert.match(registry, /re-publishes/);
});

test('the retired canonical* pass-through wrappers are gone', async () => {
  // Each of these is published by exactly one core module. They used to be
  // re-declared in 07i/07b as `canonicalX` aliases plus identity wrappers, which
  // overwrote the owner's global with a function that added nothing.
  for (const name of [
    'orderRetentionCutoff', 'requestArchiveRecord', 'cleanupOldOrders',
    'scheduleAutomaticOrderCleanup', 'setPPP', 'resetPrintPageState',
    'getCatOptions', 'fmt12', 'dayBits', 'timeToMins', 'getNextDispSlot',
    'ensureXLSX', 'getMonthlyLimit', 'renderShelfAlertSettings',
    'openAddExpiry', 'openEditExpiry',
  ]) {
    assert.equal(owners.has(name), false, `${name} must be published by its core owner, not re-published by a feature module`);
  }

  for (const relativePath of ['modules/07i-misc-features.js', 'modules/07b-inventory-import.js', 'modules/07-expiry-requests-and-primary-features.js']) {
    const source = await readFile(new URL(relativePath, jsRoot), 'utf8');
    const aliases = source.match(/globalThis\.canonical[A-Z][\w$]*\s*=/g) || [];
    assert.deepEqual(aliases, [], `${relativePath} still declares canonical* aliases`);
  }
});

test('the ownership scan actually reaches every publishing module', () => {
  // A regex that silently matched nothing would make the conflict test vacuous.
  // 21 modules publish, between them just under 300 names. The thresholds are
  // deliberately loose — they guard against a regex that matches nothing, not
  // against the counts changing as modules are added.
  assert.ok(seen.length >= 20, `only ${seen.length} publishLegacy calls were parsed`);
  assert.ok(owners.size >= 250, `only ${owners.size} published names were found`);
});
