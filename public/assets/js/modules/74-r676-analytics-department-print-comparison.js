(function () {
'use strict';

function esc(v) { return window.fsEsc ? window.fsEsc(v) : String(v == null ? '' : v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

function attach(root, stats) {
  if (!root || root.dataset.r676DeptPrint) return;
  root.dataset.r676DeptPrint = '1';

  const depts = Object.entries(stats.departments || {})
    .sort((a, b) => b[1].units - a[1].units);
  if (!depts.length) return;

  const css = `
    @page{size:A4 portrait;margin:14mm 12mm 18mm}
    body{font:10pt Arial,sans-serif;color:#172033;background:#fff}
    h1{font-size:16pt;color:#102a5c;border-bottom:2px solid #2563eb;padding-bottom:6px;margin:0 0 10px}
    table{width:100%;border-collapse:collapse}
    th,td{border:1px solid #9aa8bd;padding:7px;text-align:left}
    th{background:#dbeafe;color:#102a5c}
    @media print{button{display:none!important}}
  `;

  const section = document.createElement('div');
  section.className = 'anl-section';
  section.innerHTML = `
    <div class="anl-section-title">Department print pages / طباعة تقارير الأقسام</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;padding:4px 0">
      ${depts.map(([name, d]) =>
        `<button type="button" class="btn bsm" data-dept="${esc(name)}">🖨 ${esc(name)}</button>`
      ).join('')}
    </div>
  `;

  section.querySelectorAll('button[data-dept]').forEach(btn => {
    btn.addEventListener('click', () => {
      const name = btn.dataset.dept;
      const d = stats.departments[name] || {};
      const html = `<h1>Department report — ${esc(name)}</h1>
        <table><thead><tr><th>Metric</th><th>Value</th></tr></thead>
        <tbody>
          <tr><td>Fulfilled orders</td><td>${d.orders || 0}</td></tr>
          <tr><td>Dispensed units</td><td>${d.units || 0}</td></tr>
          <tr><td>Zero-dispense requests</td><td>${d.zeroDispenseReqs || 0}</td></tr>
        </tbody></table>`;
      if (typeof window.fsOfficialPrint === 'function') {
        window.fsOfficialPrint({ title: `Dept report — ${name}`, html, css });
      } else {
        const w = window.open('', '_blank');
        if (!w) return;
        w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(name)}</title><style>${css}</style></head><body>${html}</body></html>`);
        w.document.close();
        w.print();
      }
    });
  });

  root.appendChild(section);
}

window.addEventListener('floorstock:analytics-rendered', function (e) {
  const d = e.detail || {};
  attach(d.root, d.stats || {});
});

})();

export {};
