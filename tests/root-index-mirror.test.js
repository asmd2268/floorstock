import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { mirrorRootIndex } from '../tools/mirror_root_index.mjs';

const publicIndex = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
const rootIndex = await readFile(new URL('../index.html', import.meta.url), 'utf8');

test('root index.html is the generated mirror of public/index.html', () => {
  // Fails the build instead of the deploy: an edit to public/index.html that was
  // not followed by `npm run stamp` leaves the Vercel entry document stale.
  assert.equal(rootIndex, mirrorRootIndex(publicIndex), 'run `npm run stamp` to regenerate index.html');
});

test('the mirror rewrites every asset reference and nothing else', () => {
  assert.ok(!/["']\.\/assets\//.test(rootIndex), 'root index must not reference ./assets/ directly');
  assert.ok(!/\.\/public\/public\//.test(rootIndex), 'prefix must not be applied twice');
  assert.equal(
    (rootIndex.match(/\.\/public\/assets\//g) || []).length,
    (publicIndex.match(/\.\/assets\//g) || []).length,
  );
});
