import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const builder = await readFile(new URL('../tools/build_es_modules.py', import.meta.url), 'utf8');
const firebaseModule = await readFile(
  new URL('../public/assets/js/modules/03-core-application-firebase-state-auth.js', import.meta.url),
  'utf8',
);

test('module builder uses one cache version for generated imports', () => {
  assert.match(builder, /BUILD_VERSION\s*=\s*["']R6\.76\.\d+["']/);
  assert.match(builder, /modules\/\{path\.name\}\?v=\{BUILD_VERSION\}/);
  assert.match(builder, /core\/runtime-health\.js\?v=\{BUILD_VERSION\}/);
  assert.match(builder, /core\/dom-bindings\.js\?v=\{BUILD_VERSION\}/);
});

test('generated provider modules keep one canonical legacy registry import', () => {
  // The specifier now carries a content-hash cache stamp (tools/stamp_module_hashes.mjs),
  // which is orthogonal to what this guards: that there is exactly one such import.
  const imports = firebaseModule.match(/import \{ publishLegacy \} from ['"]\.\.\/core\/legacy-registry\.js(?:\?v=[^'"]*)?['"];?/g) || [];
  assert.equal(imports.length, 1);
});
