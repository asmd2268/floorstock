import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { test } from 'node:test';

/* "Who is the app acting as" had three answers. window.CU, which test mode
   already rewrites into the tested user; fsEffectiveUser(), which merged
   MASTER_EFFECTIVE over it; and six call sites that read identity straight off
   MASTER_EFFECTIVE — which is not a user at all, but a short note about test
   mode. Those sites saw a user with no id, no username and no master flag
   whenever test mode was on, and worked only because the note happens to carry
   role and deptId. */

const jsRoot = new URL('../public/assets/js/', import.meta.url);

async function sources() {
  const out = [];
  for (const dir of ['core', 'modules']) {
    for (const name of await readdir(new URL(`${dir}/`, jsRoot))) {
      if (!name.endsWith('.js')) continue;
      out.push({ path: `${dir}/${name}`, text: await readFile(new URL(`${dir}/${name}`, jsRoot), 'utf8') });
    }
  }
  return out;
}

test('the effective user is CU, read through one accessor', async () => {
  const helpers = await readFile(new URL('modules/03e-date-dialog-permission-helpers.js', jsRoot), 'utf8');
  assert.match(helpers, /window\.fsEffectiveUser=function\(\)\{return window\.CU\|\|\{\}\}/);
  // Test-mode metadata is reachable, but as metadata — never as an identity.
  assert.match(helpers, /window\.fsTestMode=function\(\)/);
});

test('nothing reads a user field off the test-mode note', async () => {
  /* `MASTER_EFFECTIVE.role` / `.deptId` / `MASTER_EFFECTIVE||CU` are the shapes
     that made it a second identity source. Asking whether test mode is ON is
     fine — that is what the note is for. */
  for (const { path, text } of await sources()) {
    // The module that owns the note may read its own fields.
    if (path.includes('51-asdhealth-canonical') || path.includes('07-expiry-requests')) continue;
    // Strip comments: the accessor's own docblock names the shapes it replaced.
    const code = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    const identityReads = code.match(/MASTER_EFFECTIVE\s*(\.\s*(role|deptId|departmentId|email|username|id|master)|\|\|\s*(window\.)?CU)/g) || [];
    assert.deepEqual(identityReads, [], `${path} reads identity from the test-mode note`);
  }
});

test('the pharmacy response explains each choice in plain words, in both languages', async () => {
  /* Used by people who do not know the system: a bare checkbox labelled "not
     currently available" never said what ticking it does. */
  const response = await readFile(new URL('modules/80-controlled-pharmacy-ui-redesign.js', jsRoot), 'utf8');
  assert.match(response, /ما عندي هذا الدواء الآن \/ I have none of this medicine/);
  assert.match(response, /تصبح الكمية صفراً، ويُغلق البلاغ، وتبقى العربة ناقصة هذا الصنف/);
  assert.match(response, /لا تغيير على هذا الصنف \/ Do not touch this medicine/);
  // And the outcome is a sentence about the cart, not a bare pair of numbers.
  assert.match(response, /ستصبح الكمية في العربة/);
  assert.match(response, /The cart will hold/);
});

test('a ticked choice is visible without reading it', async () => {
  const css = await readFile(new URL('../public/assets/css/modules/03-styles-13-18.css', import.meta.url), 'utf8');
  assert.match(css, /\.ccc-unavailable-label:has\(input:checked\)/);
});
