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
function permitted() {
  if (window.CU && window.CU.master) return true;
  const r = String(window.fsEffectiveRole ? window.fsEffectiveRole() : (window.CU && window.CU.role) || '');
  return ['pharmacy','inpatient_supervisor','inpatient_pharmacy_supervisor'].includes(r);
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
      <div class="car-kpi"><div class="car-kpi-label">Total openings / إجمالي الفتحات</div><div class="car-kpi-val">${st.totalOpenings}</div></div>
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
          <td><span class="car-badge blue">${pct(m.count, st.totalReplacements)}%</span></td>
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

  // Quarterly comparison (current vs prior year)
  html += `<div class="car-section">
    <div class="car-section-title">Quarterly comparison / المقارنة الربعية — ${y} vs ${priorY}</div>
    <div class="car-q-cmp">
      ${st.quarterly.map(q => {
        const priorQ = priorSt.quarterly.find(p => p.q === q.q) || { units: 0 };
        const pc = pctChange(q.units, priorQ.units);
        const color = pc === null ? '#64748b' : pc > 0 ? '#f59e0b' : '#10b981';
        return `<div class="car-q-item">
          <div style="font-size:12px;color:var(--cl-sub,#94a3b8)">Q${q.q} / الربع ${['','الأول','الثاني','الثالث','الرابع'][q.q]}</div>
          <div style="font-size:22px;font-weight:800;color:var(--cl-text,#f1f5f9);margin:4px 0">${q.units}</div>
          <div style="font-size:12px;color:${color}">${pc !== null ? (pc >= 0 ? '↑ +' : '↓ ') + Math.abs(pc) + '% vs ' + priorY + ' Q' + q.q : 'No prior data'}</div>
          <div style="font-size:11px;color:var(--cl-sub,#94a3b8)">${q.events} dispense events</div>
        </div>`;
      }).join('')}
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
@media print{button{display:none!important}.section{break-inside:avoid}}
`;

function openPrintWindow(title, bodyHtml) {
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
    <table><thead><tr><th>#</th><th>Medicine</th><th>Times replaced</th><th>Share</th><th>Top departments</th></tr></thead>
    <tbody>${st.topMeds.map((m, i) => {
      const topDepts = Object.entries(st.deptMedCounts[m.name] || {})
        .sort((a, b) => b[1] - a[1]).slice(0, 3)
        .map(([d, n]) => `${esc(d)}: ${n}`).join(', ');
      return `<tr><td>${i+1}</td><td><b>${esc(m.name)}</b></td><td>${m.count}</td><td>${pct(m.count, st.totalReplacements)}%</td><td>${topDepts || '—'}</td></tr>`;
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
    <table><thead><tr><th>Quarter</th><th>${y} units</th><th>${priorY} units</th><th>Change</th></tr></thead>
    <tbody>${st.quarterly.map(q => {
      const priorQ = priorSt.quarterly.find(p => p.q === q.q) || { units: 0 };
      const pc = pctChange(q.units, priorQ.units);
      return `<tr><td>Q${q.q}</td><td><b>${q.units}</b></td><td>${priorQ.units}</td><td style="color:${pc > 0 ? '#b45309' : pc < 0 ? '#166534' : ''}">${pc !== null ? (pc >= 0 ? '+' : '') + pc + '%' : '—'}</td></tr>`;
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

/* ── MAIN RENDER ────────────────────────────────────────────────────────── */
function render() {
  const host = document.getElementById('comprehensive-annual-report-host');
  if (!host || !permitted()) return;

  injectStyles();

  const y = currentYear();
  const years = [];
  for (let i = 2020; i <= y + 1; i++) years.push(i);
  const fromY = reportYearFrom(), toY = reportYearTo(), selY = reportYear();

  host.innerHTML = `
    <!-- CRASH CART ANALYTICS CARD -->
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

    <!-- NARCOTIC ANALYTICS CARD -->
    <div class="car-card">
      <div class="car-header">
        <div>
          <div class="car-title">💊 Narcotic & Controlled Dispensing / إحصاءات المخدرات</div>
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

  // Bind crash cart controls
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

  // Bind narcotic controls
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

// Render when the print page shows
document.addEventListener('click', function (e) {
  const trigger = e.target.closest('[data-pg="pg-print"],[onclick*="pg-print"],[data-showpg="pg-print"]') ||
    (e.target.closest('[onclick]') && String(e.target.closest('[onclick]').getAttribute('onclick') || '').includes('pg-print'));
  if (trigger) setTimeout(render, 150);
});

// Also render on showPg hook
const _origShowPg = window.showPg;
window.showPg = function (pg) {
  const r = typeof _origShowPg === 'function' ? _origShowPg(pg) : undefined;
  if (String(pg) === 'pg-print') setTimeout(render, 100);
  return r;
};

// Render immediately if pg-print is already visible
if (document.getElementById('pg-print') && getComputedStyle(document.getElementById('pg-print')).display !== 'none') {
  setTimeout(render, 300);
}

})();

export {};
