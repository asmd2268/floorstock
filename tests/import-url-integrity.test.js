import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

async function jsFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await jsFiles(path));
    else if (entry.name.endsWith('.js')) files.push(path);
  }
  return files;
}

test('internal core imports never use conflicting URLs', async () => {
  const urlsByModule = new Map();
  for (const file of await jsFiles(fileURLToPath(new URL('../public/assets/js/', import.meta.url)))) {
    const source = await readFile(file, 'utf8');
    for (const match of source.matchAll(/(?:import|from)\s+['"]([^'"]*\/core\/[^'"]+)['"]/g)) {
      const url = match[1];
      const key = url.split('?')[0];
      const urls = urlsByModule.get(key) || new Set();
      urls.add(url);
      urlsByModule.set(key, urls);
    }
  }
  for (const [key, urls] of urlsByModule) assert.equal(urls.size, 1, `conflicting URLs for ${key}`);
});
