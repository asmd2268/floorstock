/* How every analytics report grades a number, and who may change the rule.

   Three separate gradings, one visual language (the `anl-spike-badge` classes),
   and they are easy to confuse — so they live together where the difference is
   visible:

     spike   — how far consumption ROSE against the prior period. Tiered off a
               single saved threshold, so a director can decide what counts as
               a spike in this hospital.
     share   — how much of a total ONE item accounts for. Higher is more notable.
     fulfil  — how much of what was requested actually arrived. The ramp runs the
               other way: LOW is the bad end.

   These were defined once per IIFE inside modules/73 and had to be edited in
   lockstep. The permission to change the threshold had drifted into two copies
   already — `canEditSpikeThreshold` and `canEditSpikeThresholdShared`, differing
   only in how they asked for the role — and the save path existed twice with the
   same validation written out twice. One of each now. */

const SPIKE_THRESHOLD_KEY = 'analytics_spike_threshold_pct';
const SHARE_TIERS = { mid: 15, high: 25, extreme: 40 };
const FULFILL_TIERS = { good: 95, mid: 80, low: 60 };
/* A threshold outside this range grades every row the same way, which is a
   report that says nothing. */
const THRESHOLD_MIN = 1;
const THRESHOLD_MAX = 500;
const DEFAULT_THRESHOLD = 30;

function effectiveRole() {
  return String(globalThis.fsEffectiveRole ? globalThis.fsEffectiveRole() : (globalThis.CU && globalThis.CU.role) || '');
}

export function spikeThresholdPct() {
  const value = Number(globalThis.S && typeof globalThis.S.g === 'function' ? globalThis.S.g(SPIKE_THRESHOLD_KEY) : null);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_THRESHOLD;
}

/* firestore.rules lets only pharmacy and pharmacy_director write an
   unrestricted state key; the other roles that may VIEW this page are limited to
   a docId pattern this setting is not part of, so their save would be rejected
   server-side without saying so. The Master is asked for by actual identity —
   `CU.master` alone misses a Master currently testing as another role. */
export function canEditSpikeThreshold() {
  return ['pharmacy', 'pharmacy_director'].includes(effectiveRole())
    || (typeof globalThis.isMasterActual === 'function'
      ? globalThis.isMasterActual()
      : !!(globalThis.CU && globalThis.CU.master));
}

export function thresholdIsValid(value) {
  return Number.isFinite(value) && value >= THRESHOLD_MIN && value <= THRESHOLD_MAX;
}

export function spikeBadgeClass(pct, threshold) {
  if (pct >= threshold * 2.5) return 'extreme';
  if (pct >= threshold * 1.5) return 'high';
  return 'mid';
}

export function spikeBadge(pct, threshold) {
  return `<span class="anl-spike-badge ${spikeBadgeClass(pct, threshold)}">+${pct}%</span>`;
}

export function renderSpikeLegend(threshold) {
  return `<div class="anl-legend">
    <b>Legend / الدليل:</b>
    <span><span class="anl-spike-badge mid">+${threshold}%</span> ${threshold}–${Math.round(threshold * 1.5 - 1)}% increase</span>
    <span><span class="anl-spike-badge high">+${Math.round(threshold * 1.5)}%</span> ${Math.round(threshold * 1.5)}–${Math.round(threshold * 2.5 - 1)}% increase</span>
    <span><span class="anl-spike-badge extreme">+${Math.round(threshold * 2.5)}%</span> ${Math.round(threshold * 2.5)}%+ increase</span>
  </div>`;
}

export function shareBadgeClass(sharePct) {
  if (sharePct >= SHARE_TIERS.extreme) return 'extreme';
  if (sharePct >= SHARE_TIERS.high) return 'high';
  if (sharePct >= SHARE_TIERS.mid) return 'mid';
  return 'low';
}

export function shareBadge(sharePct) {
  return `<span class="anl-spike-badge ${shareBadgeClass(sharePct)}">${sharePct}%</span>`;
}

export function renderShareLegend() {
  return `<div class="anl-legend">
    <b>Legend / الدليل:</b>
    <span><span class="anl-spike-badge low">&lt;${SHARE_TIERS.mid}%</span> normal share</span>
    <span><span class="anl-spike-badge mid">${SHARE_TIERS.mid}%</span> ${SHARE_TIERS.mid}–${SHARE_TIERS.high - 1}% of total</span>
    <span><span class="anl-spike-badge high">${SHARE_TIERS.high}%</span> ${SHARE_TIERS.high}–${SHARE_TIERS.extreme - 1}% of total</span>
    <span><span class="anl-spike-badge extreme">${SHARE_TIERS.extreme}%</span> ${SHARE_TIERS.extreme}%+ of total</span>
  </div>`;
}

export function fulfillBadgeClass(pct) {
  if (pct >= FULFILL_TIERS.good) return 'good';
  if (pct >= FULFILL_TIERS.mid) return 'mid';
  if (pct >= FULFILL_TIERS.low) return 'high';
  return 'extreme';
}

export function fulfillBadge(pct) {
  return `<span class="anl-spike-badge ${fulfillBadgeClass(pct)}">${pct}%</span>`;
}

export function renderFulfillLegend() {
  return `<div class="anl-legend">
    <b>Legend / الدليل:</b>
    <span><span class="anl-spike-badge good">${FULFILL_TIERS.good}%+</span> Fully fulfilled / تلبية كاملة</span>
    <span><span class="anl-spike-badge mid">${FULFILL_TIERS.mid}–${FULFILL_TIERS.good - 1}%</span> Minor shortfall / نقص طفيف</span>
    <span><span class="anl-spike-badge high">${FULFILL_TIERS.low}–${FULFILL_TIERS.mid - 1}%</span> Significant shortfall / نقص ملحوظ</span>
    <span><span class="anl-spike-badge extreme">&lt;${FULFILL_TIERS.low}%</span> Severe shortfall / نقص حاد</span>
  </div>`;
}

/* The one save path. Both places that let someone change the threshold — the
   quarterly report's own field and the shared control on the other tabs — used
   to carry their own copy of the validation, the write, the audit entry and the
   two toasts. */
export async function saveSpikeThreshold(rawValue, onSaved) {
  const value = Math.round(Number(rawValue));
  if (!thresholdIsValid(value)) {
    if (globalThis.toast) globalThis.toast('Enter a threshold between 1 and 500%. / أدخل نسبة بين 1 و500%', 'err');
    return null;
  }
  try {
    await globalThis.S.s(SPIKE_THRESHOLD_KEY, value);
    if (typeof globalThis.auditAction === 'function') globalThis.auditAction('analytics_spike_threshold_changed', { thresholdPct: value });
    if (globalThis.toast) globalThis.toast('Threshold saved ✓ / تم حفظ النسبة ✓', 'succ');
    if (typeof onSaved === 'function') onSaved();
    return value;
  } catch (error) {
    if (globalThis.toast) globalThis.toast('Threshold was not saved. / لم يتم حفظ النسبة', 'err');
    return null;
  }
}

export function renderThresholdControl(idPrefix) {
  const threshold = spikeThresholdPct();
  const canEdit = canEditSpikeThreshold();
  return `<span class="anl-threshold-ctl">Spike threshold / حد الارتفاع:
    <input type="number" id="${idPrefix}-input" min="${THRESHOLD_MIN}" max="${THRESHOLD_MAX}" value="${threshold}"${canEdit ? '' : ' disabled title="Only pharmacy director / master can change this. / فقط مدير الصيدلية / الماستر يقدر يغيّرها"'}>%
    ${canEdit ? `<button class="btn bg bsm" id="${idPrefix}-save">Save / حفظ</button>` : ''}
  </span>`;
}

export function bindThresholdControl(idPrefix, onSaved) {
  const input = document.getElementById(idPrefix + '-input');
  const button = document.getElementById(idPrefix + '-save');
  if (!button || button.dataset.bound) return;
  button.dataset.bound = '1';
  button.addEventListener('click', async () => {
    const saved = await saveSpikeThreshold(input.value, onSaved);
    if (saved === null && input) input.value = spikeThresholdPct();
  });
}

export { SPIKE_THRESHOLD_KEY, SHARE_TIERS, FULFILL_TIERS, THRESHOLD_MIN, THRESHOLD_MAX };
