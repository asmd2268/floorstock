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
    .anl-empty{text-align:center;color:#94a3b8;padding:12px;font-size:9pt}
    .anl-zero-row{font-size:9pt;color:#475569;padding:4px 0;border-bottom:1px solid #e2e8f0}
    .arw{font-size:8pt;font-weight:700;padding:1px 5px;border-radius:4px}
    .arw.up{background:#fef3c7;color:#92400e}.arw.dn{background:#dcfce7;color:#166534}.arw.eq{background:#e2e8f0;color:#475569}
    .anl-controls{display:none!important}
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

export {};
