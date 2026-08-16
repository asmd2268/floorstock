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
// firestore.rules' canWriteState() allows unrestricted docId writes only for
// pharmacy/pharmacy_director (and master, who takes on an effective role) —
// inpatient_supervisor and the other roles permitted() lets VIEW this page
// are restricted to a fixed docId pattern that does not include this new
// setting key, so their write would be silently rejected server-side.
function canEditSpikeThreshold() {
  const r = String(window.fsEffectiveRole ? window.fsEffectiveRole() : (window.CU && window.CU.role) || '');
  // window.CU.master alone misses the case where master is currently testing
  // as another role (CU gets swapped, MASTER_ACTUAL preserves the real
  // identity) — use the same canonical check module 07j already exposes for
  // this exact scenario instead of a narrower ad-hoc one.
  return ['pharmacy','pharmacy_director'].includes(r)
    || (typeof window.isMasterActual === 'function' ? window.isMasterActual() : !!(window.CU && window.CU.master));
}
function selectedYear()    { const el = document.getElementById('analytics-report-year');    return Number(el && el.value) || new Date().getFullYear(); }
function selectedQuarter() { const el = document.getElementById('analytics-report-quarter'); return String(el && el.value || 'all'); }
const SPIKE_THRESHOLD_KEY = 'analytics_spike_threshold_pct';
function spikeThresholdPct() {
  const v = Number(window.S && typeof S.g === 'function' ? S.g(SPIKE_THRESHOLD_KEY) : null);
  return Number.isFinite(v) && v > 0 ? v : 30;
}
window.saveAnalyticsSpikeThreshold = async function () {
  const input = document.getElementById('analytics-spike-threshold');
  if (!input || !canEditSpikeThreshold()) return;
  const value = Math.round(Number(input.value));
  if (!Number.isFinite(value) || value < 1 || value > 500) {
    input.value = spikeThresholdPct();
    if (window.toast) toast('Enter a threshold between 1 and 500%. / أدخل نسبة بين 1 و500%', 'err');
    return;
  }
  try {
    await S.s(SPIKE_THRESHOLD_KEY, value);
    if (typeof window.auditAction === 'function') auditAction('analytics_spike_threshold_changed', { thresholdPct: value });
    if (window.toast) toast('Threshold saved ✓ / تم حفظ النسبة ✓', 'succ');
    window.renderAnalyticsReports();
  } catch (error) {
    if (window.toast) toast('Threshold was not saved. / لم يتم حفظ النسبة', 'err');
  }
};
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
.anl-spike-badge.low{background:#dcfce7;color:#166534}
.anl-spike-badge.good{background:#dcfce7;color:#166534}
.anl-spike-badge.mid{background:#fef3c7;color:#92400e}
.anl-spike-badge.high{background:#fee2e2;color:#991b1b}
.anl-spike-badge.extreme{background:#7f1d1d;color:#fecaca}
.anl-zero-row{font-size:13px;color:var(--cl-sub,#94a3b8);padding:6px 0;border-bottom:1px solid var(--cl-border,#334155)}
.anl-zero-row:last-child{border-bottom:none}
.anl-empty{text-align:center;color:var(--cl-sub,#94a3b8);padding:20px;font-size:13px}
.anl-threshold-ctl{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--cl-sub,#94a3b8)}
.anl-threshold-ctl input{width:60px;padding:4px 6px;text-align:center;border-radius:6px;border:1px solid var(--cl-border,#334155);background:var(--cl-card2,#1e293b);color:var(--cl-text,#f1f5f9)}
.anl-legend{display:flex;flex-wrap:wrap;gap:12px;align-items:center;font-size:11px;color:var(--cl-sub,#94a3b8);margin:8px 0 12px;padding:8px 10px;background:var(--cl-card2,#111827);border:1px solid var(--cl-border,#334155);border-radius:8px}
.anl-legend b{color:var(--cl-text,#f1f5f9)}
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

function spikeBadgeClass(pct, threshold) {
  if (pct >= threshold * 2.5) return 'extreme';
  if (pct >= threshold * 1.5) return 'high';
  return 'mid';
}
function spikeBadge(pct, threshold) {
  return `<span class="anl-spike-badge ${spikeBadgeClass(pct, threshold)}">+${pct}%</span>`;
}
function renderSpikeLegend(threshold) {
  return `<div class="anl-legend">
    <b>Legend / الدليل:</b>
    <span><span class="anl-spike-badge mid">+${threshold}%</span> ${threshold}–${Math.round(threshold * 1.5 - 1)}% increase</span>
    <span><span class="anl-spike-badge high">+${Math.round(threshold * 1.5)}%</span> ${Math.round(threshold * 1.5)}–${Math.round(threshold * 2.5 - 1)}% increase</span>
    <span><span class="anl-spike-badge extreme">+${Math.round(threshold * 2.5)}%</span> ${Math.round(threshold * 2.5)}%+ increase</span>
  </div>`;
}

function renderSpikes(currentRows, priorRows, priorLabel, threshold) {
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
  const threshold  = spikeThresholdPct();

  let root = document.getElementById('analytics-reports-card');
  if (!root) {
    root = document.createElement('section');
    root.id = 'analytics-reports-card';
    const panel = document.getElementById('anl-panel-period') || page;
    panel.appendChild(root);
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
        <span class="anl-threshold-ctl">Spike threshold / حد الارتفاع:
          <input type="number" id="analytics-spike-threshold" min="1" max="500" value="${threshold}"${canEditSpikeThreshold() ? '' : ' disabled title="Only pharmacy director / master can change this. / فقط مدير الصيدلية / الماستر يقدر يغيّرها"'}>%
          ${canEditSpikeThreshold() ? '<button class="btn bg bsm" id="analytics-spike-threshold-save">Save / حفظ</button>' : ''}
        </span>
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
      <div class="anl-section-title alert">📈 Consumption spikes ≥${threshold}% vs prior period (${esc(priorLbl)}) / ارتفاع ≥${threshold}%</div>
      ${renderSpikes(currentRows, priorRows, priorLbl, threshold)}
    </div>

    <div class="anl-section" id="analytics-spike-yoy-section">
      <div class="anl-section-title alert">📈 Consumption spikes ≥${threshold}% vs same period last year (${esc(sameLastYearLbl)}) / مقارنة بنفس الفترة من العام الماضي</div>
      ${renderSpikes(currentRows, sameLastYearRows, sameLastYearLbl, threshold)}
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

  // Threshold save button
  const thresholdSaveBtn = document.getElementById('analytics-spike-threshold-save');
  if (thresholdSaveBtn && !thresholdSaveBtn.dataset.bound) {
    thresholdSaveBtn.dataset.bound = '1';
    thresholdSaveBtn.addEventListener('click', window.saveAnalyticsSpikeThreshold);
  }

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

// --- Merged from 74-r676-analytics-department-print-comparison.js (Phase 6 consolidation) ---
(function () {
'use strict';

function esc(v) { return window.fsEsc ? window.fsEsc(v) : String(v == null ? '' : v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

const DEPT_PRINT_CSS = `
  @page{size:A4 portrait;margin:14mm 12mm 18mm}
  body{font:10pt Arial,sans-serif;color:#172033;background:#fff}
  h1{font-size:16pt;color:#102a5c;border-bottom:2px solid #2563eb;padding-bottom:6px;margin:0 0 10px}
  table{width:100%;border-collapse:collapse}
  th,td{border:1px solid #9aa8bd;padding:7px;text-align:left}
  th{background:#dbeafe;color:#102a5c}
  @media print{button{display:none!important}}
  .brand{text-align:right;font-size:8pt;color:#94a3b8;margin-top:8px}
`;

window._r676DeptStats = {};

window._r676PrintDept = function(name) {
  const d = (window._r676DeptStats || {})[name] || {};
  const html = `<h1>Department report — ${esc(name)}</h1>
    <table><thead><tr><th>Metric</th><th>Value</th></tr></thead>
    <tbody>
      <tr><td>Fulfilled orders</td><td>${d.orders || 0}</td></tr>
      <tr><td>Dispensed units</td><td>${d.units || 0}</td></tr>
      <tr><td>Zero-dispense requests</td><td>${d.zeroDispenseReqs || 0}</td></tr>
    </tbody></table><div class="brand">By Ali Abudahash</div>`;
  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(name)}</title><style>${DEPT_PRINT_CSS}</style></head><body>${html}<script>(function(){var d=false;function g(){if(d)return;d=true;window.focus();window.print();}if(document.readyState==='complete')setTimeout(g,400);else window.addEventListener('load',function(){setTimeout(g,400)},{once:true});})()</sc` + `ript></body></html>`);
  w.document.close();
};

function attach(root, stats) {
  if (!root) return;
  const old = root.querySelector('.r676-dept-print-section');
  if (old) old.remove();

  const depts = Object.entries(stats.departments || {})
    .sort((a, b) => b[1].units - a[1].units);
  if (!depts.length) return;

  window._r676DeptStats = stats.departments || {};

  const section = document.createElement('div');
  // r676-dept-print-only: these launcher buttons call window._r676PrintDept, which only
  // exists on the live app window. When the whole analytics card is copied into the
  // standalone print/blob document (buildPrintHtml below), the buttons render but do
  // nothing there — hidden via a print-scoped rule instead of shipping dead controls.
  section.className = 'anl-section r676-dept-print-section r676-dept-print-only';
  section.innerHTML = `
    <div class="anl-section-title">Department print pages / طباعة تقارير الأقسام</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;padding:4px 0">
      ${depts.map(([name]) =>
        `<button type="button" class="btn bsm" onclick="_r676PrintDept('${esc(name).replace(/'/g, "\\'")}')">🖨 ${esc(name)}</button>`
      ).join('')}
    </div>
  `;

  root.appendChild(section);
}

window.addEventListener('floorstock:analytics-rendered', function (e) {
  const d = e.detail || {};
  attach(d.root, d.stats || {});
});

})();


// --- Merged from 77-r676-unified-analytics-print.js (Phase 6 consolidation) ---
(function () {
'use strict';

function esc(v) { return window.fsEsc ? window.fsEsc(v) : String(v == null ? '' : v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

function buildPrintHtml(detail) {
  const css = `
    @page{size:A4 portrait;margin:14mm 12mm 18mm}
    body{font:10pt Arial,sans-serif;color:#172033;background:#fff}
    h1{font-size:17pt;color:#102a5c;margin:0 0 4px}
    h2{font-size:13pt;color:#102a5c;background:#e8f0ff;border-left:4px solid #2563eb;padding:5px 8px;margin:14px 0 6px}
    .kpi-row{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin:10px 0}
    .kpi{border:1px solid #b9cae8;border-top:3px solid #2563eb;padding:8px;background:#f5f9ff}
    .kpi-label{font-size:8pt;color:#52627b}
    .kpi-val{font-size:18pt;font-weight:bold;color:#102a5c;margin-top:2px}
    table{width:100%;border-collapse:collapse;margin-top:6px}
    th,td{border:1px solid #9aa8bd;padding:6px;text-align:left;font-size:9pt;vertical-align:top}
    th{background:#dbeafe;color:#102a5c}
    .spike-badge{background:#fef3c7;color:#92400e;font-weight:bold;padding:1px 5px;border-radius:4px;font-size:8pt}
    .section-alert h2{border-color:#f59e0b;background:#fffbeb;color:#92400e}
    .section-danger h2{border-color:#ef4444;background:#fff1f2;color:#991b1b}
    .dept-bar,.anl-dept-bar{margin:4px 0;padding:6px 8px;border:1px solid #c8d4e8;border-radius:6px;background:#f5f9ff}
    .dept-bar-head,.anl-dept-bar-head{display:flex;justify-content:space-between;font-size:9pt;gap:6px;margin-bottom:4px}
    .anl-dept-bar-head b{color:#102a5c;font-weight:700}
    .anl-dept-bar-head span{color:#52627b;white-space:nowrap}
    .meter,.anl-meter{height:9px;background:#e3eaf4;border-radius:5px;overflow:hidden;margin-top:2px}
    .meter i,.anl-meter i{display:block;height:100%;border-radius:5px}
    .anl-dept-bars,.anl-kpi-row{display:grid;gap:6px}
    .anl-kpi-row{grid-template-columns:repeat(4,1fr);margin:8px 0}
    .anl-kpi{border:1px solid #b9cae8;border-top:3px solid #2563eb;padding:8px;background:#f5f9ff}
    .anl-kpi-label{font-size:8pt;color:#52627b;margin-bottom:2px}
    .anl-kpi-val{font-size:16pt;font-weight:800;color:#102a5c}
    .anl-kpi-delta{font-size:8pt;color:#52627b;margin-top:2px}
    .anl-section-title{font-size:11pt;font-weight:700;color:#102a5c;background:#e8f0ff;border-left:4px solid #2563eb;padding:5px 8px;margin:12px 0 6px}
    .anl-section-title.alert{border-color:#f59e0b;background:#fffbeb;color:#92400e}
    .anl-section-title.danger{border-color:#ef4444;background:#fff1f2;color:#991b1b}
    .anl-quarter-table,.anl-med-table{width:100%;border-collapse:collapse;font-size:9pt;margin-top:4px}
    .anl-quarter-table th,.anl-med-table th{background:#dbeafe;color:#102a5c;padding:5px 8px;text-align:left;border:1px solid #9aa8bd}
    .anl-quarter-table td,.anl-med-table td{padding:5px 8px;border:1px solid #9aa8bd;color:#172033;vertical-align:top}
    .anl-spike-badge{background:#fef3c7;color:#92400e;font-weight:bold;padding:1px 5px;border-radius:4px;font-size:8pt;margin-left:4px}
    .anl-spike-badge.mid{background:#fef3c7;color:#92400e}
    .anl-spike-badge.high{background:#fee2e2;color:#991b1b}
    .anl-spike-badge.extreme{background:#7f1d1d;color:#fecaca}
    .anl-legend{display:flex;flex-wrap:wrap;gap:10px;align-items:center;font-size:8pt;color:#52627b;margin:6px 0 10px;padding:6px 8px;background:#f5f9ff;border:1px solid #c8d4e8;border-radius:6px}
    .anl-legend b{color:#102a5c}
    .anl-threshold-ctl{display:none!important}
    .anl-empty{text-align:center;color:#94a3b8;padding:12px;font-size:9pt}
    .anl-zero-row{font-size:9pt;color:#475569;padding:4px 0;border-bottom:1px solid #e2e8f0}
    .arw{font-size:8pt;font-weight:700;padding:1px 5px;border-radius:4px}
    .arw.up{background:#fef3c7;color:#92400e}.arw.dn{background:#dcfce7;color:#166534}.arw.eq{background:#e2e8f0;color:#475569}
    .anl-controls{display:none!important}
    .r676-dept-print-only{display:none!important}
    @media print{button{display:none!important}}
    .brand{text-align:right;font-size:8pt;color:#94a3b8;margin-top:8px}
  `;
  const root = document.getElementById('analytics-reports-card');
  const html = (root ? root.innerHTML : '') + '<div class="brand">By Ali Abudahash</div>';
  if (typeof window.fsOfficialPrint === 'function') {
    window.fsOfficialPrint({ title: 'Analytics report / التقرير الإحصائي', html, css });
  } else {
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Analytics report</title><style>${css}</style></head><body>${html}</body></html>`);
    w.document.close();
    w.print();
  }
}

window.addEventListener('floorstock:analytics-print', function () {
  buildPrintHtml();
});

// Also attach to any manually added print button on the page
window.addEventListener('floorstock:analytics-rendered', function (e) {
  const root = e.detail && e.detail.root;
  if (!root) return;
  // remove any legacy unified analytics screen this module previously created
  const old = root.querySelector('[data-unified-analytics]');
  if (old) old.remove();
  const legacy = document.getElementById('annual-analytics-print-card');
  if (legacy) legacy.style.display = 'none';
});

})();


/**
 * R6.76.54 — Comprehensive Annual Report
 * Crash Cart Analytics + Narcotic/Controlled Dispensing Analytics
 * Replaces the old annual-analytics-print-card.
 */
(function () {
'use strict';

/* ── constants ──────────────────────────────────────────────────────────── */
const BRAND = 'By Ali Abudahash';
const MONTHS_EN = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MONTHS_AR = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];

/* ── utilities ──────────────────────────────────────────────────────────── */
function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function pct(a, total) { return total > 0 ? Math.round(a / total * 1000) / 10 : 0; }
function avg(arr) { return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0; }
function round1(n) { return Math.round(n * 10) / 10; }
function deptName(id) {
  const list = typeof window.gd === 'function' ? (window.gd() || []) : [];
  const d = list.find(x => String(x.id) === String(id));
  return (d && d.name) || id || '—';
}
function cartName(id) {
  const list = typeof window.crashCarts === 'function' ? (window.crashCarts() || []) : [];
  const c = list.find(x => String(x.id) === String(id));
  return (c && c.name) || id || '—';
}
function currentRole() {
  return String(window.fsEffectiveRole ? window.fsEffectiveRole() : (window.CU && window.CU.role) || '');
}
function isMaster() { return !!(window.CU && window.CU.master); }
function permitted() {
  // analytics (narcotics) panel - kept for backwards compatibility usage at line 592/637
  return isMaster() || ['controlled_pharmacy'].includes(currentRole());
}
function tabAllowed(tab) {
  const r = currentRole(), master = isMaster();
  if (tab === 'orders') return true;
  if (tab === 'analytics') return master || r === 'controlled_pharmacy';
  if (tab === 'crashcart' || tab === 'drugs' || tab === 'fulfillment') return master || ['pharmacy','inpatient_supervisor','inpatient_pharmacy_supervisor'].includes(r);
  return false;
}
function currentYear() { return new Date().getFullYear(); }
function reportYear() { const el = document.getElementById('car-year'); return Number(el && el.value) || currentYear(); }
function reportYearFrom() { const el = document.getElementById('car-year-from'); return Number(el && el.value) || currentYear() - 1; }
function reportYearTo() { const el = document.getElementById('car-year-to'); return Number(el && el.value) || currentYear(); }

/* ── styles ─────────────────────────────────────────────────────────────── */
const STYLE_ID = 'car-style-r78';
function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const s = document.createElement('style');
  s.id = STYLE_ID;
  s.textContent = `
#comprehensive-annual-report-host .car-card{border:1px solid var(--cl-border,#334155);border-radius:12px;overflow:hidden;margin-bottom:16px;background:var(--cl-bg,#0f172a)}
.car-header{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;padding:14px 18px 10px;border-bottom:1px solid var(--cl-border,#334155)}
.car-title{font-size:17px;font-weight:700;color:var(--cl-text,#f1f5f9)}
.car-sub{font-size:12px;color:var(--cl-sub,#94a3b8);margin-top:2px}
.car-controls{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.car-kpi-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px;padding:12px 18px}
.car-kpi{border:1px solid var(--cl-border,#334155);border-top:3px solid #2563eb;border-radius:10px;padding:10px 12px;background:var(--cl-card2,#111827)}
.car-kpi.warn{border-top-color:#f59e0b}.car-kpi.danger{border-top-color:#ef4444}.car-kpi.good{border-top-color:#10b981}
.car-kpi-label{font-size:11px;color:var(--cl-sub,#94a3b8);margin-bottom:3px}
.car-kpi-val{font-size:24px;font-weight:800;color:var(--cl-text,#f1f5f9);line-height:1.1}
.car-kpi-sub{font-size:11px;color:var(--cl-sub,#94a3b8);margin-top:3px}
.car-section{padding:0 18px 16px}
.car-section-title{font-size:13px;font-weight:700;color:var(--cl-text,#f1f5f9);padding:7px 10px;border-left:4px solid #3b82f6;background:var(--cl-card2,#1e293b);margin-bottom:10px;border-radius:0 6px 6px 0}
.car-section-title.warn{border-color:#f59e0b;background:rgba(245,158,11,.08)}
.car-section-title.good{border-color:#10b981;background:rgba(16,185,129,.08)}
.car-table{width:100%;border-collapse:collapse;font-size:13px}
.car-table th{background:var(--cl-card2,#1e293b);color:var(--cl-sub,#94a3b8);padding:8px 10px;text-align:left;border-bottom:1px solid var(--cl-border,#334155)}
.car-table td{padding:8px 10px;border-bottom:1px solid var(--cl-border,#334155);color:var(--cl-text,#e2e8f0);vertical-align:top}
.car-table tr:last-child td{border-bottom:none}
.car-badge{display:inline-block;font-size:11px;font-weight:700;padding:2px 6px;border-radius:99px}
.car-badge.gold{background:#fef3c7;color:#92400e}
.car-badge.green{background:#dcfce7;color:#166534}
.car-badge.red{background:#fee2e2;color:#991b1b}
.car-badge.blue{background:#dbeafe;color:#1e40af}
.anl-spike-badge{display:inline-block;font-size:11px;font-weight:700;padding:2px 7px;border-radius:99px;background:#fef3c7;color:#92400e;margin-left:6px}
.anl-spike-badge.low{background:#dcfce7;color:#166534}
.anl-spike-badge.good{background:#dcfce7;color:#166534}
.anl-spike-badge.mid{background:#fef3c7;color:#92400e}
.anl-spike-badge.high{background:#fee2e2;color:#991b1b}
.anl-spike-badge.extreme{background:#7f1d1d;color:#fecaca}
.anl-legend{display:flex;flex-wrap:wrap;gap:12px;align-items:center;font-size:11px;color:var(--cl-sub,#94a3b8);margin:8px 0 12px;padding:8px 10px;background:var(--cl-card2,#111827);border:1px solid var(--cl-border,#334155);border-radius:8px}
.anl-legend b{color:var(--cl-text,#f1f5f9)}
.car-bar-wrap{display:grid;gap:6px}
.car-bar-row{padding:8px 10px;border:1px solid var(--cl-border,#334155);border-radius:8px;background:var(--cl-card2,#111827)}
.car-bar-head{display:flex;justify-content:space-between;font-size:13px;margin-bottom:5px}
.car-bar-head b{color:var(--cl-text,#f1f5f9)}
.car-bar-head span{color:var(--cl-sub,#94a3b8);font-size:12px}
.car-meter{height:9px;background:var(--cl-border,#334155);border-radius:8px;overflow:hidden}
.car-meter i{display:block;height:100%;border-radius:8px;transition:width .4s}
.car-donut-row{display:flex;gap:12px;flex-wrap:wrap;align-items:center;padding:8px 0}
.car-donut-legend{display:grid;gap:4px;font-size:12px}
.car-legend-item{display:flex;align-items:center;gap:6px}
.car-legend-dot{width:10px;height:10px;border-radius:50%}
.car-empty{color:var(--cl-sub,#94a3b8);font-size:13px;padding:12px 0;text-align:center}
.car-month-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:6px}
.car-month-cell{border:1px solid var(--cl-border,#334155);border-radius:8px;padding:8px 10px;background:var(--cl-card2,#111827)}
.car-month-cell-name{font-size:11px;color:var(--cl-sub,#94a3b8)}
.car-month-cell-val{font-size:18px;font-weight:700;color:var(--cl-text,#f1f5f9);margin-top:2px}
.car-month-cell-sub{font-size:11px;color:var(--cl-sub,#94a3b8)}
.car-q-cmp{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:8px}
.car-q-item{border:1px solid var(--cl-border,#334155);border-radius:8px;padding:10px 12px;background:var(--cl-card2,#111827)}
.car-brand{font-size:10px;color:var(--cl-sub,#64748b);text-align:right;padding:4px 18px 10px}
@media(max-width:640px){.car-kpi-row{grid-template-columns:repeat(2,1fr)}.car-month-grid{grid-template-columns:repeat(2,1fr)}}
`;
  document.head.appendChild(s);
}

/* ── CRASH CART ANALYTICS ───────────────────────────────────────────────── */
function crashReportList() {
  return typeof window.crashReports === 'function' ? (window.crashReports() || []) : [];
}
function crashCartList() {
  return typeof window.crashCarts === 'function' ? (window.crashCarts() || []) : [];
}

// Duplicated from this file's other IIFE (the original quarterly/annual
// report scope): that IIFE and this one do NOT share lexical scope despite
// living in the same file (this file is 4 separate top-level IIFEs merged
// over time), so render()/renderCrash() here need their own copies of the
// spike-badge + threshold helpers rather than reaching across into the
// other IIFE's private functions.
const SPIKE_THRESHOLD_KEY = 'analytics_spike_threshold_pct';
function spikeThresholdPct() {
  const v = Number(window.S && typeof S.g === 'function' ? S.g(SPIKE_THRESHOLD_KEY) : null);
  return Number.isFinite(v) && v > 0 ? v : 30;
}
function spikeBadgeClass(pct, threshold) {
  if (pct >= threshold * 2.5) return 'extreme';
  if (pct >= threshold * 1.5) return 'high';
  return 'mid';
}
function spikeBadge(pct, threshold) {
  return `<span class="anl-spike-badge ${spikeBadgeClass(pct, threshold)}">+${pct}%</span>`;
}
function renderSpikeLegend(threshold) {
  return `<div class="anl-legend">
    <b>Legend / الدليل:</b>
    <span><span class="anl-spike-badge mid">+${threshold}%</span> ${threshold}–${Math.round(threshold * 1.5 - 1)}% increase</span>
    <span><span class="anl-spike-badge high">+${Math.round(threshold * 1.5)}%</span> ${Math.round(threshold * 1.5)}–${Math.round(threshold * 2.5 - 1)}% increase</span>
    <span><span class="anl-spike-badge extreme">+${Math.round(threshold * 2.5)}%</span> ${Math.round(threshold * 2.5)}%+ increase</span>
  </div>`;
}

// Severity-by-share badges: unlike spikeBadge (YoY % change), this tiers a
// value's share of a total (e.g. one medicine's share of all replacements),
// reusing the same visual language (anl-spike-badge classes) for consistency
// across every report in this module.
const SHARE_TIERS = { mid: 15, high: 25, extreme: 40 };
function shareBadgeClass(sharePct) {
  if (sharePct >= SHARE_TIERS.extreme) return 'extreme';
  if (sharePct >= SHARE_TIERS.high) return 'high';
  if (sharePct >= SHARE_TIERS.mid) return 'mid';
  return 'low';
}
function shareBadge(sharePct) {
  const cls = shareBadgeClass(sharePct);
  return `<span class="anl-spike-badge ${cls}">${sharePct}%</span>`;
}
// Fulfillment badges: inverse severity from shareBadge — here LOW % is bad
// (a request that came up short), so the color ramp runs the other way.
const FULFILL_TIERS = { good: 95, mid: 80, low: 60 };
function fulfillBadgeClass(pct) {
  if (pct >= FULFILL_TIERS.good) return 'good';
  if (pct >= FULFILL_TIERS.mid) return 'mid';
  if (pct >= FULFILL_TIERS.low) return 'high';
  return 'extreme';
}
function fulfillBadge(pct) {
  return `<span class="anl-spike-badge ${fulfillBadgeClass(pct)}">${pct}%</span>`;
}
function renderFulfillLegend() {
  return `<div class="anl-legend">
    <b>Legend / الدليل:</b>
    <span><span class="anl-spike-badge good">${FULFILL_TIERS.good}%+</span> Fully fulfilled / تلبية كاملة</span>
    <span><span class="anl-spike-badge mid">${FULFILL_TIERS.mid}–${FULFILL_TIERS.good - 1}%</span> Minor shortfall / نقص طفيف</span>
    <span><span class="anl-spike-badge high">${FULFILL_TIERS.low}–${FULFILL_TIERS.mid - 1}%</span> Significant shortfall / نقص ملحوظ</span>
    <span><span class="anl-spike-badge extreme">&lt;${FULFILL_TIERS.low}%</span> Severe shortfall / نقص حاد</span>
  </div>`;
}

function fulfillmentRequests() {
  const live = (typeof window.gr === 'function' ? window.gr() : (window.S && typeof S.g === 'function' ? S.g('requests') : [])) || [];
  const archive = (window.S && typeof S.g === 'function' ? S.g('request_analytics_archive') : []) || [];
  return live.concat(archive);
}
function requestFulfillmentPct(r) {
  const requestedQty = (r.items || []).reduce((s, i) => s + (Number(i.qty) || 0), 0);
  const dispensedQty = (r.dispensed || []).reduce((s, i) => s + (Number(i.qty) || 0), 0);
  if (!requestedQty) return null;
  return round1(dispensedQty / requestedQty * 100);
}
function fulfillmentStatsForYear(y) {
  const rows = fulfillmentRequests()
    .filter(r => (r.status === 'fulfilled' || r.status === 'partial') && new Date(r.fulfilledAt || r.updatedAt || r.created || 0).getFullYear() === y)
    .map(r => ({ r, pct: requestFulfillmentPct(r) }))
    .filter(x => x.pct !== null);

  const avgPct = rows.length ? round1(avg(rows.map(x => x.pct))) : null;
  const byDept = {};
  rows.forEach(x => { const d = deptName(x.r.deptId); (byDept[d] = byDept[d] || []).push(x.pct); });
  const deptStats = Object.entries(byDept)
    .map(([dept, pcts]) => ({ dept, avg: round1(avg(pcts)), count: pcts.length }))
    .sort((a, b) => a.avg - b.avg);
  const worst10 = rows.slice().sort((a, b) => a.pct - b.pct).slice(0, 10);
  return { total: rows.length, avgPct, deptStats, worst10 };
}

function renderFulfillmentSection() {
  const y = Number((document.getElementById('car-fulfill-year') || {}).value) || currentYear();
  const st = fulfillmentStatsForYear(y);

  let html = `
    <div class="car-kpi-row">
      <div class="car-kpi"><div class="car-kpi-label">Fulfilled/partial requests / طلبات مُلبّاة</div><div class="car-kpi-val">${st.total}</div></div>
      <div class="car-kpi ${st.avgPct === null ? '' : st.avgPct >= FULFILL_TIERS.good ? 'good' : st.avgPct < FULFILL_TIERS.low ? 'warn' : ''}">
        <div class="car-kpi-label">Average fulfillment rate / متوسط معدل التلبية</div>
        <div class="car-kpi-val">${st.avgPct === null ? '—' : st.avgPct + '%'}</div>
      </div>
      <div class="car-kpi"><div class="car-kpi-label">Departments represented / الأقسام</div><div class="car-kpi-val">${st.deptStats.length}</div></div>
    </div>`;

  if (!st.total) {
    html += `<div class="car-empty">No fulfilled or partially fulfilled requests in ${y}.</div>`;
    return html;
  }

  html += `<div class="car-section">
    <div class="car-section-title warn">📉 Lowest fulfillment rate requests / أقل الطلبات تلبية</div>
    ${renderFulfillLegend()}
    <div style="overflow:auto"><table class="car-table">
      <thead><tr><th>Department / القسم</th><th>Requested / المطلوب</th><th>Dispensed / المصروف</th><th>Fulfillment / التلبية</th><th>Date / التاريخ</th></tr></thead>
      <tbody>${st.worst10.map(x => {
        const requestedQty = (x.r.items || []).reduce((s, i) => s + (Number(i.qty) || 0), 0);
        const dispensedQty = (x.r.dispensed || []).reduce((s, i) => s + (Number(i.qty) || 0), 0);
        const d = x.r.fulfilledAt || x.r.updatedAt || x.r.created || '';
        return `<tr>
          <td><b>${esc(deptName(x.r.deptId))}</b></td>
          <td>${requestedQty}</td>
          <td>${dispensedQty}</td>
          <td>${fulfillBadge(x.pct)}</td>
          <td style="font-size:12px;color:var(--cl-sub,#94a3b8)">${d ? new Date(d).toLocaleDateString('en-SA') : '—'}</td>
        </tr>`;
      }).join('')}</tbody>
    </table></div>
  </div>`;

  html += `<div class="car-section">
    <div class="car-section-title">🏢 Average fulfillment by department / متوسط التلبية حسب القسم</div>
    <div style="overflow:auto"><table class="car-table">
      <thead><tr><th>Department / القسم</th><th>Requests / عدد الطلبات</th><th>Average fulfillment / متوسط التلبية</th></tr></thead>
      <tbody>${st.deptStats.map(d => `<tr>
        <td><b>${esc(d.dept)}</b></td>
        <td>${d.count}</td>
        <td>${fulfillBadge(d.avg)}</td>
      </tr>`).join('')}</tbody>
    </table></div>
  </div>`;

  return html;
}

function printFulfillmentReport() {
  const y = Number((document.getElementById('car-fulfill-year') || {}).value) || currentYear();
  const st = fulfillmentStatsForYear(y);
  const now = new Date().toLocaleDateString('en-SA');

  let body = `<h1>Request Fulfillment Rate / معدل تلبية الطلبات<br><small>${y} · ${now}</small></h1>
    <div class="kpi-row">
      <div class="kpi"><div class="kpi-label">Fulfilled/partial requests</div><div class="kpi-val">${st.total}</div></div>
      <div class="kpi"><div class="kpi-label">Average fulfillment rate</div><div class="kpi-val">${st.avgPct === null ? '—' : st.avgPct + '%'}</div></div>
      <div class="kpi"><div class="kpi-label">Departments</div><div class="kpi-val">${st.deptStats.length}</div></div>
    </div>`;

  if (!st.total) {
    body += `<div class="section">No fulfilled or partially fulfilled requests in ${y}.</div>`;
  } else {
    body += `<div class="section"><h2 class="warn">Lowest Fulfillment Rate Requests / أقل الطلبات تلبية</h2>
      ${renderFulfillLegend()}
      <table><thead><tr><th>Department</th><th>Requested</th><th>Dispensed</th><th>Fulfillment</th><th>Date</th></tr></thead>
      <tbody>${st.worst10.map(x => {
        const requestedQty = (x.r.items || []).reduce((s, i) => s + (Number(i.qty) || 0), 0);
        const dispensedQty = (x.r.dispensed || []).reduce((s, i) => s + (Number(i.qty) || 0), 0);
        const d = x.r.fulfilledAt || x.r.updatedAt || x.r.created || '';
        return `<tr><td>${esc(deptName(x.r.deptId))}</td><td>${requestedQty}</td><td>${dispensedQty}</td><td>${fulfillBadge(x.pct)}</td><td>${d ? new Date(d).toLocaleDateString('en-SA') : '—'}</td></tr>`;
      }).join('')}</tbody></table></div>
      <div class="section"><h2>Average Fulfillment by Department / متوسط التلبية حسب القسم</h2>
      <table><thead><tr><th>Department</th><th>Requests</th><th>Average fulfillment</th></tr></thead>
      <tbody>${st.deptStats.map(d => `<tr><td>${esc(d.dept)}</td><td>${d.count}</td><td>${fulfillBadge(d.avg)}</td></tr>`).join('')}</tbody></table></div>`;
  }

  openPrintWindow('Request Fulfillment Rate', body);
}

function renderFulfillment() {
  const host = document.getElementById('car-fulfillment-host');
  if (!host || !tabAllowed('fulfillment')) return;
  injectStyles();

  const y = currentYear();
  const years = [];
  for (let i = 2026; i <= y; i++) years.push(i);
  const selY = Number((document.getElementById('car-fulfill-year') || {}).value) || y;

  host.innerHTML = `
    <div class="car-card">
      <div class="car-header">
        <div>
          <div class="car-title">📦 Request Fulfillment Rate / معدل تلبية الطلبات</div>
          <div class="car-sub">Master · Pharmacy · Inpatient Supervisor</div>
        </div>
        <div class="car-controls">
          <label style="font-size:12px">Year / السنة
            <select id="car-fulfill-year">${years.map(v => `<option value="${v}"${v === selY ? ' selected' : ''}>${v}</option>`).join('')}</select>
          </label>
          <button class="btn bp bsm" id="car-fulfill-print">🖨 Print / طباعة</button>
        </div>
      </div>
      <div id="car-fulfill-body">${renderFulfillmentSection()}</div>
      <div class="car-brand">${BRAND}</div>
    </div>
  `;

  const yearEl = document.getElementById('car-fulfill-year');
  if (yearEl && !yearEl.dataset.bound) {
    yearEl.dataset.bound = '1';
    yearEl.addEventListener('change', () => {
      const body = document.getElementById('car-fulfill-body');
      if (body) body.innerHTML = renderFulfillmentSection();
    });
  }
  const printBtn = document.getElementById('car-fulfill-print');
  if (printBtn && !printBtn.dataset.bound) {
    printBtn.dataset.bound = '1';
    printBtn.addEventListener('click', printFulfillmentReport);
  }
}

function renderShareLegend() {
  return `<div class="anl-legend">
    <b>Legend / الدليل:</b>
    <span><span class="anl-spike-badge low">&lt;${SHARE_TIERS.mid}%</span> normal share</span>
    <span><span class="anl-spike-badge mid">${SHARE_TIERS.mid}%</span> ${SHARE_TIERS.mid}–${SHARE_TIERS.high - 1}% of total</span>
    <span><span class="anl-spike-badge high">${SHARE_TIERS.high}%</span> ${SHARE_TIERS.high}–${SHARE_TIERS.extreme - 1}% of total</span>
    <span><span class="anl-spike-badge extreme">${SHARE_TIERS.extreme}%</span> ${SHARE_TIERS.extreme}%+ of total</span>
  </div>`;
}

function crashStatsForYears(fromY, toY) {
  const reports = crashReportList().filter(r => {
    const y = new Date(r.openedAt || r.created || 0).getFullYear();
    return y >= fromY && y <= toY;
  });

  // Per-cart openings
  const cartOpenings = {};
  const cartReplacements = {};

  reports.forEach(r => {
    if (String(r.operation || 'open') === 'seal_correction') return;
    const cid = String(r.cartId || '—');
    cartOpenings[cid] = (cartOpenings[cid] || 0) + 1;
    const replacements = Array.isArray(r.replacements) ? r.replacements.length : 0;
    if (!cartReplacements[cid]) cartReplacements[cid] = [];
    cartReplacements[cid].push(replacements);
  });

  // Avg days between openings per cart
  const cartIntervalDays = {};
  const carts = crashCartList();
  carts.forEach(c => {
    const cid = String(c.id);
    const times = reports
      .filter(r => String(r.cartId) === cid && String(r.operation || 'open') !== 'seal_correction')
      .map(r => new Date(r.openedAt || r.created || 0).getTime())
      .filter(t => t > 0)
      .sort((a, b) => a - b);
    if (times.length < 2) { cartIntervalDays[cid] = null; return; }
    const diffs = [];
    for (let i = 1; i < times.length; i++) diffs.push((times[i] - times[i - 1]) / 86400000);
    cartIntervalDays[cid] = round1(avg(diffs));
  });

  // Total replacements & avg per opening
  const totalOpenings = reports.filter(r => String(r.operation || 'open') !== 'seal_correction').length;
  const totalReplacements = reports.reduce((s, r) => s + (Array.isArray(r.replacements) ? r.replacements.length : 0), 0);
  const avgReplacementsPerOpening = totalOpenings ? round1(totalReplacements / totalOpenings) : 0;

  // Top 5 most opened, bottom 2 least opened (among carts with at least 1 opening)
  const cartsSorted = carts
    .map(c => ({
      id: String(c.id), name: c.name || c.id,
      dept: deptName(c.deptId),
      openings: cartOpenings[String(c.id)] || 0,
      avgRepl: cartReplacements[String(c.id)] ? round1(avg(cartReplacements[String(c.id)])) : 0,
      intervalDays: cartIntervalDays[String(c.id)],
    }))
    .filter(c => c.openings > 0)
    .sort((a, b) => b.openings - a.openings);

  const top5 = cartsSorted.slice(0, 5);
  const bottom2 = cartsSorted.slice(-2).reverse();

  // Top 10 medicines replaced across all reports
  const medCounts = {};
  reports.forEach(r => {
    (r.replacements || []).forEach(rep => {
      const name = String(rep.name || rep.medName || rep.genericName || rep.medId || '—');
      medCounts[name] = (medCounts[name] || 0) + 1;
    });
  });
  const topMeds = Object.entries(medCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Department contribution to top 10 replaced medicines
  const deptMedCounts = {};
  reports.forEach(r => {
    const dept = deptName(r.deptId);
    (r.replacements || []).forEach(rep => {
      const name = String(rep.name || rep.medName || rep.genericName || rep.medId || '—');
      if (!deptMedCounts[name]) deptMedCounts[name] = {};
      deptMedCounts[name][dept] = (deptMedCounts[name][dept] || 0) + 1;
    });
  });

  return { totalOpenings, totalReplacements, avgReplacementsPerOpening, top5, bottom2, topMeds, deptMedCounts, cartsSorted };
}

function renderCrashSection() {
  const fromY = reportYearFrom(), toY = reportYearTo();
  const st = crashStatsForYears(fromY, toY);
  const allCarts = crashCartList();

  let html = `
    <div class="car-kpi-row">
      <div class="car-kpi"><div class="car-kpi-label">Opening count / عدد مرات الفتح</div><div class="car-kpi-val">${st.totalOpenings}</div></div>
      <div class="car-kpi warn"><div class="car-kpi-label">Medicines replaced / أدوية استُبدلت</div><div class="car-kpi-val">${st.totalReplacements}</div></div>
      <div class="car-kpi"><div class="car-kpi-label">Avg replacements / opening / متوسط لكل فتحة</div><div class="car-kpi-val">${st.avgReplacementsPerOpening}</div></div>
      <div class="car-kpi"><div class="car-kpi-label">Active carts / العربات النشطة</div><div class="car-kpi-val">${allCarts.length}</div></div>
      <div class="car-kpi"><div class="car-kpi-label">Carts with openings / عربات انفتحت</div><div class="car-kpi-val">${st.cartsSorted.length}</div></div>
    </div>
  `;

  // Top 5 most opened
  html += `<div class="car-section">
    <div class="car-section-title warn">🏆 Top 5 most opened carts / أكثر 5 عربات انفتحت</div>`;
  if (!st.top5.length) {
    html += `<div class="car-empty">No crash cart opening records in this period.</div>`;
  } else {
    const maxOpen = st.top5[0].openings;
    html += `<div class="car-bar-wrap">` + st.top5.map((c, i) => {
      const colors = ['#2563eb','#059669','#d97706','#7c3aed','#dc2626'];
      const w = Math.max(2, Math.round(c.openings / maxOpen * 100));
      return `<div class="car-bar-row">
        <div class="car-bar-head">
          <b><span class="car-badge gold">#${i + 1}</span> ${esc(c.name)}</b>
          <span>${esc(c.dept)} · ${c.openings} openings · avg ${c.avgRepl} replacements${c.intervalDays !== null ? ` · every ${c.intervalDays} days` : ''}</span>
        </div>
        <div class="car-meter"><i style="width:${w}%;background:${colors[i]}"></i></div>
      </div>`;
    }).join('') + `</div>`;
  }
  html += `</div>`;

  // Bottom 2 least opened
  if (st.bottom2.length && st.bottom2[0].id !== (st.top5[st.top5.length - 1] || {}).id) {
    html += `<div class="car-section">
      <div class="car-section-title">📉 Least opened carts / أقل عربتين فُتحتا</div>
      <div style="overflow:auto"><table class="car-table">
        <thead><tr><th>Cart / العربة</th><th>Department / القسم</th><th>Openings / عدد الفتحات</th><th>Avg replacements</th><th>Avg days between openings</th></tr></thead>
        <tbody>${st.bottom2.map(c => `<tr>
          <td><b>${esc(c.name)}</b></td>
          <td>${esc(c.dept)}</td>
          <td><span class="car-badge green">${c.openings}</span></td>
          <td>${c.avgRepl}</td>
          <td>${c.intervalDays !== null ? c.intervalDays : '—'}</td>
        </tr>`).join('')}</tbody>
      </table></div>
    </div>`;
  }

  // Top 10 replaced medicines with dept contribution
  html += `<div class="car-section">
    <div class="car-section-title warn">💊 Top 10 replaced medicines / أكثر 10 أدوية استُبدلت</div>`;
  if (!st.topMeds.length) {
    html += `<div class="car-empty">No replacement records in this period.</div>`;
  } else {
    const maxC = st.topMeds[0].count;
    html += renderShareLegend();
    html += `<div style="overflow:auto"><table class="car-table">
      <thead><tr><th>#</th><th>Medicine / الدواء</th><th>Times replaced / عدد الاستبدالات</th><th>Share % / النسبة</th><th>Top departments / الأقسام</th></tr></thead>
      <tbody>${st.topMeds.map((m, i) => {
        const topDepts = Object.entries(st.deptMedCounts[m.name] || {})
          .sort((a, b) => b[1] - a[1]).slice(0, 3)
          .map(([d, n]) => `${esc(d)}: ${n} (${pct(n, m.count)}%)`).join('<br>');
        return `<tr>
          <td>${i + 1}</td>
          <td><b>${esc(m.name)}</b></td>
          <td>${m.count}</td>
          <td>${shareBadge(pct(m.count, st.totalReplacements))}</td>
          <td style="font-size:12px;color:var(--cl-sub,#94a3b8)">${topDepts || '—'}</td>
        </tr>`;
      }).join('')}</tbody>
    </table></div>`;
  }
  html += `</div>`;

  return html;
}

/* ── NARCOTIC / CONTROLLED ANALYTICS ───────────────────────────────────── */
function narcoticMoves() {
  return typeof window.ctlMoves === 'function' ? (window.ctlMoves() || []) : (window.S && window.S.g ? window.S.g('controlled_moves') || [] : []);
}
function narcoticCatalog() {
  const cat = window.S && window.S.g ? (window.S.g('controlled_catalog') || []) : [];
  return cat;
}

function narcoticStatsForYear(y) {
  const moves = narcoticMoves().filter(m => {
    if (m.type !== 'dispense') return false;
    const d = new Date(m.at || 0);
    return d.getFullYear() === y;
  });

  const catalog = narcoticCatalog();
  const uniqueMeds = new Set(moves.map(m => m.medId).filter(Boolean));
  const totalUnits = moves.reduce((s, m) => s + (Number(m.qty) || 0), 0);

  // Inpatient vs outpatient
  const inpatientUnits = moves.filter(m => m.dispenseType === 'inpatient' || m.dispenseType === 'internal').reduce((s, m) => s + (Number(m.qty) || 0), 0);
  const outpatientUnits = totalUnits - inpatientUnits;

  // Monthly breakdown
  const monthly = Array(12).fill(0).map((_, i) => ({
    month: i,
    units: moves.filter(m => new Date(m.at || 0).getMonth() === i).reduce((s, m) => s + (Number(m.qty) || 0), 0),
    events: moves.filter(m => new Date(m.at || 0).getMonth() === i).length,
  }));

  // Quarterly
  const quarterly = [1,2,3,4].map(q => ({
    q,
    units: moves.filter(m => Math.floor(new Date(m.at || 0).getMonth() / 3) + 1 === q).reduce((s, m) => s + (Number(m.qty) || 0), 0),
    events: moves.filter(m => Math.floor(new Date(m.at || 0).getMonth() / 3) + 1 === q).length,
  }));

  // Top medicines
  const medTotals = {};
  moves.forEach(m => {
    if (!m.medId) return;
    const med = catalog.find(c => String(c.id) === String(m.medId));
    const name = (med && med.name) || m.medId;
    const cls = (med && med.classification) || 'narcotic';
    if (!medTotals[name]) medTotals[name] = { units: 0, events: 0, cls };
    medTotals[name].units += Number(m.qty) || 0;
    medTotals[name].events++;
  });
  const topMeds = Object.entries(medTotals)
    .map(([name, d]) => ({ name, ...d }))
    .sort((a, b) => b.units - a.units)
    .slice(0, 10);

  return { moves: moves.length, uniqueMeds: uniqueMeds.size, totalUnits, inpatientUnits, outpatientUnits, monthly, quarterly, topMeds, catalog };
}

function renderNarcoticSection() {
  const y = reportYear();
  const priorY = y - 1;
  const st = narcoticStatsForYear(y);
  const priorSt = narcoticStatsForYear(priorY);

  const pctChange = (a, b) => b > 0 ? Math.round((a - b) / b * 1000) / 10 : null;
  const arrow = (pct) => pct === null ? '' : pct > 0 ? `<span class="car-badge gold">↑${pct}%</span>` : pct < 0 ? `<span class="car-badge green">↓${Math.abs(pct)}%</span>` : '';

  let html = `
    <div class="car-kpi-row">
      <div class="car-kpi"><div class="car-kpi-label">Medicine types in catalog / أصناف في القائمة</div><div class="car-kpi-val">${st.catalog.length}</div></div>
      <div class="car-kpi warn"><div class="car-kpi-label">Dispense events ${y} / صرفيات السنة</div><div class="car-kpi-val">${st.moves}</div><div class="car-kpi-sub">${arrow(pctChange(st.moves, priorSt.moves))} vs ${priorY}</div></div>
      <div class="car-kpi"><div class="car-kpi-label">Total units dispensed / إجمالي الوحدات</div><div class="car-kpi-val">${st.totalUnits}</div><div class="car-kpi-sub">${arrow(pctChange(st.totalUnits, priorSt.totalUnits))} vs ${priorY}</div></div>
      <div class="car-kpi good"><div class="car-kpi-label">Inpatient / داخلي</div><div class="car-kpi-val">${pct(st.inpatientUnits, st.totalUnits)}%</div><div class="car-kpi-sub">${st.inpatientUnits} units</div></div>
      <div class="car-kpi"><div class="car-kpi-label">Outpatient / خارجي</div><div class="car-kpi-val">${pct(st.outpatientUnits, st.totalUnits)}%</div><div class="car-kpi-sub">${st.outpatientUnits} units</div></div>
    </div>
  `;

  // Inpatient vs outpatient visual bar
  const inPct = pct(st.inpatientUnits, st.totalUnits);
  const outPct = pct(st.outpatientUnits, st.totalUnits);
  html += `<div class="car-section">
    <div class="car-section-title">Inpatient vs Outpatient / داخلي مقابل خارجي</div>
    <div style="background:var(--cl-border,#334155);border-radius:8px;overflow:hidden;height:24px;display:flex;margin-bottom:8px">
      <div style="width:${inPct}%;background:#2563eb;display:flex;align-items:center;justify-content:center;font-size:12px;color:#fff;font-weight:700;min-width:0;overflow:hidden">${inPct > 5 ? inPct + '%' : ''}</div>
      <div style="width:${outPct}%;background:#7c3aed;display:flex;align-items:center;justify-content:center;font-size:12px;color:#fff;font-weight:700;min-width:0;overflow:hidden">${outPct > 5 ? outPct + '%' : ''}</div>
    </div>
    <div style="display:flex;gap:16px;font-size:12px;color:var(--cl-sub,#94a3b8)">
      <span><span style="display:inline-block;width:10px;height:10px;background:#2563eb;border-radius:50%;margin-right:4px"></span>Inpatient ${inPct}% (${st.inpatientUnits} units)</span>
      <span><span style="display:inline-block;width:10px;height:10px;background:#7c3aed;border-radius:50%;margin-right:4px"></span>Outpatient ${outPct}% (${st.outpatientUnits} units)</span>
    </div>
  </div>`;

  // Monthly breakdown
  const maxMonthUnits = Math.max(1, ...st.monthly.map(m => m.units));
  html += `<div class="car-section">
    <div class="car-section-title">Monthly breakdown ${y} / التوزيع الشهري</div>
    <div class="car-month-grid">
      ${st.monthly.map(m => `
        <div class="car-month-cell">
          <div class="car-month-cell-name">${MONTHS_EN[m.month]} / ${MONTHS_AR[m.month]}</div>
          <div class="car-month-cell-val">${m.units}</div>
          <div class="car-month-cell-sub">${m.events} events · ${pct(m.units, st.totalUnits)}%</div>
          <div class="car-meter" style="margin-top:4px"><i style="width:${Math.max(2, Math.round(m.units / maxMonthUnits * 100))}%;background:#2563eb"></i></div>
        </div>
      `).join('')}
    </div>
  </div>`;

  // Quarterly comparison (current vs prior quarter same year + vs prior year)
  const narcThreshold = spikeThresholdPct();
  html += `<div class="car-section">
    <div class="car-section-title">Quarterly comparison / المقارنة الربعية — ${y}</div>
    ${renderSpikeLegend(narcThreshold)}
    <div class="car-q-cmp">
      ${st.quarterly.map((q, idx) => {
        const priorYQ = priorSt.quarterly.find(p => p.q === q.q) || { units: 0 };
        const prevSameYQ = idx > 0 ? st.quarterly[idx - 1] : null;
        const pcVsPriorY = pctChange(q.units, priorYQ.units);
        const pcVsPrevQ = prevSameYQ !== null ? pctChange(q.units, prevSameYQ.units) : null;
        const badgeY = pcVsPriorY === null ? '<span style="color:#64748b">No prior year data</span>'
          : pcVsPriorY > 0 ? spikeBadge(pcVsPriorY, narcThreshold) + ` vs ${priorY} Q${q.q}`
          : `<span style="color:#10b981">↓ ${Math.abs(pcVsPriorY)}% vs ${priorY} Q${q.q}</span>`;
        const badgeQ = pcVsPrevQ === null ? '—'
          : pcVsPrevQ > 0 ? spikeBadge(pcVsPrevQ, narcThreshold) + ` vs Q${prevSameYQ.q} ${y}`
          : `<span style="color:#10b981">↓ ${Math.abs(pcVsPrevQ)}% vs Q${prevSameYQ.q} ${y}</span>`;
        return `<div class="car-q-item">
          <div style="font-size:12px;color:var(--cl-sub,#94a3b8)">Q${q.q} / الربع ${['','الأول','الثاني','الثالث','الرابع'][q.q]}</div>
          <div style="font-size:22px;font-weight:800;color:var(--cl-text,#f1f5f9);margin:4px 0">${q.units}</div>
          <div style="font-size:12px">${badgeY}</div>
          ${prevSameYQ ? `<div style="font-size:12px;margin-top:3px">${badgeQ}</div>` : ''}
          <div style="font-size:11px;color:var(--cl-sub,#94a3b8);margin-top:3px">${q.events} dispense events</div>
        </div>`;
      }).join('')}
    </div>
  </div>`;

  // Half-year comparison
  const h1Units = st.quarterly.filter(q => q.q <= 2).reduce((s, q) => s + q.units, 0);
  const h2Units = st.quarterly.filter(q => q.q >= 3).reduce((s, q) => s + q.units, 0);
  const h1Events = st.quarterly.filter(q => q.q <= 2).reduce((s, q) => s + q.events, 0);
  const h2Events = st.quarterly.filter(q => q.q >= 3).reduce((s, q) => s + q.events, 0);
  const h1PriorUnits = priorSt.quarterly.filter(q => q.q <= 2).reduce((s, q) => s + q.units, 0);
  const h2PriorUnits = priorSt.quarterly.filter(q => q.q >= 3).reduce((s, q) => s + q.units, 0);
  const pcH1 = pctChange(h1Units, h2Units); // H1 vs H2 same year
  const pcH2vsPrior = pctChange(h2Units, h2PriorUnits);
  const pcH1vsPrior = pctChange(h1Units, h1PriorUnits);
  html += `<div class="car-section">
    <div class="car-section-title">Half-year comparison / مقارنة النصفين — ${y}</div>
    <div class="car-q-cmp">
      <div class="car-q-item">
        <div style="font-size:12px;color:var(--cl-sub,#94a3b8)">H1 — Q1+Q2 / النصف الأول</div>
        <div style="font-size:22px;font-weight:800;color:var(--cl-text,#f1f5f9);margin:4px 0">${h1Units}</div>
        <div style="font-size:12px;color:${pcH1 === null ? '#64748b' : pcH1 <= 0 ? '#10b981' : '#f59e0b'}">${pcH1 !== null ? (pcH1 >= 0 ? '↑ +' : '↓ ') + Math.abs(pcH1) + '% vs H2 ' + y : '—'}</div>
        <div style="font-size:12px;color:${pcH1vsPrior === null ? '#64748b' : pcH1vsPrior > 0 ? '#f59e0b' : '#10b981'};margin-top:3px">${pcH1vsPrior !== null ? (pcH1vsPrior >= 0 ? '↑ +' : '↓ ') + Math.abs(pcH1vsPrior) + '% vs H1 ' + priorY : 'No prior data'}</div>
        <div style="font-size:11px;color:var(--cl-sub,#94a3b8);margin-top:3px">${h1Events} events</div>
      </div>
      <div class="car-q-item">
        <div style="font-size:12px;color:var(--cl-sub,#94a3b8)">H2 — Q3+Q4 / النصف الثاني</div>
        <div style="font-size:22px;font-weight:800;color:var(--cl-text,#f1f5f9);margin:4px 0">${h2Units}</div>
        <div style="font-size:12px;color:${pcH1 === null ? '#64748b' : pcH1 >= 0 ? '#10b981' : '#f59e0b'}">${pcH1 !== null ? (pcH1 <= 0 ? '↑ +' : '↓ ') + Math.abs(pcH1) + '% vs H1 ' + y : '—'}</div>
        <div style="font-size:12px;color:${pcH2vsPrior === null ? '#64748b' : pcH2vsPrior > 0 ? '#f59e0b' : '#10b981'};margin-top:3px">${pcH2vsPrior !== null ? (pcH2vsPrior >= 0 ? '↑ +' : '↓ ') + Math.abs(pcH2vsPrior) + '% vs H2 ' + priorY : 'No prior data'}</div>
        <div style="font-size:11px;color:var(--cl-sub,#94a3b8);margin-top:3px">${h2Events} events</div>
      </div>
    </div>
  </div>`;

  // Year vs prior year summary
  const pc = pctChange(st.totalUnits, priorSt.totalUnits);
  html += `<div class="car-section">
    <div class="car-section-title">Year-over-year / مقارنة السنوات</div>
    <div style="overflow:auto"><table class="car-table">
      <thead><tr><th>Year / السنة</th><th>Dispense events</th><th>Total units</th><th>Inpatient %</th><th>Outpatient %</th><th>Δ vs prior year</th></tr></thead>
      <tbody>
        <tr>
          <td><b>${priorY}</b></td>
          <td>${priorSt.moves}</td><td>${priorSt.totalUnits}</td>
          <td>${pct(priorSt.inpatientUnits, priorSt.totalUnits)}%</td>
          <td>${pct(priorSt.outpatientUnits, priorSt.totalUnits)}%</td>
          <td>—</td>
        </tr>
        <tr style="background:var(--cl-card2,#111827)">
          <td><b>${y}</b></td>
          <td>${st.moves}</td><td><b>${st.totalUnits}</b></td>
          <td>${pct(st.inpatientUnits, st.totalUnits)}%</td>
          <td>${pct(st.outpatientUnits, st.totalUnits)}%</td>
          <td style="color:${pc === null ? '' : pc > 0 ? '#f59e0b' : '#10b981'};font-weight:700">${pc !== null ? (pc >= 0 ? '↑ +' : '↓ ') + Math.abs(pc) + '%' : '—'}</td>
        </tr>
      </tbody>
    </table></div>
  </div>`;

  // Top 10 medicines
  html += `<div class="car-section">
    <div class="car-section-title warn">💊 Top 10 dispensed narcotics / أكثر 10 أدوية مخدرة صرفًا</div>`;
  if (!st.topMeds.length) {
    html += `<div class="car-empty">No narcotic dispensing recorded in ${y}.</div>`;
  } else {
    html += `<div style="overflow:auto"><table class="car-table">
      <thead><tr><th>#</th><th>Medicine</th><th>Classification</th><th>Units</th><th>Events</th><th>Share</th></tr></thead>
      <tbody>${st.topMeds.map((m, i) => `<tr>
        <td>${i + 1}</td>
        <td><b>${esc(m.name)}</b></td>
        <td><span class="car-badge ${m.cls === 'narcotic' ? 'red' : 'gold'}">${esc(m.cls)}</span></td>
        <td>${m.units}</td>
        <td>${m.events}</td>
        <td>${pct(m.units, st.totalUnits)}%</td>
      </tr>`).join('')}</tbody>
    </table></div>`;
  }
  html += `</div>`;

  return html;
}

/* ── PRINT ──────────────────────────────────────────────────────────────── */
const PRINT_CSS = `
@page{size:A4 portrait;margin:14mm 12mm 18mm}
body{font:10pt Arial,sans-serif;color:#172033;background:#fff}
h1{font-size:16pt;color:#102a5c;margin:0 0 4px;border-bottom:3px solid #2563eb;padding-bottom:6px}
h2{font-size:13pt;color:#102a5c;background:#e8f0ff;border-left:4px solid #2563eb;padding:5px 8px;margin:12px 0 6px}
h2.warn{border-color:#f59e0b;background:#fffbeb;color:#92400e}
table{width:100%;border-collapse:collapse;margin-top:6px;font-size:9pt}
th,td{border:1px solid #9aa8bd;padding:6px;text-align:left;vertical-align:top}
th{background:#dbeafe;color:#102a5c}
.kpi-row{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin:10px 0}
.kpi{border:1px solid #b9cae8;border-top:3px solid #2563eb;padding:8px;background:#f5f9ff}
.kpi-label{font-size:8pt;color:#52627b}
.kpi-val{font-size:16pt;font-weight:bold;color:#102a5c;margin-top:2px}
.brand{text-align:right;font-size:8pt;color:#94a3b8;margin-top:8px}
.meter{height:8px;background:#e3eaf4;border-radius:5px;overflow:hidden;margin-top:2px}
.meter i{display:block;height:100%;border-radius:5px}
.month-grid{display:grid;grid-template-columns:repeat(6,1fr);gap:4px}
.month-cell{border:1px solid #e2e8f0;border-radius:4px;padding:5px}
.month-name{font-size:7pt;color:#64748b}
.month-val{font-size:14pt;font-weight:bold;color:#102a5c}
.section{break-inside:avoid;margin-bottom:14px}
.anl-spike-badge{display:inline-block;font-size:8pt;font-weight:bold;padding:1px 6px;border-radius:99px;background:#fef3c7;color:#92400e}
.anl-spike-badge.low{background:#dcfce7;color:#166534}
.anl-spike-badge.good{background:#dcfce7;color:#166534}
.anl-spike-badge.mid{background:#fef3c7;color:#92400e}
.anl-spike-badge.high{background:#fee2e2;color:#991b1b}
.anl-spike-badge.extreme{background:#7f1d1d;color:#fecaca}
.anl-legend{display:flex;flex-wrap:wrap;gap:10px;align-items:center;font-size:8pt;color:#52627b;margin:6px 0 10px;padding:6px 8px;background:#f5f9ff;border:1px solid #c8d4e8;border-radius:6px}
.anl-legend b{color:#102a5c}
@media print{button{display:none!important}.section{break-inside:avoid}}
`;

function openPrintWindow(title, bodyHtml) {
  if (typeof window.fsOfficialPrint === 'function') {
    window.fsOfficialPrint({ title, html: bodyHtml, css: PRINT_CSS });
    return;
  }
  const w = window.open('', '_blank');
  if (!w) { window.toast && window.toast('Allow pop-ups to print.', 'err'); return; }
  const footer = `<div class="brand">${BRAND}</div>`;
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>${PRINT_CSS}</style></head><body>${bodyHtml}${footer}<script>(function(){var done=false;function go(){if(done)return;done=true;window.print()}window.addEventListener("load",function(){setTimeout(go,300)},{once:true});setTimeout(go,1500)})()</script></body></html>`);
  w.document.close();
}

function printCrashReport() {
  const fromY = reportYearFrom(), toY = reportYearTo();
  const st = crashStatsForYears(fromY, toY);
  const now = new Date().toLocaleDateString('en-SA');

  let body = `<h1>Crash Cart Analytics / تقرير عربات الطوارئ<br><small>${fromY}–${toY} · ${now}</small></h1>
    <div class="kpi-row">
      <div class="kpi"><div class="kpi-label">Total openings</div><div class="kpi-val">${st.totalOpenings}</div></div>
      <div class="kpi"><div class="kpi-label">Total replacements</div><div class="kpi-val">${st.totalReplacements}</div></div>
      <div class="kpi"><div class="kpi-label">Avg replacements/opening</div><div class="kpi-val">${st.avgReplacementsPerOpening}</div></div>
      <div class="kpi"><div class="kpi-label">Active carts</div><div class="kpi-val">${crashCartList().length}</div></div>
      <div class="kpi"><div class="kpi-label">Carts with openings</div><div class="kpi-val">${st.cartsSorted.length}</div></div>
    </div>
    <div class="section"><h2 class="warn">Top 5 Most Opened Carts / أكثر 5 عربات انفتحت</h2>
    <table><thead><tr><th>#</th><th>Cart</th><th>Department</th><th>Openings</th><th>Avg replacements</th><th>Avg days between openings</th></tr></thead>
    <tbody>${st.top5.map((c, i) => `<tr><td>${i+1}</td><td>${esc(c.name)}</td><td>${esc(c.dept)}</td><td><b>${c.openings}</b></td><td>${c.avgRepl}</td><td>${c.intervalDays !== null ? c.intervalDays : '—'}</td></tr>`).join('')}</tbody>
    </table></div>`;

  if (st.bottom2.length) {
    body += `<div class="section"><h2>Least Opened Carts</h2>
      <table><thead><tr><th>Cart</th><th>Department</th><th>Openings</th><th>Avg replacements</th></tr></thead>
      <tbody>${st.bottom2.map(c => `<tr><td>${esc(c.name)}</td><td>${esc(c.dept)}</td><td>${c.openings}</td><td>${c.avgRepl}</td></tr>`).join('')}</tbody>
      </table></div>`;
  }

  body += `<div class="section"><h2 class="warn">Top 10 Replaced Medicines / أكثر 10 أدوية استُبدلت</h2>
    ${renderShareLegend()}
    <table><thead><tr><th>#</th><th>Medicine</th><th>Times replaced</th><th>Share</th><th>Top departments</th></tr></thead>
    <tbody>${st.topMeds.map((m, i) => {
      const topDepts = Object.entries(st.deptMedCounts[m.name] || {})
        .sort((a, b) => b[1] - a[1]).slice(0, 3)
        .map(([d, n]) => `${esc(d)}: ${n}`).join(', ');
      return `<tr><td>${i+1}</td><td><b>${esc(m.name)}</b></td><td>${m.count}</td><td>${shareBadge(pct(m.count, st.totalReplacements))}</td><td>${topDepts || '—'}</td></tr>`;
    }).join('')}</tbody>
    </table></div>`;

  openPrintWindow('Crash Cart Analytics', body);
}

function printNarcoticReport() {
  const y = reportYear(), priorY = y - 1;
  const st = narcoticStatsForYear(y);
  const priorSt = narcoticStatsForYear(priorY);
  const pctChange = (a, b) => b > 0 ? round1((a - b) / b * 100) : null;
  const now = new Date().toLocaleDateString('en-SA');

  let body = `<h1>Narcotic & Controlled Dispensing / إحصاءات المخدرات والعقاقير المضبوطة<br><small>${y} · ${now}</small></h1>
    <div class="kpi-row">
      <div class="kpi"><div class="kpi-label">Catalog medicines</div><div class="kpi-val">${st.catalog.length}</div></div>
      <div class="kpi"><div class="kpi-label">Dispense events</div><div class="kpi-val">${st.moves}</div></div>
      <div class="kpi"><div class="kpi-label">Total units</div><div class="kpi-val">${st.totalUnits}</div></div>
      <div class="kpi"><div class="kpi-label">Inpatient %</div><div class="kpi-val">${pct(st.inpatientUnits, st.totalUnits)}%</div></div>
      <div class="kpi"><div class="kpi-label">Outpatient %</div><div class="kpi-val">${pct(st.outpatientUnits, st.totalUnits)}%</div></div>
    </div>
    <div class="section"><h2>Monthly Breakdown ${y} / التوزيع الشهري</h2>
    <div class="month-grid">${st.monthly.map(m => `
      <div class="month-cell"><div class="month-name">${MONTHS_EN[m.month]}</div><div class="month-val">${m.units}</div><div style="font-size:7pt;color:#64748b">${m.events} events</div>
      <div class="meter"><i style="width:${pct(m.units, Math.max(1,...st.monthly.map(x=>x.units)))}%;background:#2563eb"></i></div>
      </div>`).join('')}</div></div>
    <div class="section"><h2>Quarterly Comparison ${y} vs ${priorY}</h2>
    ${renderSpikeLegend(spikeThresholdPct())}
    <table><thead><tr><th>Quarter</th><th>${y} units</th><th>${priorY} units</th><th>Change</th></tr></thead>
    <tbody>${st.quarterly.map(q => {
      const priorQ = priorSt.quarterly.find(p => p.q === q.q) || { units: 0 };
      const pc = pctChange(q.units, priorQ.units);
      const change = pc === null ? '—' : pc > 0 ? spikeBadge(pc, spikeThresholdPct()) : `<span style="color:#166534">${pc}%</span>`;
      return `<tr><td>Q${q.q}</td><td><b>${q.units}</b></td><td>${priorQ.units}</td><td>${change}</td></tr>`;
    }).join('')}</tbody></table></div>
    <div class="section"><h2>Top 10 Dispensed / أكثر 10 أدوية صرفًا</h2>
    <table><thead><tr><th>#</th><th>Medicine</th><th>Class</th><th>Units</th><th>Events</th><th>Share</th></tr></thead>
    <tbody>${st.topMeds.map((m, i) => `<tr><td>${i+1}</td><td><b>${esc(m.name)}</b></td><td>${esc(m.cls)}</td><td>${m.units}</td><td>${m.events}</td><td>${pct(m.units, st.totalUnits)}%</td></tr>`).join('')}</tbody>
    </table></div>
    <div class="section"><h2>Year vs Prior Year</h2>
    <table><thead><tr><th>Year</th><th>Events</th><th>Units</th><th>Inpatient</th><th>Outpatient</th></tr></thead>
    <tbody>
      <tr><td>${priorY}</td><td>${priorSt.moves}</td><td>${priorSt.totalUnits}</td><td>${pct(priorSt.inpatientUnits,priorSt.totalUnits)}%</td><td>${pct(priorSt.outpatientUnits,priorSt.totalUnits)}%</td></tr>
      <tr style="font-weight:bold"><td>${y}</td><td>${st.moves}</td><td>${st.totalUnits}</td><td>${pct(st.inpatientUnits,st.totalUnits)}%</td><td>${pct(st.outpatientUnits,st.totalUnits)}%</td></tr>
    </tbody></table></div>`;

  openPrintWindow('Narcotic Analytics', body);
}

/* ── RENDER: narcotic analytics (in its own tab) ────────────────────────── */
function render() {
  const host = document.getElementById('comprehensive-annual-report-host');
  if (!host || !permitted()) return;
  injectStyles();

  const y = currentYear();
  const years = [];
  for (let i = 2026; i <= y; i++) years.push(i);
  const selY = reportYear();

  host.innerHTML = `
    <div class="car-card">
      <div class="car-header">
        <div>
          <div class="car-title">💊 Narcotic &amp; Controlled Dispensing / إحصاءات المخدرات</div>
          <div class="car-sub">Master · Pharmacy Director · Inpatient Supervisor</div>
        </div>
        <div class="car-controls">
          <label style="font-size:12px">Year / السنة
            <select id="car-year">${years.map(v => `<option value="${v}"${v === selY ? ' selected' : ''}>${v}</option>`).join('')}</select>
          </label>
          <button class="btn bp bsm" id="car-narc-print">🖨 Print / طباعة</button>
        </div>
      </div>
      <div id="car-narc-body">${renderNarcoticSection()}</div>
      <div class="car-brand">${BRAND}</div>
    </div>
  `;

  const yearEl = document.getElementById('car-year');
  if (yearEl && !yearEl.dataset.bound) {
    yearEl.dataset.bound = '1';
    yearEl.addEventListener('change', () => {
      const body = document.getElementById('car-narc-body');
      if (body) body.innerHTML = renderNarcoticSection();
    });
  }
  const narcPrint = document.getElementById('car-narc-print');
  if (narcPrint && !narcPrint.dataset.bound) {
    narcPrint.dataset.bound = '1';
    narcPrint.addEventListener('click', printNarcoticReport);
  }
}

/* ── RENDER: crash cart analytics (dedicated tab) ───────────────────────── */
function renderCrash() {
  const host = document.getElementById('car-crash-host');
  if (!host || !permitted()) return;
  injectStyles();

  const y = currentYear();
  const years = [];
  for (let i = 2026; i <= y; i++) years.push(i);
  const fromY = reportYearFrom(), toY = reportYearTo();

  host.innerHTML = `
    <div class="car-card">
      <div class="car-header">
        <div>
          <div class="car-title">🚑 Crash Cart Analytics / إحصاءات عربات الطوارئ</div>
          <div class="car-sub">Master · Pharmacy Director · Inpatient Supervisor</div>
        </div>
        <div class="car-controls">
          <label style="font-size:12px">From / من
            <select id="car-year-from">${years.map(v => `<option value="${v}"${v === fromY ? ' selected' : ''}>${v}</option>`).join('')}</select>
          </label>
          <label style="font-size:12px">To / إلى
            <select id="car-year-to">${years.map(v => `<option value="${v}"${v === toY ? ' selected' : ''}>${v}</option>`).join('')}</select>
          </label>
          <button class="btn bp bsm" id="car-crash-print">🖨 Print / طباعة</button>
        </div>
      </div>
      <div id="car-crash-body">${renderCrashSection()}</div>
      <div class="car-brand">${BRAND}</div>
    </div>
  `;

  ['car-year-from','car-year-to'].forEach(id => {
    const el = document.getElementById(id);
    if (el && !el.dataset.bound) {
      el.dataset.bound = '1';
      el.addEventListener('change', () => {
        const body = document.getElementById('car-crash-body');
        if (body) body.innerHTML = renderCrashSection();
      });
    }
  });
  const crashPrint = document.getElementById('car-crash-print');
  if (crashPrint && !crashPrint.dataset.bound) {
    crashPrint.dataset.bound = '1';
    crashPrint.addEventListener('click', printCrashReport);
  }
}

/* ── TAB SWITCHING ──────────────────────────────────────────────────────── */
function activatePrintTab(tab) {
  const panels = {
    orders:      document.getElementById('pg-print-panel-orders'),
    analytics:   document.getElementById('pg-print-panel-analytics'),
    crashcart:   document.getElementById('pg-print-panel-crashcart'),
    drugs:       document.getElementById('pg-print-panel-drugs'),
    fulfillment: document.getElementById('pg-print-panel-fulfillment'),
  };
  const tabs = {
    orders:      document.getElementById('pg-print-tab-orders'),
    analytics:   document.getElementById('pg-print-tab-analytics'),
    crashcart:   document.getElementById('pg-print-tab-crashcart'),
    drugs:       document.getElementById('pg-print-tab-drugs'),
    fulfillment: document.getElementById('pg-print-tab-fulfillment'),
  };
  if (!panels.orders) return;

  // If requested tab is not allowed for this role, fall back to orders
  if (!tabAllowed(tab)) tab = 'orders';

  Object.keys(panels).forEach(k => {
    const p = panels[k], t = tabs[k];
    const allowed = tabAllowed(k);
    // Hide the tab button completely when not permitted for this role
    if (t) t.style.display = allowed ? '' : 'none';
    if (!p) return;
    const active = k === tab;
    p.style.display = active ? '' : 'none';
    if (t && allowed) {
      t.className = active ? 'btn bp bsm' : 'btn bg bsm';
      t.style.opacity = active ? '1' : '0.65';
      t.style.borderBottom = active ? '3px solid var(--ac)' : '';
    }
  });

  if (tab === 'analytics') setTimeout(render, 50);
  if (tab === 'crashcart') setTimeout(renderCrash, 50);
  if (tab === 'fulfillment') setTimeout(renderFulfillment, 50);

  // Header settings button is master-only
  const hdrBtn = document.getElementById('pg-print-header-settings-btn');
  if (hdrBtn) hdrBtn.style.display = isMaster() ? 'inline-flex' : 'none';
}

document.addEventListener('click', function (e) {
  if (e.target.closest('#pg-print-header-settings-btn')) {
    if (typeof window.openLogoSettings === 'function') window.openLogoSettings();
    return;
  }
  if (e.target.closest('#pg-print-tab-orders')) { activatePrintTab('orders'); return; }
  if (e.target.closest('#pg-print-tab-analytics')) { activatePrintTab('analytics'); return; }
  if (e.target.closest('#pg-print-tab-crashcart')) { activatePrintTab('crashcart'); return; }
  if (e.target.closest('#pg-print-tab-drugs')) { activatePrintTab('drugs'); return; }
  if (e.target.closest('#pg-print-tab-fulfillment')) { activatePrintTab('fulfillment'); return; }
  if (e.target.closest('#drug-analytics-print-trigger')) {
    if (typeof window.renderAnalyticsReports === 'function') window.renderAnalyticsReports();
    setTimeout(() => window.dispatchEvent(new CustomEvent('floorstock:analytics-print')), 300);
    return;
  }

  // Navigate-to-print-page triggers
  const trigger = e.target.closest('[data-pg="pg-print"],[data-showpg="pg-print"]') ||
    (e.target.closest('[onclick]') && String(e.target.closest('[onclick]').getAttribute('onclick') || '').includes('pg-print'));
  if (trigger) setTimeout(() => activatePrintTab('orders'), 150);
});

// Intercept pg-print navigation via a delegated listener on the nav (no showPg wrapper)
document.addEventListener('click', function (ev) {
  var btn = ev.target.closest('[data-pg="pg-print"]');
  if (btn) setTimeout(() => activatePrintTab('orders'), 100);
}, true);

// Render immediately if pg-print is already visible on load
if (document.getElementById('pg-print') && getComputedStyle(document.getElementById('pg-print')).display !== 'none') {
  setTimeout(() => activatePrintTab('orders'), 300);
}

})();

export {};
export {};
