import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  pendingUnits, effectiveBalance, activeRegimenVersion,
  regimensForAssignment, submissionBlockedBy, uniqueLines, filterUsageRows,
} from '../public/assets/js/core/accountability-custody-rules.js';

/* What a department may still submit against its custody. The balance is
   enforced server-side inside a transaction; these are the rules the screen
   needs to refuse an impossible submission before the form is filled in. */

const usage = (over = {}) => ({ assignmentId: 'a1', deptId: 'icu', status: 'pending_pharmacy', units: 3, ...over });

test('units already waiting on pharmacy are spoken for', () => {
  /* A department that asked for eight and is waiting cannot ask for eight more
     against the same balance and find out afterwards half was never there. */
  const rows = [usage({ units: 3 }), usage({ units: 5 }), usage({ status: 'approved_waiting_receipt', units: 100 })];
  assert.equal(pendingUnits(rows, 'a1'), 8, 'only what is still pending counts');
  assert.equal(effectiveBalance({ id: 'a1', balance: 20 }, rows), 12);
});

test('a balance is never shown as negative', () => {
  /* A department reading "-4" could take it as credit. Over-committed custody
     shows as nothing left. */
  assert.equal(effectiveBalance({ id: 'a1', balance: 5 }, [usage({ units: 9 })]), 0);
  assert.equal(effectiveBalance({ id: 'a1', balance: -5 }, []), 0);
});

test('a quantity that is missing or nonsense counts as none', () => {
  const rows = [usage({ units: undefined }), usage({ units: 'x' }), usage({ units: -4 }), usage({ units: 2 })];
  assert.equal(pendingUnits(rows, 'a1'), 2);
});

test('pending units are counted per assignment, not per department', () => {
  const rows = [usage({ assignmentId: 'a1', units: 3 }), usage({ assignmentId: 'a2', units: 90 })];
  assert.equal(pendingUnits(rows, 'a1'), 3);
});

const regimen = (over = {}) => ({
  id: 'r1', deptId: 'icu', activeVersionId: 'v2',
  versions: [
    { id: 'v1', items: [{ assignmentId: 'a1' }, { assignmentId: 'a-old' }] },
    { id: 'v2', items: [{ assignmentId: 'a1' }] },
  ],
  ...over,
});

test('the version in force is the active one, not the first ever written', () => {
  assert.equal(activeRegimenVersion(regimen()).id, 'v2');
  // A plan with no active version recorded falls back to its first version.
  assert.equal(activeRegimenVersion(regimen({ activeVersionId: '' })).id, 'v1');
  assert.equal(activeRegimenVersion(null), null);
  assert.equal(activeRegimenVersion({ versions: [] }), null);
});

test('an assignment dropped from the current version is no longer covered', () => {
  /* Older versions are kept as history and must not go on blocking anything. */
  assert.equal(regimensForAssignment([regimen()], 'icu', 'a-old').length, 0);
  assert.equal(regimensForAssignment([regimen()], 'icu', 'a1').length, 1);
});

test('a plan belongs to one department and can be retired', () => {
  assert.equal(regimensForAssignment([regimen()], 'er', 'a1').length, 0);
  assert.equal(regimensForAssignment([regimen({ active: false })], 'icu', 'a1').length, 0);
});

test('a paused plan blocks submissions, and says which plan is doing it', () => {
  assert.equal(submissionBlockedBy([regimen()], 'icu', 'a1'), null);
  const paused = regimen({ paused: true, id: 'r-paused' });
  assert.equal(submissionBlockedBy([paused], 'icu', 'a1').id, 'r-paused');
  // A paused plan that no longer covers this assignment does not block it.
  assert.equal(submissionBlockedBy([paused], 'icu', 'a-old'), null);
});

test('the same reason typed twice is kept once, however it was spaced', () => {
  const lines = uniqueLines('  Sedation \n\nsedation\nPain relief\n   \nPAIN RELIEF ');
  assert.deepEqual(lines, ['Sedation', 'Pain relief']);
  assert.deepEqual(uniqueLines(''), []);
  assert.deepEqual(uniqueLines(null), []);
});

test('the review filters combine, and match a medicine by part of its name', () => {
  const rows = [
    { assignmentId: 'a1', deptId: 'icu', status: 'pending_pharmacy' },
    { assignmentId: 'a2', deptId: 'er', status: 'pending_pharmacy' },
    { assignmentId: 'a1', deptId: 'icu', status: 'rejected' },
  ];
  const names = { a1: { medName: 'Morphine 10mg' }, a2: { medName: 'Midazolam' } };
  const of = (id) => names[id];
  assert.equal(filterUsageRows(rows, {}, of).length, 3);
  assert.equal(filterUsageRows(rows, { dept: 'icu' }, of).length, 2);
  assert.equal(filterUsageRows(rows, { dept: 'icu', status: 'rejected' }, of).length, 1);
  assert.equal(filterUsageRows(rows, { medicine: 'morph' }, of).length, 2);
  assert.equal(filterUsageRows(rows, { medicine: 'nothing' }, of).length, 0);
});

test('a row whose assignment is gone is still filtered by its own medicine name', () => {
  const rows = [{ assignmentId: 'deleted', deptId: 'icu', medName: 'Morphine 10mg' }];
  assert.equal(filterUsageRows(rows, { medicine: 'morphine' }, () => null).length, 1);
});
