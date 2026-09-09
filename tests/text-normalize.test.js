import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import { fsNorm, fsText, fsNum } from '../public/assets/js/core/text-normalize.js';

/* modules/51 carried two copies of these helpers, fsR5* and fsR6*. Four of six
   were byte-identical. The fifth was not, and that difference was live. */

test('a name folds the same way wherever it is compared', () => {
  /* The two copies differed on Latin accents: fsR5Norm ran NFKD and stripped
     the combining marks, fsR6Norm did not — so the printing half matched
     "Amiodaróne" to "Amiodarone" and the Crash Cart half did not. */
  assert.equal(fsNorm('Amiodaróne'), fsNorm('amiodarone'));
  /* And neither removed Arabic harakat, which NFKD does not produce: مُورفين
     never matched مورفين in either half. The department scope in module 03 has
     always folded them; names do now too. */
  assert.equal(fsNorm('مُورفِين'), fsNorm('مورفين'));
  assert.equal(fsNorm('  Morphine  10mg '), 'morphine10mg');
  // The letter forms Arabic writes interchangeably fold together.
  assert.equal(fsNorm('أدوية'), fsNorm('ادويه'));
  assert.equal(fsNorm('مستشفى'), fsNorm('مستشفي'));
  // And different words stay different.
  assert.notEqual(fsNorm('مورفين'), fsNorm('ميدازولام'));
});

test('trimming keeps a fallback, and a quantity is never NaN', () => {
  assert.equal(fsText('  ICU  '), 'ICU');
  assert.equal(fsText('   ', 'Unknown'), 'Unknown');
  assert.equal(fsText(null, 'Unknown'), 'Unknown');
  assert.equal(fsNum('7'), 7);
  assert.equal(fsNum('not a number'), 0);
  assert.equal(fsNum(undefined), 0);
  assert.equal(fsNum(Infinity), 0, 'a quantity must be finite');
});

test('the modules split out of 51 keep one set of helpers, not two', async () => {
  const source = (await Promise.all([
    'core/controlled-custody-print.js',
    'core/controlled-custody-data.js',
    'core/controlled-department-panel.js',
    'core/orders-print.js',
  ].map((file) => readFile(new URL(`../public/assets/js/${file}`, import.meta.url), 'utf8')))).join('\n');
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const name of ['fsR5Norm', 'fsR6Norm', 'fsR5S', 'fsR6S', 'fsR5N', 'fsR6N']) {
    assert.ok(!new RegExp(`function ${name}\\(`).test(code), `${name} is defined again after the split`);
  }
  assert.match(source, /text-normalize\.js/);
});

test('nothing declares a third copy of the fold', async () => {
  /* fsE and fsEsc already belong to dom-utils; the fold now belongs here. */
  const domUtils = await readFile(new URL('../public/assets/js/core/dom-utils.js', import.meta.url), 'utf8');
  assert.ok(!/normalize\('NFKD'\)/.test(domUtils), 'the fold lives in one module');
});
