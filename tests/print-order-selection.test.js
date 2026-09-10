import assert from 'node:assert/strict';
import { test } from 'node:test';

import { selectedPrintIds, restorePrintSelection, withPreservedPrintSelection } from '../public/assets/js/core/print-order-selection.js';

/* Print Orders lost every tick mark about ten seconds after a pharmacist
   started selecting: the list re-renders whenever the requests behind it
   change, and the rebuild came back with empty boxes and no message. */

/* A minimal stand-in for the table: rows with ids, and a header box. */
function table(rows, { headerChecked = false } = {}) {
  const boxes = rows.map(([id, checked]) => ({ dataset: { id }, checked, className: 'pchk' }));
  const header = { checked: headerChecked, className: 'pchk-all' };
  return {
    boxes,
    header,
    querySelectorAll(selector) {
      if (selector === '.pchk:checked') return boxes.filter((box) => box.checked);
      if (selector === '.pchk') return boxes;
      return [];
    },
    querySelector(selector) {
      return selector.includes('pchk-all') || selector.includes('print-select-all') ? header : null;
    },
  };
}

test('the ticked rows are remembered by request id', () => {
  const root = table([['r1', true], ['r2', false], ['r3', true]]);
  assert.deepEqual(selectedPrintIds(root), ['r1', 'r3']);
});

test('a rebuilt list comes back with the same rows ticked', () => {
  const before = table([['r1', true], ['r2', false], ['r3', true]]);
  const kept = selectedPrintIds(before);
  const after = table([['r1', false], ['r2', false], ['r3', false]]);
  assert.equal(restorePrintSelection(kept, after), 2);
  assert.deepEqual(after.boxes.filter((box) => box.checked).map((box) => box.dataset.id), ['r1', 'r3']);
});

test('a row that has left the list drops out of the selection with it', () => {
  /* There is nothing left to print for it. */
  const after = table([['r1', false], ['r9', false]]);
  assert.equal(restorePrintSelection(['r1', 'gone'], after), 1);
  assert.deepEqual(after.boxes.filter((box) => box.checked).map((box) => box.dataset.id), ['r1']);
});

test('a new request arriving does not become selected on its own', () => {
  const after = table([['r1', false], ['new', false]]);
  restorePrintSelection(['r1'], after);
  assert.equal(after.boxes.find((box) => box.dataset.id === 'new').checked, false);
});

test('the header box claims "all" only when every row really is ticked', () => {
  const partly = table([['r1', false], ['r2', false]], { headerChecked: true });
  restorePrintSelection(['r1'], partly);
  assert.equal(partly.header.checked, false, 'a stale "all" tick would print rows nobody chose');

  const every = table([['r1', false], ['r2', false]]);
  restorePrintSelection(['r1', 'r2'], every);
  assert.equal(every.header.checked, true);
});

test('nothing selected means nothing to restore, and the render still runs', () => {
  const root = table([['r1', false]]);
  let rendered = 0;
  assert.equal(withPreservedPrintSelection(() => { rendered += 1; }, root), 0);
  assert.equal(rendered, 1);
  assert.equal(restorePrintSelection(null, root), 0);
});

test('the print page carries its selection across the refresh', async () => {
  const { readFile } = await import('node:fs/promises');
  const source = await readFile(new URL('../public/assets/js/modules/38-v16-user-operations-main.js', import.meta.url), 'utf8');
  assert.match(source, /selectedPrintIds\(\)/);
  assert.match(source, /restorePrintSelection\(kept\)/);
  const page = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  assert.match(page, /class="pchk-all"/, 'the header box needs a stable hook to be corrected');
});
