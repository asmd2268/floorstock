import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const main = await readFile(new URL('../public/assets/js/main.js', import.meta.url), 'utf8');
const moduleNames = (await readdir(new URL('../public/assets/js/modules/', import.meta.url))).filter(name => name.endsWith('.js')).sort();
const imports = [...main.matchAll(/import ['"]\.\/modules\/([^?'"\s]+)(?:\?[^'"\s]*)?['"]/g)].map(match => match[1]);

test('main entrypoint contains every feature module exactly once', () => {
  assert.equal(new Set(imports).size, imports.length);
  assert.deepEqual([...imports].sort(), moduleNames);
});

test('runtime boundary loads before feature modules and DOM bindings load last', () => {
  assert.ok(main.indexOf("import './core/runtime-health.js") < main.indexOf("import './modules/"));
  assert.ok(main.indexOf("import { installDomBindings }") > main.lastIndexOf("import './modules/"));
});
