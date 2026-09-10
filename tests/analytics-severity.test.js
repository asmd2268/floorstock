import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  spikeBadgeClass, shareBadgeClass, fulfillBadgeClass,
  spikeThresholdPct, canEditSpikeThreshold, thresholdIsValid, saveSpikeThreshold,
  renderThresholdControl, renderSpikeLegend, renderFulfillLegend,
  SHARE_TIERS, FULFILL_TIERS,
} from '../public/assets/js/core/analytics-severity.js';

/* The first slice out of modules/73 (2,175 lines): the grading vocabulary every
   analytics report reads a number through. Three gradings share one set of CSS
   classes, and two of them run in opposite directions — which is exactly why
   they belong in one tested file rather than one copy per report. */

async function withGlobals(values, run) {
  const saved = new Map(Object.keys(values).map((key) => [key, globalThis[key]]));
  Object.assign(globalThis, values);
  try { return await run(); } finally {
    for (const [key, value] of saved) {
      if (value === undefined) delete globalThis[key]; else globalThis[key] = value;
    }
  }
}

test('a spike is graded against the threshold, not against a fixed number', () => {
  // At 30%: mid from 30, high from 45, extreme from 75.
  assert.equal(spikeBadgeClass(29, 30), 'mid', 'below the threshold it is not shown at all, but it grades as mid');
  assert.equal(spikeBadgeClass(30, 30), 'mid');
  assert.equal(spikeBadgeClass(44, 30), 'mid');
  assert.equal(spikeBadgeClass(45, 30), 'high');
  assert.equal(spikeBadgeClass(74, 30), 'high');
  assert.equal(spikeBadgeClass(75, 30), 'extreme');
  // Change the hospital's threshold and the same rise grades differently.
  assert.equal(spikeBadgeClass(75, 60), 'mid');
});

test('share and fulfilment run in opposite directions', () => {
  // Share: a bigger slice of the total is the notable end.
  assert.equal(shareBadgeClass(SHARE_TIERS.mid - 1), 'low');
  assert.equal(shareBadgeClass(SHARE_TIERS.mid), 'mid');
  assert.equal(shareBadgeClass(SHARE_TIERS.high), 'high');
  assert.equal(shareBadgeClass(SHARE_TIERS.extreme), 'extreme');
  // Fulfilment: a smaller share of what was asked for is the bad end.
  assert.equal(fulfillBadgeClass(FULFILL_TIERS.good), 'good');
  assert.equal(fulfillBadgeClass(FULFILL_TIERS.good - 1), 'mid');
  assert.equal(fulfillBadgeClass(FULFILL_TIERS.mid - 1), 'high');
  assert.equal(fulfillBadgeClass(FULFILL_TIERS.low - 1), 'extreme');
  assert.equal(fulfillBadgeClass(100), 'good');
  assert.equal(fulfillBadgeClass(0), 'extreme');
});

test('a missing or nonsensical saved threshold falls back to 30%', async () => {
  assert.equal(await withGlobals({ S: undefined }, spikeThresholdPct), 30);
  assert.equal(await withGlobals({ S: { g: () => null } }, spikeThresholdPct), 30);
  assert.equal(await withGlobals({ S: { g: () => 0 } }, spikeThresholdPct), 30);
  assert.equal(await withGlobals({ S: { g: () => 'nonsense' } }, spikeThresholdPct), 30);
  assert.equal(await withGlobals({ S: { g: () => 45 } }, spikeThresholdPct), 45);
});

test('only the roles the security rules would accept may change the threshold', async () => {
  /* The others may VIEW this page, so a field they can type in would save
     nothing and say nothing — the write is refused server-side. */
  const may = (role, extra = {}) => withGlobals(
    { fsEffectiveRole: () => role, CU: { role }, isMasterActual: () => false, ...extra },
    canEditSpikeThreshold,
  );
  assert.equal(await may('pharmacy'), true);
  assert.equal(await may('pharmacy_director'), true);
  assert.equal(await may('inpatient_supervisor'), false);
  assert.equal(await may('department'), false);
  // A Master testing as another role is still the Master.
  assert.equal(await may('department', { isMasterActual: () => true }), true);
});

test('someone who may not edit gets a disabled field and no save button', async () => {
  const html = await withGlobals(
    { fsEffectiveRole: () => 'inpatient_supervisor', CU: { role: 'inpatient_supervisor' }, isMasterActual: () => false, S: { g: () => 30 } },
    () => renderThresholdControl('anl-x'),
  );
  assert.match(html, /disabled/);
  assert.doesNotMatch(html, /<button/);
});

test('the threshold must stay inside a range that can still grade anything', () => {
  assert.equal(thresholdIsValid(1), true);
  assert.equal(thresholdIsValid(500), true);
  assert.equal(thresholdIsValid(0), false);
  assert.equal(thresholdIsValid(501), false);
  assert.equal(thresholdIsValid(Number.NaN), false);
});

test('a rejected threshold is never written, and a failed write says so', async () => {
  const writes = [];
  const toasts = [];
  await withGlobals(
    { S: { s: async (key, value) => writes.push([key, value]) }, toast: (message, kind) => toasts.push(kind) },
    async () => {
      assert.equal(await saveSpikeThreshold(900), null);
      assert.equal(writes.length, 0, 'an out-of-range threshold never reaches Firestore');
      assert.equal(await saveSpikeThreshold('45'), 45, 'a field value arrives as a string');
      assert.deepEqual(writes, [['analytics_spike_threshold_pct', 45]]);
    },
  );
  assert.deepEqual(toasts, ['err', 'succ']);

  const failed = await withGlobals(
    { S: { s: async () => { throw new Error('permission-denied'); } }, toast: () => {} },
    () => saveSpikeThreshold(40),
  );
  assert.equal(failed, null, 'a refused write is reported, not swallowed as success');
});

test('the legends describe the tiers they actually grade by', () => {
  assert.match(renderSpikeLegend(30), /\+30%/);
  assert.match(renderSpikeLegend(30), /\+45%/);
  assert.match(renderSpikeLegend(30), /\+75%/);
  assert.match(renderFulfillLegend(), new RegExp(`${FULFILL_TIERS.good}%\\+`));
});
