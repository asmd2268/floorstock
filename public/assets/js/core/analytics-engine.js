/**
 * FloorStock Analytics Engine
 * Single source of truth for all analytics computation.
 * Pure functions — no DOM, no side effects.
 */
import { buildAnalyticsMedicineIndex, resolveAnalyticsMedicine } from './analytics-medicine-resolver.js?v=28ce20a94d';

export function allRows() {
  // request_analytics_archive: legacy full-detail archive (pre-existing data
  // only — order-retention.js stopped writing new records here once it
  // switched to compact monthly aggregates, since a single ever-growing
  // Firestore document risked its 1MiB limit). request_analytics_summary_v1:
  // the compact replacement — one synthetic row per month×department with
  // dispensed[] already summed, shaped identically to a real request row so
  // every function below (computeStats, rowsForPeriod, etc.) needs no
  // special-casing for aggregated vs. individual data.
  return (typeof window.gr === 'function' ? window.gr() : [])
    .concat((window.S && window.S.g && window.S.g('request_analytics_archive')) || [])
    .concat((window.S && window.S.g && window.S.g('request_analytics_summary_v1')) || [])
    .filter(r => r && r.status !== 'pending');
}

export function rowDate(row) {
  const d = new Date(row.fulfilledAt || row.created || '');
  return isNaN(d) ? null : d;
}

export function deptLabel(id) {
  const list = typeof window.gd === 'function' ? window.gd() : [];
  const d = list.find(x => String(x.id) === String(id));
  return (d && d.name) || id || '—';
}

export function availableYears() {
  const years = {};
  allRows().forEach(r => { const d = rowDate(r); if (d) years[d.getFullYear()] = true; });
  years[new Date().getFullYear()] = true;
  return Object.keys(years).map(Number).sort((a, b) => b - a);
}

export function rowsForPeriod(year, quarter) {
  return allRows().filter(r => {
    const d = rowDate(r);
    if (!d) return false;
    if (d.getFullYear() !== year) return false;
    return quarter === 'all' || Math.floor(d.getMonth() / 3) + 1 === Number(quarter);
  });
}

/**
 * Compute full statistics for an array of rows.
 * Returns:
 *   orders, units, departments{name→{orders,units,zeroDispenseReqs}},
 *   routine{name→{qty,depts}}, high{name→{qty,depts}}
 */
export function computeStats(rows) {
  const medicines = buildAnalyticsMedicineIndex();
  const departments = {};
  const routine = {};
  const high = {};

  // What a ward asked for versus what it actually received. Total units alone
  // cannot show this: a department can be the busiest in the hospital and still
  // be the worst served.
  const shortfalls = {}; // medKey → { name, requested, served, short, depts }

  rows.forEach(r => {
    const dept = deptLabel(r.deptId);
    if (!departments[dept]) departments[dept] = { orders: 0, units: 0, zeroDispenseReqs: 0, requested: 0, served: 0 };
    departments[dept].orders++;

    /* Matched per request and per medicine, never as two grand totals: dispensing
       200 of one medicine does not make up for sending none of another, and
       netting them off would hide exactly the shortage worth knowing about. */
    const wantByMed = {}, gotByMed = {};
    (r.items || []).forEach(line => {
      const qty = Math.max(0, Number(line.qty) || 0);
      if (qty <= 0) return;
      const med = resolveAnalyticsMedicine(line, r.deptId, medicines, r);
      const key = medKey(med.name);
      if (!wantByMed[key]) wantByMed[key] = { name: med.name, qty: 0 };
      wantByMed[key].qty += qty;
    });
    (r.dispensed || []).forEach(line => {
      const qty = Math.max(0, Number(line.qty) || 0);
      if (qty <= 0) return;
      const med = resolveAnalyticsMedicine(line, r.deptId, medicines, r);
      const key = medKey(med.name);
      gotByMed[key] = (gotByMed[key] || 0) + qty;
    });
    Object.keys(wantByMed).forEach(key => {
      const want = wantByMed[key].qty;
      const got = Math.min(gotByMed[key] || 0, want); // surplus is not service
      departments[dept].requested += want;
      departments[dept].served += got;
      if (!shortfalls[key]) shortfalls[key] = { name: wantByMed[key].name, requested: 0, served: 0, short: 0, depts: {} };
      const bucket = shortfalls[key];
      bucket.requested += want;
      bucket.served += got;
      if (want > got) {
        bucket.short += want - got;
        bucket.depts[dept] = (bucket.depts[dept] || 0) + (want - got);
      }
    });

    const lines = r.dispensed || [];
    const deptTotal = lines.reduce((s, l) => s + Math.max(0, Number(l.qty) || 0), 0);
    if (deptTotal === 0) departments[dept].zeroDispenseReqs++;

    lines.forEach(line => {
      const qty = Number(line.qty) || 0;
      if (qty <= 0) return;
      const med = resolveAnalyticsMedicine(line, r.deptId, medicines, r);
      const bucket = med.high ? high : routine;
      const key = medKey(med.name);
      if (!bucket[key]) bucket[key] = { name: med.name, qty: 0, depts: {} };
      bucket[key].qty += qty;
      bucket[key].depts[dept] = (bucket[key].depts[dept] || 0) + qty;
      departments[dept].units += qty;
    });
  });

  const units = Object.values(departments).reduce((s, d) => s + d.units, 0);
  Object.values(departments).forEach(d => {
    d.fillRate = d.requested > 0 ? Math.round(d.served / d.requested * 1000) / 10 : null;
  });
  return { orders: rows.length, units, departments, routine, high, shortfalls, service: serviceMetrics(rows, high, units) };
}

/* Service metrics.
 *
 * The report has always counted what was dispensed, never what was asked for, so a
 * department receiving a fraction of its requests looked identical to one being
 * served in full. These read fields the engine already had available on every row
 * — items, created, fulfilledAt, scheduledFor — and were simply never used.
 *
 * Every measure is computed only over the rows that carry the field it needs, and
 * reports that denominator alongside the value, so a period with partial history
 * shows a smaller sample rather than a wrong number.
 */
function serviceMetrics(rows, high, totalUnits) {
  let requested = 0, dispensed = 0, withItems = 0;
  let full = 0, partial = 0, unfilled = 0;
  const turnaroundHours = [];
  let scheduled = 0, onTime = 0;
  let highUnits = 0;

  Object.values(high || {}).forEach(m => { highUnits += m.qty; });

  rows.forEach(r => {
    const want = (r.items || []).reduce((s, i) => s + Math.max(0, Number(i.qty) || 0), 0);
    const got = (r.dispensed || []).reduce((s, l) => s + Math.max(0, Number(l.qty) || 0), 0);
    if (want > 0) {
      withItems++;
      requested += want;
      dispensed += Math.min(got, want); // over-dispensing must not read as >100% served
      if (got <= 0) unfilled++;
      else if (got < want) partial++;
      else full++;
    }
    /* An archived month is one synthetic row standing for many orders, with created
       and fulfilledAt both set to the month start. Timing it would add a 0-hour
       entry per archived month and pull the median toward zero, so rows marked as
       aggregated are excluded from the timing measures — they still count toward
       volume, where their totals are real. */
    if (!r.__aggregated) {
      const created = r.created ? Date.parse(r.created) : NaN;
      const done = r.fulfilledAt ? Date.parse(r.fulfilledAt) : NaN;
      if (isFinite(created) && isFinite(done) && done >= created) {
        turnaroundHours.push((done - created) / 3600000);
      }
      const due = r.scheduledFor ? Date.parse(r.scheduledFor) : NaN;
      if (isFinite(due) && isFinite(done)) {
        scheduled++;
        if (done <= due) onTime++;
      }
    }
  });

  // Median, not mean: one order left open over a weekend should not move the figure.
  turnaroundHours.sort((a, b) => a - b);
  const mid = turnaroundHours.length
    ? (turnaroundHours.length % 2
        ? turnaroundHours[(turnaroundHours.length - 1) / 2]
        : (turnaroundHours[turnaroundHours.length / 2 - 1] + turnaroundHours[turnaroundHours.length / 2]) / 2)
    : null;

  return {
    requestedUnits: requested,
    dispensedUnits: dispensed,
    fillRate: requested ? dispensed / requested : null,
    ordersWithItems: withItems,
    fullyFilled: full,
    partiallyFilled: partial,
    unfilled,
    medianTurnaroundHours: mid,
    turnaroundSample: turnaroundHours.length,
    scheduledOrders: scheduled,
    onTimeOrders: onTime,
    onTimeRate: scheduled ? onTime / scheduled : null,
    highAlertUnits: highUnits,
    highAlertShare: totalUnits ? highUnits / totalUnits : null
  };
}

/* Medicines were bucketed by their raw typed name, so "Paracetamol 500 mg Tablet"
   and "Paracetamol 500mg Tablet" were two different medicines: each carried half
   the units, both lost their true rank in the top-10, and a name corrected partway
   through a year read as one medicine appearing from nothing while another
   collapsed to zero -- a spike and a crash that never happened. Bucket on the
   normalised identity the rest of the app already uses (fsR17MedNorm, owned by
   03c-medication-expiry-shelf-helpers) and keep the first spelling seen for
   display. Falling back to the raw name preserves today's behaviour if the
   helper has not loaded yet. */
function medKey(name) {
  const raw = String(name == null ? '' : name);
  const norm = typeof globalThis.fsR17MedNorm === 'function' ? globalThis.fsR17MedNorm(raw) : '';
  return norm || raw;
}

export function topMedicines(group, n = 10) {
  return Object.entries(group)
    .map(([key, m]) => ({ name: m.name || key, key, qty: m.qty, depts: m.depts }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, n);
}

export function priorPeriod(year, quarter) {
  if (quarter === 'all') return { year: year - 1, quarter: 'all' };
  const q = Number(quarter);
  return q === 1 ? { year: year - 1, quarter: '4' } : { year, quarter: String(q - 1) };
}

export function sameQuarterPriorYear(year, quarter) {
  return { year: year - 1, quarter };
}

export function periodLabel(year, quarter) {
  return quarter === 'all' ? `${year}` : `Q${quarter} ${year}`;
}

/**
 * Detect medicines whose consumption increased by ≥ threshold % between two row sets.
 * Returns { perDept: [...], overall: [...] } sorted by pctChange desc.
 */
export function detectSpikes(currentRows, priorRows, threshold = 30) {
  const medicines = buildAnalyticsMedicineIndex();

  // Shared across both periods so a medicine renamed between them keeps one
  // label, instead of the prior period's spelling shadowing the current one.
  const medNames = {};
  function aggregate(rows) {
    const byMed = {}; // medKey → deptName → qty
    rows.forEach(r => {
      const dept = deptLabel(r.deptId);
      (r.dispensed || []).forEach(line => {
        const qty = Number(line.qty) || 0;
        if (qty <= 0) return;
        const med = resolveAnalyticsMedicine(line, r.deptId, medicines, r);
        const key = medKey(med.name);
        if (!medNames[key]) medNames[key] = med.name;
        if (!byMed[key]) byMed[key] = {};
        byMed[key][dept] = (byMed[key][dept] || 0) + qty;
      });
    });
    return byMed;
  }
  const medLabel = (key) => medNames[key] || key;

  const curr = aggregate(currentRows);
  const prev = aggregate(priorRows);

  const perDept = [];
  const overallCurr = {};
  const overallPrev = {};

  Object.keys(curr).forEach(med => {
    const total = Object.values(curr[med]).reduce((s, v) => s + v, 0);
    overallCurr[med] = total;
  });
  Object.keys(prev).forEach(med => {
    const total = Object.values(prev[med]).reduce((s, v) => s + v, 0);
    overallPrev[med] = total;
  });

  Object.keys(curr).forEach(med => {
    Object.keys(curr[med]).forEach(dept => {
      const c = curr[med][dept];
      const p = (prev[med] || {})[dept] || 0;
      if (p > 0) {
        const pct = Math.round((c - p) / p * 1000) / 10;
        if (pct >= threshold) perDept.push({ medicine: medLabel(med), dept, current: c, prior: p, pctChange: pct });
      }
    });
  });

  const overall = Object.keys(overallCurr)
    .filter(med => (overallPrev[med] || 0) > 0)
    .map(med => {
      const c = overallCurr[med], p = overallPrev[med];
      return { medicine: medLabel(med), current: c, prior: p, pctChange: Math.round((c - p) / p * 1000) / 10 };
    })
    .filter(x => x.pctChange >= threshold);

  return {
    perDept: perDept.sort((a, b) => b.pctChange - a.pctChange),
    overall: overall.sort((a, b) => b.pctChange - a.pctChange),
  };
}

/**
 * Zero-dispense summary: departments that had fulfilled requests but 0 units dispensed.
 */
export function zeroDispenseSummary(rows) {
  const stats = computeStats(rows);
  return Object.entries(stats.departments)
    .filter(([, d]) => d.zeroDispenseReqs > 0)
    .map(([name, d]) => ({ dept: name, zeroReqs: d.zeroDispenseReqs, totalReqs: d.orders }))
    .sort((a, b) => b.zeroReqs - a.zeroReqs);
}


/* Medicines a ward asked for and did not get, ranked by the units missing.
   Ordered by units short rather than by percentage so a medicine missing 900 of
   1000 outranks one missing all 3 of 3 -- the first is a supply problem, the
   second is usually a single stray order. */
export function topShortfalls(stats, n = 10, minShort = 1) {
  return Object.entries(stats.shortfalls || {})
    .map(([key, m]) => ({
      key,
      name: m.name || key,
      requested: m.requested,
      served: m.served,
      short: m.short,
      fillRate: m.requested > 0 ? Math.round(m.served / m.requested * 1000) / 10 : null,
      depts: m.depts
    }))
    .filter(m => m.short >= minShort)
    .sort((a, b) => b.short - a.short)
    .slice(0, n);
}

/* Departments ranked by how much of what they asked for actually arrived. */
export function departmentFillRates(stats, minRequested = 1) {
  return Object.entries(stats.departments || {})
    .filter(([, d]) => d.requested >= minRequested)
    .map(([dept, d]) => ({ dept, requested: d.requested, served: d.served, short: d.requested - d.served, fillRate: d.fillRate }))
    .sort((a, b) => (a.fillRate ?? 101) - (b.fillRate ?? 101));
}

function median(sorted) {
  if (!sorted.length) return null;
  const mid = sorted.length / 2;
  return sorted.length % 2 ? sorted[(sorted.length - 1) / 2] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/* A quantity typed with one digit too many is invisible in a total but wrecks
   every average built on it. Flag values that stand far outside what the same
   medicine normally moves.

   Median and MAD rather than mean and standard deviation: an outlier drags a
   mean toward itself and inflates the deviation, so the very value being hunted
   raises the bar until it clears it. Both robust measures ignore it.

   A medicine needs a real history before "normal" means anything, and the value
   must be both statistically distant AND a large multiple of the usual -- on
   quantities like 1 and 2 a robust score alone fires constantly. */
export function detectQuantityOutliers(rows, { minSamples = 8, minScore = 6, minFactor = 8, limit = 25 } = {}) {
  const medicines = buildAnalyticsMedicineIndex();
  const samples = {}; // medKey → { name, values:[], events:[] }

  rows.forEach(r => {
    if (r.__aggregated) return; // a month rolled into one row has no per-entry quantity
    (r.dispensed || []).forEach(line => {
      const qty = Number(line.qty) || 0;
      if (qty <= 0) return;
      const med = resolveAnalyticsMedicine(line, r.deptId, medicines, r);
      const key = medKey(med.name);
      if (!samples[key]) samples[key] = { name: med.name, values: [], events: [] };
      samples[key].values.push(qty);
      samples[key].events.push({ qty, dept: deptLabel(r.deptId), at: r.fulfilledAt || r.created || '' });
    });
  });

  const found = [];
  Object.values(samples).forEach(m => {
    if (m.values.length < minSamples) return;
    const sorted = m.values.slice().sort((a, b) => a - b);
    const med = median(sorted);
    if (!med || med <= 0) return;
    const mad = median(m.values.map(v => Math.abs(v - med)).sort((a, b) => a - b));
    // A perfectly uniform history has MAD 0, which would make every score
    // infinite; fall back to the multiple-of-normal test alone.
    const scale = mad > 0 ? mad * 1.4826 : 0;
    m.events.forEach(ev => {
      const factor = ev.qty / med;
      if (factor < minFactor) return;
      const score = scale > 0 ? Math.abs(ev.qty - med) / scale : Infinity;
      if (score < minScore) return;
      found.push({
        medicine: m.name,
        dept: ev.dept,
        qty: ev.qty,
        typical: Math.round(med * 10) / 10,
        factor: Math.round(factor * 10) / 10,
        at: ev.at,
        samples: m.values.length
      });
    });
  });

  return found.sort((a, b) => b.factor - a.factor).slice(0, limit);
}
