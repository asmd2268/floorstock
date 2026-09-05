import { allRows, rowDate, deptLabel } from '../core/analytics-engine.js?v=ce89f4cd54';

(function () {
'use strict';

function esc(v) { return window.fsEsc ? window.fsEsc(v) : String(v == null ? '' : v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

function calcYear(y) {
  const out = {};
  allRows().forEach(r => {
    const d = rowDate(r);
    if (!d || d.getFullYear() !== y) return;
    const n = deptLabel(r.deptId);
    const q = (r.dispensed || []).reduce((a, x) => a + (Number(x.qty) || 0), 0);
    out[n] = (out[n] || 0) + q;
  });
  return out;
}

function attach(root) {
  if (!root || root.dataset.multiYearBound) return;
  root.dataset.multiYearBound = '1';

  const yearSet = {};
  allRows().forEach(r => { const d = rowDate(r); if (d) yearSet[d.getFullYear()] = 1; });
  const ys = Object.keys(yearSet).map(Number).sort((a, b) => a - b);
  if (ys.length < 2) return;

  const box = document.createElement('div');
  box.className = 'anl-section';
  box.innerHTML = `
    <div class="anl-section-title">Multi-year department comparison / مقارنة الأقسام متعددة السنوات</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:10px">
      <label style="font-size:13px">From / من
        <select id="ar-my-from" style="margin-right:4px">${ys.map(y => `<option value="${y}">${y}</option>`).join('')}</select>
      </label>
      <label style="font-size:13px">To / إلى
        <select id="ar-my-to" style="margin-right:4px">${ys.map((y, i) => `<option value="${y}"${i === ys.length - 1 ? ' selected' : ''}>${y}</option>`).join('')}</select>
      </label>
      <label style="font-size:13px">Highlight ≥
        <input id="ar-my-threshold" type="number" min="0" max="10000" value="30" style="width:70px;margin-right:4px">%
      </label>
      <button type="button" class="btn bsm" id="ar-my-print">🖨 Print</button>
    </div>
    <div style="overflow:auto" id="ar-my-table"></div>
  `;
  root.appendChild(box);

  function render() {
    let from = Number(box.querySelector('#ar-my-from').value);
    let to   = Number(box.querySelector('#ar-my-to').value);
    if (from > to) { const t = from; from = to; to = t; }
    const threshold = Math.max(0, Number(box.querySelector('#ar-my-threshold').value) || 0);
    const yearsIn = [];
    for (let y = from; y <= to && yearsIn.length < 20; y++) yearsIn.push(y);
    const maps = yearsIn.map(calcYear);
    const names = {};
    maps.forEach(m => Object.keys(m).forEach(n => { names[n] = 1; }));
    const ns = Object.keys(names).sort();

    let html = `<table class="anl-quarter-table"><thead><tr><th>Department / القسم</th>${yearsIn.map(y => `<th>${y}</th>`).join('')}<th>Average</th><th>Trend</th></tr></thead><tbody>`;
    ns.forEach(n => {
      const vals = maps.map(m => m[n] || 0);
      const first = vals[0] || 0, last = vals[vals.length - 1] || 0;
      const pct = first ? Math.round((last - first) / first * 1000) / 10 : null;
      const avg = vals.reduce((a, v) => a + v, 0) / vals.length;
      const flag = pct !== null && Math.abs(pct) >= threshold;
      const rowStyle = flag ? (pct > 0 ? 'color:#f59e0b' : 'color:#10b981') : '';
      const trendStr = pct === null ? '—' : (pct >= 0 ? `↑ +${pct}%` : `↓ ${pct}%`);
      html += `<tr><td><b>${esc(n)}</b></td>${vals.map(v => `<td style="${rowStyle}">${v}</td>`).join('')}<td>${Math.round(avg * 10) / 10}</td><td style="${rowStyle}">${trendStr}</td></tr>`;
    });
    box.querySelector('#ar-my-table').innerHTML = html + '</tbody></table>';
  }

  box.querySelectorAll('select,input').forEach(x => x.addEventListener('change', render));
  box.querySelector('#ar-my-print').addEventListener('click', () => {
    const tableEl = box.querySelector('#ar-my-table');
    const css = 'body{font:11pt Arial;padding:20px}table{width:100%;border-collapse:collapse}td,th{border:1px solid #9aa8bd;padding:7px}th{background:#dbeafe}.brand{text-align:right;font-size:8pt;color:#94a3b8;margin-top:8px}@media print{button{display:none!important}}';
    if (typeof window.fsOfficialPrint === 'function') {
      window.fsOfficialPrint({ title: 'Multi-year comparison', html: tableEl.outerHTML + '<div class="brand">By Ali Abudahash</div>', css });
    } else {
      const w = window.open('', '_blank');
      if (!w) return;
      w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Multi-year report</title><style>${css}</style></head><body>${tableEl.outerHTML}<div class="brand">By Ali Abudahash</div></body></html>`);
      w.document.close();
      w.print();
    }
  });

  render();
}

window.addEventListener('floorstock:analytics-rendered', function (e) {
  attach(e.detail && e.detail.root);
});

})();

export {};
