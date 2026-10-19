import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const source = await readFile(new URL('../public/assets/js/modules/80-controlled-pharmacy-ui-redesign.js', import.meta.url), 'utf8');

/* The controlled page (hero + Stock/Cabinets/Departments/Analytics tab row) is
   installed by installOnce(), which refuses to run if a name it NEEDS is not already
   a function. ctlTabs is defined by that very install (patchCtlTabs), so listing it as
   needed made the install impossible: the page silently lost its hero and tabs. */

test('the controlled page install does not require a name that the install itself defines', () => {
  const needed = source.match(/installOnce\('controlled page',\s*\{([^}]*)\}/);
  assert.ok(needed, 'the controlled page install call exists');
  assert.doesNotMatch(needed[1], /ctlTabs/, 'ctlTabs is defined by patchCtlTabs, not a prerequisite');
  assert.match(needed[1], /renderControlled/, 'renderControlled is a real prerequisite');
});

test('patchCtlTabs is what defines ctlTabs', () => {
  assert.match(source, /function patchCtlTabs\(\)\{[\s\S]*?window\.ctlTabs\s*=\s*function/);
});
