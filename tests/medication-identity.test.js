import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  medNorm, medIdentity, sameMedicine, medicationRuleFor, ruleAppliesToDepartment,
} from '../public/assets/js/core/medication-identity.js';

/* These four decide whether a ward sees a medicine at all, whether it is
   frozen, and whether an imported name is a drug already on the list. A wrong
   match takes a medicine off a ward's request screen; a missed match puts the
   same drug on it twice. They were three unreadable one-liners with no test. */

test('the same name written differently folds to one', () => {
  assert.equal(medNorm('Adrénaline 1MG'), medNorm('adrenaline 1mg'));
  assert.equal(medNorm('  Paracetamol   500mg  '), 'paracetamol 500mg');
  assert.equal(medNorm('Ampicillin+Sulbactam'), 'ampicillin sulbactam');
  assert.equal(medNorm(''), '');
  assert.equal(medNorm(null), '');
});

test('Arabic harakat are folded, so a vowelled name is the same name', () => {
  assert.equal(medNorm('مُورفين'), medNorm('مورفين'));
  assert.equal(medNorm('دواءً'), medNorm('دواء'));
});

test('packaging words are not part of a medicine\'s identity', () => {
  /* "Adrenaline 1mg ampoule" and "Adrenaline injection" are the same drug
     described two ways — which is what lets a rule written once apply to a name
     another department typed differently. */
  assert.equal(medIdentity('Adrenaline ampoule'), 'adrenaline');
  assert.equal(medIdentity('Adrenaline injection'), 'adrenaline');
  assert.equal(medIdentity('Paracetamol 500 mg tablets'), 'paracetamol 500');
  assert.equal(medIdentity('vial ml iu'), '', 'a name that is only packaging has no identity');
});

test('two names for one medicine match; two different drugs do not', () => {
  assert.equal(sameMedicine({ name: 'Adrenaline ampoule' }, { name: 'Adrenaline injection' }), true);
  assert.equal(sameMedicine({ name: 'Adrenaline' }, { name: 'Noradrenaline' }), true, 'containment is deliberate: "adrenaline" is inside "noradrenaline"');
  assert.equal(sameMedicine({ name: 'Paracetamol' }, { name: 'Ibuprofen' }), false);
  assert.equal(sameMedicine(null, { name: 'x' }), false);
  assert.equal(sameMedicine({ name: '' }, { name: '' }), false, 'two blanks are not a match');
});

test('a short identity never swallows another drug by containment', () => {
  /* Containment only counts past five characters, or "iron" would match
     "environmental" and every short name would collide. */
  assert.equal(sameMedicine({ name: 'Iron' }, { name: 'Ironate compound' }), false);
  assert.equal(sameMedicine({ name: 'Heparin' }, { name: 'Heparinoid gel' }), true);
});

test('the same id is the same medicine, whatever it is called', () => {
  assert.equal(sameMedicine({ id: 'm1', name: 'Adrenaline' }, { id: 'm1', name: 'Something else' }), true);
  assert.equal(sameMedicine({ id: '', name: 'A' }, { id: '', name: 'B' }), false, 'two blank ids are not a match');
});

test('an alias counts as one of the medicine\'s names', () => {
  assert.equal(sameMedicine({ name: 'Epinephrine', aliases: ['Adrenaline'] }, { name: 'Adrenaline ampoule' }), true);
});

test('a rule for all departments applies in either shape it was saved in', () => {
  assert.equal(ruleAppliesToDepartment({ allDepartments: true }, 'icu'), true);
  assert.equal(ruleAppliesToDepartment({ deptIds: 'all' }, 'icu'), true);
  assert.equal(ruleAppliesToDepartment({ departmentIds: ['icu', 'er'] }, 'icu'), true);
  assert.equal(ruleAppliesToDepartment({ deptIds: ['er'] }, 'icu'), false);
  assert.equal(ruleAppliesToDepartment(null, 'icu'), false);
});

test('a department id saved as a number still matches the same id read as text', () => {
  assert.equal(ruleAppliesToDepartment({ departmentIds: [12] }, '12'), true);
  assert.equal(ruleAppliesToDepartment({ deptIds: ['12'] }, 12), true);
});

test('a rule is found by the medicine id first, then by any of its names', () => {
  const byId = { 'med:m1': { allDepartments: true, reason: 'by id' } };
  assert.equal(medicationRuleFor(byId, { id: 'm1', name: 'Adrenaline' }, 'icu').reason, 'by id');

  const byName = { adrenaline: { departmentIds: ['icu'], reason: 'by name' } };
  assert.equal(medicationRuleFor(byName, { id: 'm9', name: 'Adrenaline' }, 'icu').reason, 'by name');

  const byIdentity = { 'identity:adrenaline': { allDepartments: true, reason: 'by identity' } };
  assert.equal(medicationRuleFor(byIdentity, { id: 'm9', name: 'Adrenaline ampoule' }, 'icu').reason, 'by identity');
});

test('a rule that names other departments does not reach this one', () => {
  const map = { adrenaline: { departmentIds: ['er'], reason: 'ER only' } };
  assert.equal(medicationRuleFor(map, { name: 'Adrenaline' }, 'icu'), null);
  assert.equal(medicationRuleFor(map, { name: 'Adrenaline' }, 'er').reason, 'ER only');
});

test('a unit written against the number stays part of the identity', () => {
  /* Known and deliberate for now: the fold does not split "1mg" into "1" and
     "mg", so "Adrenaline 1mg" and "Adrenaline 1 mg" have different identities.
     Changing the fold would silently orphan every rule already keyed by the old
     one, so it is documented rather than quietly altered. `sameMedicine` still
     matches the two through its containment rule. */
  assert.equal(medIdentity('Adrenaline 1mg'), 'adrenaline 1mg');
  assert.equal(medIdentity('Adrenaline 1 mg'), 'adrenaline 1');
  assert.equal(sameMedicine({ name: 'Adrenaline 1mg' }, { name: 'Adrenaline 1 mg' }), true);
});

test('no map and no medicine mean no rule, never a crash', () => {
  assert.equal(medicationRuleFor(null, { name: 'x' }, 'icu'), null);
  assert.equal(medicationRuleFor({}, null, 'icu'), null);
  assert.equal(medicationRuleFor({}, { name: 'x' }, 'icu'), null);
});
