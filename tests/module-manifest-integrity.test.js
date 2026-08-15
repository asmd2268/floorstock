import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const main = await readFile(new URL('../public/assets/js/main.js', import.meta.url), 'utf8');
const allModuleFiles = (await readdir(new URL('../public/assets/js/modules/', import.meta.url))).filter(name => name.endsWith('.js')).sort();
// Stubs (merged-out files) are 2-line files: a comment + export {};. Exclude them from the import requirement.
const stubPattern = /^\/\/ (?:Merged into|No-op)\b/;
const moduleNames = await (async () => {
  const active = [];
  for (const name of allModuleFiles) {
    const src = await readFile(new URL(`../public/assets/js/modules/${name}`, import.meta.url), 'utf8');
    if (!stubPattern.test(src.trim())) active.push(name);
  }
  return active;
})();
const imports = [...main.matchAll(/import ['"]\.\/modules\/([^?'"\s]+)(?:\?[^'"\s]*)?['"]/g)].map(match => match[1]);

test('main entrypoint contains every feature module exactly once', () => {
  assert.equal(new Set(imports).size, imports.length);
  assert.deepEqual([...imports].sort(), moduleNames);
});

test('runtime boundary loads before feature modules and DOM bindings load last', () => {
  assert.ok(main.indexOf("import './core/runtime-health.js") < main.indexOf("import './modules/"));
  assert.ok(main.indexOf("import { installDomBindings }") > main.lastIndexOf("import './modules/"));
});

test('each core module is imported with one cache URL only', () => {
  const coreImports = [...main.matchAll(/from ['"]\.\.\/core\/([^?'"\s]+)(?:\?[^'"\s]*)?['"]/g)].map(match => match[1]);
  for (const name of new Set(coreImports)) {
    const urls = [...main.matchAll(new RegExp(`core/${name}\\?v=([^'"\\s]+)`, 'g'))].map(match => match[1]);
    assert.ok(urls.length <= 1, `duplicate cache versions for ${name}`);
  }
});
