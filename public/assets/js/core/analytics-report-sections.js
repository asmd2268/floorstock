/* The quarterly and annual report, section by section.

   Every function here turns a computed statistic into the HTML for one block of
   the report — the KPI row, the quarter table, the department bars, the medicine
   tables, the shortfalls, the fill rates, the outliers, the spikes, the
   zero-dispense list. No reading, no writing, no state: statistics in, markup
   out, which is what makes them testable at all.

   Two habits run through them and both are deliberate. A measure is shown with
   the sample it was computed over, so a period whose history is partly archived
   reads as a small sample rather than a confident wrong number. And an empty
   section says why it is empty in both languages instead of rendering nothing,
   because a blank panel is indistinguishable from a broken one.

   Lifted out of modules/73. */

import { fsEsc as esc } from './dom-utils.js?v=b2909b7f46';
import {
  rowsForPeriod, computeStats, topMedicines, deptLabel,
  detectSpikes, zeroDispenseSummary, topShortfalls, departmentFillRates, detectQuantityOutliers,
} from './analytics-engine.js?v=ea7b98eca6';
import { spikeBadge, renderSpikeLegend } from './analytics-severity.js?v=3a9756438b';

export function qLabel(q) { return `Q${q} / الربع ${['','الأول','الثاني','الثالث','الرابع'][q]||q}`; }

/* The change against the prior period, and the arrow that carries it. Written
   twice in modules/73 with the same rounding spelled two different ways. A prior
   period of zero has no percentage change — there is nothing to compare against,
   and reporting "+100%" against nothing is a number nobody can act on. */
export function pctChange(a, b) { return b > 0 ? Math.round((a - b) / b * 1000) / 10 : null; }

export function pctArrow(pct) {
  if (pct === null) return '';
  return pct > 0 ? `<span class="arw up">↑${pct}%</span>`
    : pct < 0 ? `<span class="arw dn">↓${Math.abs(pct)}%</span>`
      : `<span class="arw eq">→ 0%</span>`;
}

/* Formats a service measure with the sample it was computed over. A period whose
   history is partly archived can only measure some of these, and showing the
   denominator makes a small sample visibly small instead of quietly wrong. */
export function svcSub(sample, noun) {
  if (!sample) return 'not recorded / غير مسجل';
  return `over ${sample} ${noun}`;
}
export function hoursLabel(h) {
  if (h == null) return '—';
  if (h < 1) return Math.round(h * 60) + ' min';
  if (h < 48) return (Math.round(h * 10) / 10) + ' h';
  return (Math.round(h / 24 * 10) / 10) + ' d';
}

export function renderKpis(stats, priorStats) {
  const avg = stats.orders ? Math.round(stats.units / stats.orders * 10) / 10 : 0;
  const priorAvg = priorStats && priorStats.orders ? Math.round(priorStats.units / priorStats.orders * 10) / 10 : 0;
  const depts = Object.keys(stats.departments).length;
  const priorDepts = priorStats ? Object.keys(priorStats.departments).length : null;
  const zeroCount = Object.values(stats.departments).reduce((s, d) => s + d.zeroDispenseReqs, 0);

  function kpi(label, val, delta, cls = '') {
    return `<div class="anl-kpi ${cls}"><div class="anl-kpi-label">${label}</div><div class="anl-kpi-val">${val}</div><div class="anl-kpi-delta">${delta}</div></div>`;
  }

  const orderDelta = priorStats ? pctArrow(pctChange(stats.orders, priorStats.orders)) : '';
  const unitDelta  = priorStats ? pctArrow(pctChange(stats.units, priorStats.units)) : '';
  const avgDelta   = priorStats && priorAvg ? pctArrow(pctChange(avg, priorAvg)) : '';
  const deptDelta  = priorDepts !== null ? (depts !== priorDepts ? `<span style="color:#f59e0b">${depts > priorDepts ? '+' : ''}${depts - priorDepts} vs prior</span>` : '') : '';

  const svc = stats.service || {};
  const pv = priorStats && priorStats.service || {};
  const pct = v => v == null ? '—' : (Math.round(v * 1000) / 10) + '%';
  const fillDelta = (svc.fillRate != null && pv.fillRate != null)
    ? pctArrow(pctChange(svc.fillRate, pv.fillRate)) : '';
  // Below 95% of requested units reaching the ward is worth flagging, not celebrating.
  const fillCls = svc.fillRate == null ? '' : (svc.fillRate >= 0.95 ? 'good' : svc.fillRate >= 0.85 ? 'spike' : 'zero');
  const onTimeCls = svc.onTimeRate == null ? '' : (svc.onTimeRate >= 0.9 ? 'good' : svc.onTimeRate >= 0.75 ? 'spike' : 'zero');

  return `<div class="anl-kpi-row">
    ${kpi('Fill rate / نسبة التلبية', pct(svc.fillRate),
        fillDelta || svcSub(svc.ordersWithItems, 'orders'), fillCls)}
    ${kpi('Median turnaround / زمن التنفيذ', hoursLabel(svc.medianTurnaroundHours),
        svcSub(svc.turnaroundSample, 'orders'))}
    ${kpi('On-time / في الموعد', pct(svc.onTimeRate),
        svcSub(svc.scheduledOrders, 'scheduled'), onTimeCls)}
    ${kpi('Partly filled / تلبية جزئية', svc.partiallyFilled || 0,
        svc.unfilled ? `${svc.unfilled} not filled at all` : 'none unfilled')}
    ${kpi('High-alert share / حصة عالية التنبيه', pct(svc.highAlertShare),
        `${(svc.highAlertUnits || 0).toLocaleString()} units`)}
    ${kpi('Fulfilled orders / الطلبات', stats.orders, orderDelta || 'vs prior period')}
    ${kpi('Dispensed units / الوحدات', stats.units.toLocaleString(), unitDelta || 'vs prior period', stats.units > (priorStats && priorStats.units || 0) ? 'spike' : 'good')}
    ${kpi('Average units / order / متوسط', avg, avgDelta || 'per fulfilled request')}
    ${kpi('Active departments / الأقسام', depts, deptDelta || `${depts} reporting`)}
    ${kpi('Zero-dispense requests / صفر صرف', zeroCount, zeroCount > 0 ? `across ${Object.values(stats.departments).filter(d => d.zeroDispenseReqs > 0).length} dept(s)` : 'none this period', zeroCount > 0 ? 'zero' : 'good')}
  </div>`;
}

export function renderQuarterTable(year) {
  /* A quarter that has not happened holds no rows, so comparing it to the one
     before produced "-100%" for a period nobody has lived through yet -- and
     painted it green, as though dispensing having stopped were good news. The
     quarter in progress is only partly filled for the same reason. Report the
     calendar honestly: future quarters are omitted, the running one is labelled
     partial and left out of the trend, and a drop is never coloured as success. */
  const now = new Date();
  const currentQuarter = Math.floor(now.getMonth() / 3) + 1;
  const isCurrentYear = String(year) === String(now.getFullYear());
  const lastQuarter = isCurrentYear ? currentQuarter : 4;
  let prev = null;
  const rows = [];
  for (let q = 1; q <= lastQuarter; q += 1) {
    const st = computeStats(rowsForPeriod(year, String(q)));
    const partial = isCurrentYear && q === currentQuarter;
    const diff = prev !== null ? st.units - prev : null;
    const pct  = prev !== null && prev > 0 ? Math.round((st.units - prev) / prev * 1000) / 10 : null;
    let change = diff === null ? '—' : (diff >= 0 ? `+${diff}` : `${diff}`) + (pct !== null ? ` (${pct >= 0 ? '+' : ''}${pct}%)` : '');
    // An incomplete quarter is guaranteed to look like a fall; saying so is
    // more useful than printing a decline that only means "not finished yet".
    if (partial) change = 'In progress / جارٍ';
    const cls = (partial || diff === null || diff === 0) ? 'color:#475569'
      : diff > 0 ? 'color:#b45309' : 'color:#9f1239';
    // The running quarter must not become the baseline for a later comparison.
    if (!partial) prev = st.units;
    rows.push(`<tr><td><b>${qLabel(q)}</b>${partial ? ' <span style="font-weight:400;font-size:8pt">(partial / جزئي)</span>' : ''}</td><td class="num">${st.orders}</td><td class="num">${st.units}</td><td class="num">${st.orders ? Math.round(st.units/st.orders*10)/10 : 0}</td><td class="num" style="${cls}">${change}</td></tr>`);
  }
  if (isCurrentYear && lastQuarter < 4) {
    rows.push(`<tr><td colspan="5" style="color:#64748b;font-style:italic">Q${lastQuarter + 1}${lastQuarter + 1 < 4 ? '–Q4' : ''} not started yet / لم تبدأ بعد</td></tr>`);
  }
  return `<div class="anl-section">
    <div class="anl-section-title">Quarterly comparison ${year} / المقارنة الربعية</div>
    <div style="overflow:auto"><table class="anl-quarter-table">
      <thead><tr><th>Quarter</th><th class="num">Orders</th><th class="num">Units</th><th class="num">Avg/order</th><th class="num">Δ vs prior quarter</th></tr></thead>
      <tbody>${rows.join('')}</tbody>
    </table></div>
  </div>`;
}

export function renderDeptBars(stats) {
  const names = Object.keys(stats.departments).sort((a, b) => stats.departments[b].units - stats.departments[a].units);
  const maxUnits = Math.max(1, ...names.map(n => stats.departments[n].units));
  const colors = ['#1d4ed8','#059669','#d97706','#7c3aed','#dc2626','#0891b2','#84cc16','#ec4899'];
  if (!names.length) return `<div class="anl-empty">No fulfilled dispensing data in this period.</div>`;
  return `<div class="anl-dept-bars">${names.map((name, i) => {
    const d = stats.departments[name];
    const share = stats.units ? Math.round(d.units / stats.units * 1000) / 10 : 0;
    const pct = Math.max(2, Math.round(d.units / maxUnits * 100));
    return `<div class="anl-dept-bar">
      <div class="anl-dept-bar-head"><b>${esc(name)}</b><span>${d.orders} orders · ${d.units} units · ${share}%</span></div>
      <div class="anl-meter"><i style="width:${pct}%;background:${colors[i % colors.length]}"></i></div>
    </div>`;
  }).join('')}</div>`;
}

export function renderMedTable(meds, emptyMsg) {
  if (!meds.length) return `<div class="anl-empty">${emptyMsg}</div>`;
  return `<div style="overflow:auto"><table class="anl-med-table">
    <thead><tr><th>#</th><th>Medicine / الدواء</th><th class="num">Total units</th><th>Top departments</th></tr></thead>
    <tbody>${meds.map((m, i) => {
      const topDepts = Object.entries(m.depts).sort((a, b) => b[1] - a[1]).slice(0, 3)
        .map(([dept, qty]) => `${esc(dept)}: ${qty}`).join(' · ');
      return `<tr><td>${i + 1}</td><td><b>${esc(m.name)}</b></td><td class="num">${m.qty}</td><td class="anl-dept-cell">${topDepts || '—'}</td></tr>`;
    }).join('')}</tbody>
  </table></div>`;
}

/* Ranked by units missing, not by percentage: a medicine short 900 of 1000 is a
   supply problem, one short 3 of 3 is usually a single stray order. */
export function renderShortfalls(stats) {
  const rows = topShortfalls(stats, 10);
  if (!rows.length) return `<div class="anl-empty">Every requested medicine was dispensed in full. / صُرف كل ما طُلب بالكامل.</div>`;
  return `<div style="overflow:auto"><table class="anl-med-table">
    <thead><tr><th>#</th><th>Medicine / الدواء</th><th class="num">Requested</th><th class="num">Dispensed</th><th class="num">Short / الناقص</th><th class="num">Fill %</th><th>Most affected / الأكثر تأثرًا</th></tr></thead>
    <tbody>${rows.map((m, i) => {
      const worst = Object.entries(m.depts).sort((a, b) => b[1] - a[1]).slice(0, 3)
        .map(([dept, qty]) => `${esc(dept)}: ${qty}`).join(' · ');
      return `<tr><td>${i + 1}</td><td><b>${esc(m.name)}</b></td><td class="num">${m.requested}</td><td class="num">${m.served}</td>` +
        `<td class="num" style="font-weight:700">${m.short}</td><td class="num">${m.fillRate == null ? '—' : m.fillRate + '%'}</td>` +
        `<td class="anl-dept-cell">${worst || '—'}</td></tr>`;
    }).join('')}</tbody>
  </table></div>`;
}

/* Volume says who is busy; this says who is actually being served. Worst first --
   a list of well-supplied wards is not what anyone opens this report to find. */
export function renderDeptFillRates(stats) {
  const rows = departmentFillRates(stats);
  if (!rows.length) return `<div class="anl-empty">No requested quantities recorded in this period. / لا توجد كميات مطلوبة مسجلة.</div>`;
  return `<div style="overflow:auto"><table class="anl-med-table">
    <thead><tr><th>Department / القسم</th><th class="num">Requested</th><th class="num">Dispensed</th><th class="num">Short</th><th class="num">Fill rate / معدل التلبية</th></tr></thead>
    <tbody>${rows.map(d => {
      const pct = d.fillRate;
      const colour = pct == null ? '' : pct >= 95 ? 'color:#15803d' : pct >= 85 ? 'color:#b45309' : 'color:#9f1239;font-weight:700';
      return `<tr><td><b>${esc(d.dept)}</b></td><td class="num">${d.requested}</td><td class="num">${d.served}</td>` +
        `<td class="num">${d.short}</td><td class="num" style="${colour}">${pct == null ? '—' : pct + '%'}</td></tr>`;
    }).join('')}</tbody>
  </table></div>`;
}

/* Data hygiene, not analysis: these are quantities to go and check, most often a
   digit typed twice. Left unfound they quietly distort every average above. */
export function renderQuantityOutliers(rows) {
  const found = detectQuantityOutliers(rows);
  if (!found.length) return `<div class="anl-empty">No unusual quantities detected. / لا توجد كميات شاذة.</div>`;
  return `<div style="overflow:auto"><table class="anl-med-table">
    <thead><tr><th>Medicine / الدواء</th><th>Department / القسم</th><th class="num">Quantity</th><th class="num">Typical / المعتاد</th><th class="num">× normal</th><th>Date / التاريخ</th></tr></thead>
    <tbody>${found.map(x =>
      `<tr><td><b>${esc(x.medicine)}</b></td><td class="anl-dept-cell">${esc(x.dept)}</td>` +
      `<td class="num" style="font-weight:700;color:#9f1239">${x.qty}</td><td class="num">${x.typical}</td>` +
      `<td class="num">${x.factor}×</td><td class="anl-dept-cell">${esc(String(x.at || '').slice(0, 10) || '—')}</td></tr>`
    ).join('')}</tbody>
  </table></div>`;
}

export function renderSpikes(currentRows, priorRows, priorLabel, threshold) {
  const spikes = detectSpikes(currentRows, priorRows, threshold);
  if (!spikes.overall.length && !spikes.perDept.length) {
    return `<div class="anl-empty">No medicine exceeded a ${threshold}% consumption increase vs ${esc(priorLabel)}.</div>`;
  }
  let html = renderSpikeLegend(threshold);
  if (spikes.overall.length) {
    html += `<div style="margin-bottom:10px"><b style="font-size:13px;color:var(--cl-text,#f1f5f9)">Overall (all departments)</b>
    <div style="overflow:auto;margin-top:6px"><table class="anl-med-table">
      <thead><tr><th>Medicine</th><th>Current</th><th>Prior (${esc(priorLabel)})</th><th>Change</th></tr></thead>
      <tbody>${spikes.overall.slice(0, 15).map(s =>
        `<tr><td><b>${esc(s.medicine)}</b></td><td>${s.current}</td><td>${s.prior}</td><td>${spikeBadge(s.pctChange, threshold)}</td></tr>`
      ).join('')}</tbody>
    </table></div></div>`;
  }
  if (spikes.perDept.length) {
    html += `<div style="margin-top:10px"><b style="font-size:13px;color:var(--cl-text,#f1f5f9)">By department / حسب القسم</b>
    <div style="overflow:auto;margin-top:6px"><table class="anl-med-table">
      <thead><tr><th>Medicine</th><th>Department</th><th>Current</th><th>Prior</th><th>Change</th></tr></thead>
      <tbody>${spikes.perDept.slice(0, 20).map(s =>
        `<tr><td><b>${esc(s.medicine)}</b></td><td>${esc(s.dept)}</td><td>${s.current}</td><td>${s.prior}</td><td>${spikeBadge(s.pctChange, threshold)}</td></tr>`
      ).join('')}</tbody>
    </table></div></div>`;
  }
  return html;
}

export function renderZeroDispense(rows) {
  const summary = zeroDispenseSummary(rows);
  if (!summary.length) return `<div class="anl-empty">No zero-dispense requests in this period. ✓</div>`;
  return summary.map(z =>
    `<div class="anl-zero-row"><b>${esc(z.dept)}</b> — ${z.zeroReqs} request(s) fulfilled with 0 units dispensed (out of ${z.totalReqs} total requests)</div>`
  ).join('');
}
