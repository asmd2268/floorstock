import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';

/* CVE-2024-4367: pdf.js up to 4.1.x runs a script embedded in a crafted PDF when
   font handling uses eval. The app loads pdf.js 3.11.174 from a CDN and parses
   PDFs people upload (receipt scans), so every getDocument call must switch the
   eval path off; that is the maintainers' stated mitigation for these versions.
   If pdf.js is ever upgraded past 4.2.67 this guard can go. */
test('every pdf.js getDocument call disables eval', async () => {
  const root = new URL('../public/assets/js/', import.meta.url);
  const calls = [];
  for (const dir of ['core', 'modules']) {
    for (const name of await readdir(new URL(`${dir}/`, root))) {
      if (!name.endsWith('.js')) continue;
      const text = await readFile(new URL(`${dir}/${name}`, root), 'utf8');
      for (const match of text.matchAll(/getDocument\(([^)]*)\)/g)) calls.push(`${dir}/${name}: ${match[1]}`);
    }
  }
  assert.ok(calls.length > 0, 'the guard must see at least the receipt parser');
  const unsafe = calls.filter((call) => !/isEvalSupported\s*:\s*false/.test(call));
  assert.deepEqual(unsafe, []);
});
