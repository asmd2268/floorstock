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
  // Remove previous section so re-renders always reflect current dept list
  const old = root.querySelector('.r676-dept-print-section');
  if (old) old.remove();

  const depts = Object.entries(stats.departments || {})
    .sort((a, b) => b[1].units - a[1].units);
  if (!depts.length) return;

  // Store stats globally so onclick handlers can reach them
  window._r676DeptStats = stats.departments || {};

  const section = document.createElement('div');
  section.className = 'anl-section r676-dept-print-section';
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

export {};
