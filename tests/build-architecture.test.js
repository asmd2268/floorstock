import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { test } from 'node:test';

// These used to assert against tools/build_es_modules.py, the one-time
// IIFE->ES-module converter. That script re-generated main.js, event-bindings.js
// and index.html from its own hard-coded provider list, so it would have silently
// discarded every module added by hand since the conversion (22 of the 50 by the
// time it was retired) along with any later edit to the entrypoint. main.js and
// event-bindings.js are maintained source now, not build output, so the guards
// belong on the shipped files themselves.
const main = await readFile(new URL('../public/assets/js/main.js', import.meta.url), 'utf8');
const firebaseModule = await readFile(
  new URL('../public/assets/js/modules/03-core-application-firebase-state-auth.js', import.meta.url),
  'utf8',
);

test('every entrypoint import carries a cache-busting stamp', () => {
  const specifiers = [...main.matchAll(/from ['"](\.\/[^'"]+)['"]|import ['"](\.\/[^'"]+)['"]/g)]
    .map(match => match[1] || match[2]);
  assert.ok(specifiers.length > 60, `expected the full module graph, saw ${specifiers.length}`);
  const unstamped = specifiers.filter(specifier => !/\?v=[0-9a-f]{10}$/.test(specifier));
  assert.deepEqual(unstamped, [], 'run `npm run stamp` to stamp these specifiers');
});

test('the runtime boundary and the DOM bindings sit at the two ends of the graph', () => {
  const legacyRegistry = main.indexOf('./core/legacy-registry.js');
  const firstModule = main.indexOf('./modules/');
  const domBindings = main.indexOf('./core/dom-bindings.js');
  assert.ok(legacyRegistry > -1 && firstModule > -1 && domBindings > -1);
  assert.ok(legacyRegistry < firstModule, 'legacy-registry must load before any feature module');
  assert.ok(domBindings > firstModule, 'dom-bindings must load after every feature module');
});

test('there is exactly one entrypoint', async () => {
  const jsRoot = new URL('../public/assets/js/', import.meta.url);
  const names = await readdir(jsRoot);
  const entrypoints = [];
  for (const name of names) {
    if (!name.endsWith('.js')) continue;
    const source = await readFile(new URL(name, jsRoot), 'utf8');
    if (/import ['"]\.\/modules\//.test(source)) entrypoints.push(name);
  }
  assert.deepEqual(entrypoints, ['main.js']);
});

test('provider modules keep one canonical legacy registry import', () => {
  const imports = firebaseModule.match(/import \{ publishLegacy \} from ['"]\.\.\/core\/legacy-registry\.js(?:\?v=[^'"]*)?['"];?/g) || [];
  assert.equal(imports.length, 1);
});
