import {
  allRows, rowsForPeriod, computeStats, topMedicines,
  availableYears, priorPeriod, sameQuarterPriorYear, periodLabel,
  detectSpikes, zeroDispenseSummary, deptLabel
} from '../core/analytics-engine.js';

(function () {
'use strict';

/* ── helpers ─────────────────────────────────────────────────────────────── */
function esc(v) { return window.fsEsc ? window.fsEsc(v) : String(v == null ? '' : v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function permitted() {
  const r = String(window.fsEffectiveRole ? window.fsEffectiveRole() : (window.CU && window.CU.role) || '');
  return ['pharmacy','inpatient_supervisor','inpatient_pharmacy_supervisor','inpatient pharmacy supervisor'].includes(r) || !!(window.CU && window.CU.master);
}
function qLabel(q) { return `Q${q} / الربع ${['','الأول','الثاني','الثالث','الرابع'][q]||q}`; }
function selectedYear()    { const el = document.getElementById('analytics-report-year');    return Number(el && el.value) || new Date().getFullYear(); }
function selectedQuarter() { const el = document.getElementById('analytics-report-quarter'); return String(el && el.value || 'all'); }
function pctArrow(pct) {
  if (pct === null) return '';
  return pct > 0 ? `<span class="arw up">↑${pct}%</span>` : pct < 0 ? `<span class="arw dn">↓${Math.abs(pct)}%</span>` : `<span class="arw eq">→ 0%</span>`;
}
function pctChange(a, b) { return b > 0 ? Math.round((a - b) / b * 1000) / 10 : null; }

/* ── styles (injected once) ─────────────────────────────────────────────── */
const STYLE_ID = 'asdh-analytics-style';
function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const s = document.createElement('style');
  s.id = STYLE_ID;
  s.textContent = `
#analytics-reports-card{padding:0}
.anl-header{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;padding:16px 18px 10px}
.anl-header h2{margin:0;font-size:18px;font-weight:700;color:var(--cl-text,#f1f5f9)}
.anl-controls{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.anl-kpi-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(148px,1fr));gap:10px;padding:0 18px 14px}
.anl-kpi{border:1px solid var(--cl-border,#334155);border-top:3px solid #2563eb;border-radius:10px;padding:12px 14px;background:var(--cl-card2,#111827)}
.anl-kpi.spike{border-top-color:#f59e0b}
.anl-kpi.zero{border-top-color:#ef4444}
.anl-kpi.good{border-top-color:#10b981}
.anl-kpi-label{font-size:11px;color:var(--cl-sub,#94a3b8);margin-bottom:4px}
.anl-kpi-val{font-size:26px;font-weight:800;color:var(--cl-text,#f1f5f9);line-height:1}
.anl-kpi-delta{font-size:12px;margin-top:4px;color:var(--cl-sub,#94a3b8)}
.arw{font-size:12px;font-weight:700;padding:2px 6px;border-radius:4px}
.arw.up{background:#fef3c7;color:#92400e}
.arw.dn{background:#dcfce7;color:#166534}
.arw.eq{background:#e2e8f0;color:#475569}
.anl-section{padding:0 18px 18px}
.anl-section-title{font-size:14px;font-weight:700;color:var(--cl-text,#f1f5f9);padding:8px 10px;border-left:4px solid #3b82f6;background:var(--cl-card2,#1e293b);margin-bottom:10px;border-radius:0 6px 6px 0}
.anl-section-title.alert{border-left-color:#f59e0b;background:rgba(245,158,11,.1)}
.anl-section-title.danger{border-left-color:#ef4444;background:rgba(239,68,68,.08)}
.anl-quarter-table{width:100%;border-collapse:collapse;font-size:13px}
.anl-quarter-table th{background:var(--cl-card2,#1e293b);color:var(--cl-sub,#94a3b8);padding:8px 10px;text-align:left;border-bottom:1px solid var(--cl-border,#334155)}
.anl-quarter-table td{padding:8px 10px;border-bottom:1px solid var(--cl-border,#334155);color:var(--cl-text,#e2e8f0)}
.anl-quarter-table tr:last-child td{border-bottom:none}
.anl-dept-bars{display:grid;gap:8px}
.anl-dept-bar{padding:10px 12px;border:1px solid var(--cl-border,#334155);border-radius:8px;background:var(--cl-card2,#111827)}
.anl-dept-bar-head{display:flex;justify-content:space-between;gap:8px;font-size:13px;margin-bottom:6px}
.anl-dept-bar-head b{color:var(--cl-text,#f1f5f9)}
.anl-dept-bar-head span{color:var(--cl-sub,#94a3b8);white-space:nowrap}
.anl-meter{height:10px;background:var(--cl-border,#334155);border-radius:10px;overflow:hidden}
.anl-meter i{display:block;height:100%;border-radius:10px;transition:width .3s}
.anl-med-table{width:100%;border-collapse:collapse;font-size:13px}
.anl-med-table th{background:var(--cl-card2,#1e293b);color:var(--cl-sub,#94a3b8);padding:8px 10px;text-align:left;border-bottom:1px solid var(--cl-border,#334155)}
.anl-med-table td{padding:8px 10px;border-bottom:1px solid var(--cl-border,#334155);color:var(--cl-text,#e2e8f0);vertical-align:top}
.anl-med-table tr:last-child td{border-bottom:none}
.anl-spike-badge{display:inline-block;font-size:11px;font-weight:700;padding:2px 7px;border-radius:99px;background:#fef3c7;color:#92400e;margin-left:6px}
.anl-zero-row{font-size:13px;color:var(--cl-sub,#94a3b8);padding:6px 0;border-bottom:1px solid var(--cl-border,#334155)}
.anl-zero-row:last-child{border-bottom:none}
.anl-empty{text-align:center;color:var(--cl-sub,#94a3b8);padding:20px;font-size:13px}
@media print{.anl-controls button,.btn{display:none!important}}
@media(max-width:640px){.anl-kpi-row{grid-template-columns:repeat(2,1fr)}}
`;
  document.head.appendChild(s);
}

/* ── section renderers ─────────────────────────────────────────────────── */
function renderKpis(stats, priorStats) {
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

  return `<div class="anl-kpi-row">
    ${kpi('Fulfilled orders / الطلبات', stats.orders, orderDelta || 'vs prior period')}
    ${kpi('Dispensed units / الوحدات', stats.units.toLocaleString(), unitDelta || 'vs prior period', stats.units > (priorStats && priorStats.units || 0) ? 'spike' : 'good')}
    ${kpi('Average units / order / متوسط', avg, avgDelta || 'per fulfilled request')}
    ${kpi('Active departments / الأقسام', depts, deptDelta || `${depts} reporting`)}
    ${kpi('Zero-dispense requests / صفر صرف', zeroCount, zeroCount > 0 ? `across ${Object.values(stats.departments).filter(d => d.zeroDispenseReqs > 0).length} dept(s)` : 'none this period', zeroCount > 0 ? 'zero' : 'good')}
  </div>`;
}

function renderQuarterTable(year) {
  const palette = ['#94a3b8','#3b82f6','#10b981','#f59e0b','#ef4444'];
  let prev = null;
  const rows = [1,2,3,4].map(q => {
    const rows = rowsForPeriod(year, String(q));
    const st = computeStats(rows);
    const diff = prev !== null ? st.units - prev : null;
    const pct  = prev !== null && prev > 0 ? Math.round((st.units - prev) / prev * 1000) / 10 : null;
    const change = diff === null ? '—' : (diff >= 0 ? `+${diff}` : `${diff}`) + (pct !== null ? ` (${pct >= 0 ? '+' : ''}${pct}%)` : '');
    const cls = diff === null ? '' : diff > 0 ? 'color:#f59e0b' : diff < 0 ? 'color:#10b981' : '';
    prev = st.units;
    return `<tr><td><b>${qLabel(q)}</b></td><td>${st.orders}</td><td>${st.units}</td><td>${st.orders ? Math.round(st.units/st.orders*10)/10 : 0}</td><td style="${cls}">${change}</td></tr>`;
  });
  return `<div class="anl-section">
    <div class="anl-section-title">Quarterly comparison ${year} / المقارنة الربعية</div>
    <div style="overflow:auto"><table class="anl-quarter-table">
      <thead><tr><th>Quarter</th><th>Orders</th><th>Units</th><th>Avg/order</th><th>Δ vs prior quarter</th></tr></thead>
      <tbody>${rows.join('')}</tbody>
    </table></div>
  </div>`;
}

function renderDeptBars(stats) {
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

function renderMedTable(meds, emptyMsg) {
  if (!meds.length) return `<div class="anl-empty">${emptyMsg}</div>`;
  return `<div style="overflow:auto"><table class="anl-med-table">
    <thead><tr><th>#</th><th>Medicine / الدواء</th><th>Total units</th><th>Top departments</th></tr></thead>
    <tbody>${meds.map((m, i) => {
      const topDepts = Object.entries(m.depts).sort((a, b) => b[1] - a[1]).slice(0, 3)
        .map(([dept, qty]) => `${esc(dept)}: ${qty}`).join(' · ');
      return `<tr><td>${i + 1}</td><td><b>${esc(m.name)}</b></td><td>${m.qty}</td><td style="font-size:12px;color:var(--cl-sub,#94a3b8)">${topDepts || '—'}</td></tr>`;
    }).join('')}</tbody>
  </table></div>`;
}

function renderSpikes(currentRows, priorRows, priorLabel) {
  const spikes = detectSpikes(currentRows, priorRows, 30);
  if (!spikes.overall.length && !spikes.perDept.length) {
    return `<div class="anl-empty">No medicine exceeded a 30% consumption increase vs ${esc(priorLabel)}.</div>`;
  }
  let html = '';
  if (spikes.overall.length) {
    html += `<div style="margin-bottom:10px"><b style="font-size:13px;color:var(--cl-text,#f1f5f9)">Overall (all departments)</b>
    <div style="overflow:auto;margin-top:6px"><table class="anl-med-table">
      <thead><tr><th>Medicine</th><th>Current</th><th>Prior (${esc(priorLabel)})</th><th>Change</th></tr></thead>
      <tbody>${spikes.overall.slice(0, 15).map(s =>
        `<tr><td><b>${esc(s.medicine)}</b></td><td>${s.current}</td><td>${s.prior}</td><td><span class="anl-spike-badge">+${s.pctChange}%</span></td></tr>`
      ).join('')}</tbody>
    </table></div></div>`;
  }
  if (spikes.perDept.length) {
    html += `<div style="margin-top:10px"><b style="font-size:13px;color:var(--cl-text,#f1f5f9)">By department / حسب القسم</b>
    <div style="overflow:auto;margin-top:6px"><table class="anl-med-table">
      <thead><tr><th>Medicine</th><th>Department</th><th>Current</th><th>Prior</th><th>Change</th></tr></thead>
      <tbody>${spikes.perDept.slice(0, 20).map(s =>
        `<tr><td><b>${esc(s.medicine)}</b></td><td>${esc(s.dept)}</td><td>${s.current}</td><td>${s.prior}</td><td><span class="anl-spike-badge">+${s.pctChange}%</span></td></tr>`
      ).join('')}</tbody>
    </table></div></div>`;
  }
  return html;
}

function renderZeroDispense(rows) {
  const summary = zeroDispenseSummary(rows);
  if (!summary.length) return `<div class="anl-empty">No zero-dispense requests in this period. ✓</div>`;
  return summary.map(z =>
    `<div class="anl-zero-row"><b>${esc(z.dept)}</b> — ${z.zeroReqs} request(s) fulfilled with 0 units dispensed (out of ${z.totalReqs} total requests)</div>`
  ).join('');
}

/* ── main renderer ─────────────────────────────────────────────────────── */
window.renderAnalyticsReports = function () {
  const page = document.getElementById('pg-analytics');
  if (!page) return;

  if (!permitted()) {
    const old = document.getElementById('analytics-reports-card');
    if (old) old.remove();
    return;
  }

  injectStyles();

  const years = availableYears();
  const year = selectedYear();
  const quarter = selectedQuarter();

  const currentRows = rowsForPeriod(year, quarter);
  const prior = priorPeriod(year, quarter);
  const priorRows = rowsForPeriod(prior.year, prior.quarter);
  const sameLastYear = sameQuarterPriorYear(year, quarter);
  const sameLastYearRows = rowsForPeriod(sameLastYear.year, sameLastYear.quarter);

  const stats      = computeStats(currentRows);
  const priorStats = computeStats(priorRows);

  const title = quarter === 'all'
    ? `Annual report ${year} / التقرير السنوي ${year}`
    : `${qLabel(Number(quarter))} ${year}`;

  const priorLbl = periodLabel(prior.year, prior.quarter);
  const sameLastYearLbl = periodLabel(sameLastYear.year, sameLastYear.quarter);

  const topRoutine = topMedicines(stats.routine, 10);
  const topHigh    = topMedicines(stats.high, 10);

  let root = document.getElementById('analytics-reports-card');
  if (!root) {
    root = document.createElement('section');
    root.id = 'analytics-reports-card';
    page.appendChild(root);
  }

  root.innerHTML = `
    <div class="anl-header">
      <h2>📊 ${esc(title)}</h2>
      <div class="anl-controls">
        <select id="analytics-report-year">${years.map(v => `<option value="${v}"${v === year ? ' selected' : ''}>${v}</option>`).join('')}</select>
        <select id="analytics-report-quarter">
          <option value="all"${quarter==='all'?' selected':''}>Full year / السنة كاملة</option>
          ${[1,2,3,4].map(q => `<option value="${q}"${quarter===String(q)?' selected':''}>${qLabel(q)}</option>`).join('')}
        </select>
        <button class="btn bp bsm" id="analytics-report-print">🖨 Print / طباعة</button>
      </div>
    </div>

    ${renderKpis(stats, priorStats)}

    <div class="anl-section">
      <div class="anl-section-title">Department consumption / استهلاك الأقسام</div>
      ${renderDeptBars(stats)}
    </div>

    ${renderQuarterTable(year)}

    <div class="anl-section">
      <div class="anl-section-title">Top 10 routine medicines / الأكثر صرفًا (عادي)</div>
      ${renderMedTable(topRoutine, 'No routine medicines dispensed in this period.')}
    </div>

    <div class="anl-section">
      <div class="anl-section-title alert">⚠ Top High-Alert medicines / الأدوية عالية الخطورة</div>
      ${renderMedTable(topHigh, 'No high-alert medicines dispensed in this period.')}
    </div>

    <div class="anl-section" id="analytics-spike-section">
      <div class="anl-section-title alert">📈 Consumption spikes ≥30% vs prior period (${esc(priorLbl)}) / ارتفاع ≥30%</div>
      ${renderSpikes(currentRows, priorRows, priorLbl)}
    </div>

    <div class="anl-section" id="analytics-spike-yoy-section">
      <div class="anl-section-title alert">📈 Consumption spikes ≥30% vs same period last year (${esc(sameLastYearLbl)}) / مقارنة بنفس الفترة من العام الماضي</div>
      ${renderSpikes(currentRows, sameLastYearRows, sameLastYearLbl)}
    </div>

    <div class="anl-section" id="analytics-zero-section">
      <div class="anl-section-title danger">🔴 Zero-dispense fulfilled requests / طلبات مكتملة بصرف صفر</div>
      ${renderZeroDispense(currentRows)}
    </div>
  `;

  // Bind controls
  ['analytics-report-year','analytics-report-quarter'].forEach(id => {
    const el = document.getElementById(id);
    if (el && !el.dataset.bound) { el.dataset.bound = '1'; el.addEventListener('change', window.renderAnalyticsReports); }
  });

  // Print button
  const printBtn = document.getElementById('analytics-report-print');
  if (printBtn && !printBtn.dataset.bound) {
    printBtn.dataset.bound = '1';
    printBtn.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('floorstock:analytics-print', { detail: { year, quarter, stats, topRoutine, topHigh, title } }));
    });
  }

  window.dispatchEvent(new CustomEvent('floorstock:analytics-rendered', { detail: { root, year, quarter, stats } }));
};
})();

export {};
