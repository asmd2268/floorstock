import assert from 'node:assert/strict';
import { test } from 'node:test';
import { alphabeticalOrder, orderForNewMed, isRecentlyAdded, compareMedNames, NEW_BADGE_DAYS } from '../public/assets/js/core/med-order.js';

const med = (id, name, category, sortOrder, createdAt) => ({ id, name, category, sortOrder, createdAt });
const listed = (meds, category) => meds.filter((m) => m.category === category).sort((a, b) => a.sortOrder - b.sortOrder).map((m) => m.name);
const insert = (meds, added) => meds.concat([Object.assign({}, added, { sortOrder: orderForNewMed(meds, added) })]);

test('the A→Z button puts every category in alphabetical order and touches nothing else', () => {
  const meds = [med('1', 'Ondansetron', 'Injections', 100), med('2', 'Atropine', 'Injections', 200), med('3', 'Salbutamol', 'Inhalers', 300), med('4', 'Budesonide', 'Inhalers', 400), med('5', 'Heparin', 'Injections', 500)];
  const sorted = alphabeticalOrder(meds);
  assert.deepEqual(listed(sorted, 'Injections'), ['Atropine', 'Heparin', 'Ondansetron']);
  assert.deepEqual(listed(sorted, 'Inhalers'), ['Budesonide', 'Salbutamol']);
  assert.deepEqual(sorted.map((m) => m.id), meds.map((m) => m.id));
  assert.equal(sorted[0].name, 'Ondansetron');
  assert.equal(meds[0].sortOrder, 100, 'the input is not mutated');
});

test('names compare without regard to case, and numbers by value', () => {
  assert.ok(compareMedNames({ name: 'adrenaline' }, { name: 'Atropine' }) < 0);
  assert.ok(compareMedNames({ name: 'Vit 2' }, { name: 'Vit 10' }) < 0);
});

test('a new medicine goes to its alphabetical place inside its own category', () => {
  let meds = alphabeticalOrder([med('1', 'Atropine', 'Injections', 1), med('2', 'Heparin', 'Injections', 2), med('3', 'Zinc', 'Injections', 3), med('4', 'Salbutamol', 'Inhalers', 4)]);
  meds = insert(meds, med('5', 'Morphine', 'Injections'));
  meds = insert(meds, med('6', 'Adenosine', 'Injections'));
  meds = insert(meds, med('7', 'Aminophylline', 'Injections'));
  meds = insert(meds, med('8', 'Yohimbine', 'Injections'));
  assert.deepEqual(listed(meds, 'Injections'), ['Adenosine', 'Aminophylline', 'Atropine', 'Heparin', 'Morphine', 'Yohimbine', 'Zinc']);
  assert.deepEqual(listed(meds, 'Inhalers'), ['Salbutamol']);
});

test('many insertions in one gap keep the order', () => {
  let meds = alphabeticalOrder([med('1', 'A', 'X', 1), med('2', 'Z', 'X', 2)]);
  'MLKJIHGFEDCB'.split('').forEach((name, i) => { meds = insert(meds, med('n' + i, name, 'X')); });
  assert.deepEqual(listed(meds, 'X'), ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'Z']);
});

test('a category arranged by hand is not reshuffled: the new medicine goes to its end', () => {
  const meds = [med('1', 'Zinc', 'Injections', 100), med('2', 'Atropine', 'Injections', 200)];
  assert.equal(orderForNewMed(meds, med('3', 'Heparin', 'Injections')), 300);
});

test('the first medicine of a category, and a category with none, get a sensible number', () => {
  assert.equal(orderForNewMed([], med('1', 'A', 'X')), 100);
  const meds = [med('1', 'Beta', 'X', 100), med('2', 'Gamma', 'X', 200)];
  const order = orderForNewMed(meds, med('3', 'Alpha', 'X'));
  assert.ok(order < 100);
});

test('"new" lasts a week from creation', () => {
  const now = Date.parse('2026-10-11T12:00:00Z');
  const day = 86400000;
  assert.equal(isRecentlyAdded({ createdAt: new Date(now - 2 * day).toISOString() }, now), true);
  assert.equal(isRecentlyAdded({ createdAt: new Date(now - (NEW_BADGE_DAYS * day - 1000)).toISOString() }, now), true);
  assert.equal(isRecentlyAdded({ createdAt: new Date(now - NEW_BADGE_DAYS * day - 1000).toISOString() }, now), false);
  assert.equal(isRecentlyAdded({ createdAt: '' }, now), false);
  assert.equal(isRecentlyAdded({}, now), false);
});

import { moveInCategory } from '../public/assets/js/core/med-order.js';
test('arrows move a medicine even when sortOrder values are equal or missing', () => {
  const meds = [med('1', 'A', 'Injections', 100), med('2', 'B', 'Injections', 100), med('3', 'C', 'Injections', undefined), med('4', 'X', 'Inhalers', 100)];
  const up = moveInCategory(meds, '3', -1);
  assert.deepEqual(listed(up, 'Injections'), ['A', 'C', 'B']);
  assert.equal(up.find((m) => m.id === '4').sortOrder, 100);
  assert.deepEqual(listed(moveInCategory(up, '3', -1), 'Injections'), ['C', 'A', 'B']);
  assert.deepEqual(listed(moveInCategory(up, '3', -1).concat(), 'Injections').length, 3);
});

import { readFileSync } from 'node:fs';
test('the A→Z button sits in the inventory toolbar, not inside the duplicates banner that is hidden by default', () => {
  const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
  const banner = html.slice(html.indexOf('id="dup-banner"'), html.indexOf('id="bulk-bar"'));
  assert.ok(!banner.includes('inv-alpha-btn'));
  assert.ok(html.indexOf('inv-alpha-btn') > html.indexOf('id="pg-inv"') && html.indexOf('inv-alpha-btn') < html.indexOf('id="bulk-bar"'));
});
