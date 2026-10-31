import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';

/* SheetJS 0.18.5 (CVE-2023-30533, CVE-2024-22363) was loaded from CDNs. The fixed
   0.20.x line is published only by SheetJS, so the official file is vendored and
   pinned by hash: a changed byte fails here instead of reaching a browser. */
const OFFICIAL_SHA256 = 'cc015130aa8521e7f088f88898eba949ccdcbfb38df0bd129b44b7273c3a6f41';
const js = new URL('../public/assets/js/', import.meta.url);

test('the vendored workbook reader is the official 0.20.3 build', async () => {
  const bytes = await readFile(new URL('../public/assets/vendor/xlsx-0.20.3.full.min.js', import.meta.url));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), OFFICIAL_SHA256);
  assert.match(bytes.subarray(0, 120).toString(), /SheetJS/);
});

test('the loader uses the vendored file and no CDN copy of xlsx', async () => {
  const loader = await readFile(new URL('core/excel-loader.js', js), 'utf8');
  assert.match(loader, /vendor\/xlsx-0\.20\.3\.full\.min\.js/);
  const offenders = [];
  for (const dir of ['core', 'modules']) {
    for (const name of await readdir(new URL(`${dir}/`, js))) {
      if (!name.endsWith('.js')) continue;
      const text = await readFile(new URL(`${dir}/${name}`, js), 'utf8');
      if (/https?:\/\/[^'"\s]*xlsx[^'"\s]*/i.test(text)) offenders.push(`${dir}/${name}`);
    }
  }
  assert.deepEqual(offenders, []);
});
