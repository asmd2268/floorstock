import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const builder = await readFile(new URL('../tools/build_es_modules.py', import.meta.url), 'utf8');

test('module builder preserves the existing main import order', () => {
  assert.match(builder, /ordered_names\s*=\s*re\.findall/);
  assert.match(builder, /module_files\s*=\s*\[available\[name\] for name in ordered_names/);
  assert.match(builder, /module_files\.extend\(path for name, path in sorted\(available\.items\(\)\)/);
});
