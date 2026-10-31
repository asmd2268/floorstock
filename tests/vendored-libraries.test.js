import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';

/* pdf.js and ZXing used to be fetched from cdnjs/unpkg with no integrity check, so
   whoever controlled those hosts controlled code running next to patient data.
   They are served from assets/vendor now, byte-identical to the official npm
   packages (pdfjs-dist 3.11.174, @zxing/library 0.19.1, whose registry integrity
   hashes were checked when they were vendored). A changed byte fails here. */
const PINNED = {
  'pdf-3.11.174.min.js': '5b5799e6f8c680663207ac5b42ee14eed2a406fa7af48f50c154f0c0b1566946',
  'pdf-3.11.174.worker.min.js': 'feabdf309770ed24bba31a5467836cdc8cf639c705af27d52b585b041bb8527b',
  'zxing-0.19.1.min.js': 'c5837e4858a3775173bab09ee36e6052545c7880c9d7452e2f464770c6e642ce',
};
const js = new URL('../public/assets/js/', import.meta.url);

test('vendored pdf.js and ZXing match the pinned official builds', async () => {
  for (const [name, sha] of Object.entries(PINNED)) {
    const bytes = await readFile(new URL(`../public/assets/vendor/${name}`, import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), sha, name);
  }
});

test('no module loads a script from a CDN host', async () => {
  const offenders = [];
  for (const dir of ['core', 'modules']) {
    for (const name of await readdir(new URL(`${dir}/`, js))) {
      if (!name.endsWith('.js')) continue;
      const text = await readFile(new URL(`${dir}/${name}`, js), 'utf8');
      if (/https?:\/\/(cdnjs\.cloudflare\.com|unpkg\.com|cdn\.jsdelivr\.net)/.test(text)) offenders.push(`${dir}/${name}`);
    }
  }
  assert.deepEqual(offenders, []);
});
