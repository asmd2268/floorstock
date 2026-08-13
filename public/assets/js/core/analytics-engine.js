/**
 * FloorStock Analytics Engine
 * Single source of truth for all analytics computation.
 * Pure functions — no DOM, no side effects.
 */
import { buildAnalyticsMedicineIndex, resolveAnalyticsMedicine } from './analytics-medicine-resolver.js';

export function allRows() {
  return (typeof window.gr === 'function' ? window.gr() : [])
    .concat((window.S && window.S.g && window.S.g('request_analytics_archive')) || [])
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

  rows.forEach(r => {
    const dept = deptLabel(r.deptId);
    if (!departments[dept]) departments[dept] = { orders: 0, units: 0, zeroDispenseReqs: 0 };
    departments[dept].orders++;

    const lines = r.dispensed || [];
    const deptTotal = lines.reduce((s, l) => s + Math.max(0, Number(l.qty) || 0), 0);
    if (deptTotal === 0) departments[dept].zeroDispenseReqs++;

    lines.forEach(line => {
      const qty = Number(line.qty) || 0;
      if (qty <= 0) return;
      const med = resolveAnalyticsMedicine(line, r.deptId, medicines, r);
      const bucket = med.high ? high : routine;
      if (!bucket[med.name]) bucket[med.name] = { qty: 0, depts: {} };
      bucket[med.name].qty += qty;
      bucket[med.name].depts[dept] = (bucket[med.name].depts[dept] || 0) + qty;
      departments[dept].units += qty;
    });
  });

  const units = Object.values(departments).reduce((s, d) => s + d.units, 0);
  return { orders: rows.length, units, departments, routine, high };
}

export function topMedicines(group, n = 10) {
  return Object.entries(group)
    .map(([name, m]) => ({ name, qty: m.qty, depts: m.depts }))
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

  function aggregate(rows) {
    const byMed = {}; // medName → deptName → qty
    rows.forEach(r => {
      const dept = deptLabel(r.deptId);
      (r.dispensed || []).forEach(line => {
        const qty = Number(line.qty) || 0;
        if (qty <= 0) return;
        const med = resolveAnalyticsMedicine(line, r.deptId, medicines, r);
        if (!byMed[med.name]) byMed[med.name] = {};
        byMed[med.name][dept] = (byMed[med.name][dept] || 0) + qty;
      });
    });
    return byMed;
  }

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
        if (pct >= threshold) perDept.push({ medicine: med, dept, current: c, prior: p, pctChange: pct });
      }
    });
  });

  const overall = Object.keys(overallCurr)
    .filter(med => (overallPrev[med] || 0) > 0)
    .map(med => {
      const c = overallCurr[med], p = overallPrev[med];
      return { medicine: med, current: c, prior: p, pctChange: Math.round((c - p) / p * 1000) / 10 };
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
