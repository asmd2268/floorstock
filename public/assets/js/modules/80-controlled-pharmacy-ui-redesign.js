/* R6.76.88 — Controlled Medicines: complete redesign (stock/cabinets/departments) + drug-list print fix */
(function(){
'use strict';

/* ══════════════════════════════════════════════════════════
   CSS
══════════════════════════════════════════════════════════ */
(function injectCss(){
  if(document.getElementById('ctl-redesign-css'))return;
  var s=document.createElement('style');s.id='ctl-redesign-css';
  s.textContent=`
/* ── PAGE SHELL ─────────────────────────────────────────── */
#pg-controlled{padding:0!important}
#pg-controlled>.stitle,
#pg-controlled>.ssub,
#pg-controlled>.fl.ic.jb.mb14{display:none!important}

/* ── HERO ────────────────────────────────────────────────── */
.ctl-hero{
  background:linear-gradient(135deg,var(--acl,#1f6feb) 0%,#1452b3 100%);
  border-radius:16px;padding:22px 24px 18px;margin-bottom:20px;
  color:#fff;display:flex;align-items:flex-start;
  justify-content:space-between;gap:16px;flex-wrap:wrap}
.ctl-hero-left{display:flex;flex-direction:column;gap:6px}
.ctl-hero-title{font-size:20px;font-weight:800;letter-spacing:-.3px;color:#fff}
.ctl-hero-sub{font-size:13px;opacity:.85;color:#fff;max-width:480px}
.ctl-hero-badge{display:inline-flex;align-items:center;gap:5px;padding:3px 10px;
  border-radius:20px;font-size:11px;font-weight:700;
  background:rgba(255,255,255,.2);color:#fff;
  border:1px solid rgba(255,255,255,.35);width:fit-content;margin-top:2px}
.ctl-hero-actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.ctl-hero-actions .btn{border-color:rgba(255,255,255,.4);color:#fff;background:rgba(255,255,255,.15)}
.ctl-hero-actions .btn:hover{background:rgba(255,255,255,.28)}
.ctl-hero-actions .btn.bp{background:rgba(255,255,255,.95);color:var(--acl,#1f6feb);border-color:transparent}
.ctl-hero-actions .btn.bp:hover{background:#fff}

/* ── TAB BAR ─────────────────────────────────────────────── */
#ctl-tabs{margin-bottom:20px}
.ctl-tab-row{display:flex;gap:4px;padding:4px;background:var(--s2);
  border:1px solid var(--bd);border-radius:14px;
  width:fit-content;max-width:100%;flex-wrap:wrap}
.ctl-tab{display:flex;align-items:center;gap:7px;padding:9px 18px;
  border-radius:10px;border:none;background:transparent;
  color:var(--tx2);cursor:pointer;font-size:13.5px;font-weight:500;
  transition:background .14s,color .14s;white-space:nowrap}
.ctl-tab:hover{background:var(--s3,rgba(0,0,0,.06));color:var(--tx1)}
.ctl-tab.active{background:var(--acl,#1f6feb);color:#fff;font-weight:600;
  box-shadow:0 2px 8px rgba(31,111,235,.22)}
.ctl-tab-icon{font-size:16px;line-height:1}

/* ── STAT CARDS ──────────────────────────────────────────── */
.ctl-stat-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));
  gap:12px;margin-bottom:20px}
.ctl-stat-card{background:var(--s2);border:1px solid var(--bd);border-radius:14px;
  padding:16px;display:flex;flex-direction:column;gap:5px}
.ctl-stat-card-icon{font-size:22px;line-height:1}
.ctl-stat-card-label{font-size:11px;color:var(--tx2);font-weight:600;
  text-transform:uppercase;letter-spacing:.6px}
.ctl-stat-card-value{font-size:28px;font-weight:800;color:var(--tx1);
  font-family:var(--mono,'monospace');line-height:1}
.ctl-stat-card.alert .ctl-stat-card-value{color:var(--rdl,#f85149)}
.ctl-stat-card.warn  .ctl-stat-card-value{color:var(--yll,#e3b341)}
.ctl-stat-card.ok    .ctl-stat-card-value{color:var(--gn,#3fb950)}

/* ══════════════════════════════════════════════════════════
   STOCK / OVERVIEW VIEW
══════════════════════════════════════════════════════════ */
#ctl-overview-view .stitle,
#ctl-overview-view .ssub{display:none!important}

/* filter toolbar polished */
.ctl-clean-toolbar{
  display:flex!important;flex-wrap:wrap;gap:6px;align-items:center;
  padding:10px 12px;background:var(--s2);border-radius:10px;
  border:1px solid var(--bd);margin-top:10px}
.ctl-clean-toolbar input,.ctl-clean-toolbar select{margin:0!important}

/* Stock table */
#ctl-overview-view table{border-collapse:collapse;width:100%}
#ctl-overview-view thead th{
  background:var(--s2);font-size:11px;font-weight:700;
  text-transform:uppercase;letter-spacing:.5px;
  border-bottom:2px solid var(--bd);padding:9px 10px;
  white-space:nowrap;color:var(--tx2)}
#ctl-overview-view tbody td{padding:8px 10px;vertical-align:middle;
  border-bottom:1px solid var(--bd)}
#ctl-overview-view tbody tr:last-child td{border-bottom:none}
#ctl-overview-view tbody tr:hover td{background:var(--s2)!important}

/* Narcotic — amber left stripe */
#ctl-overview-view tbody tr[data-classification="narcotic"]{
  background:rgba(218,122,42,.025)}
#ctl-overview-view tbody tr[data-classification="narcotic"] td:first-child{
  border-left:4px solid #da7a2a!important}
/* Psychotropic — violet left stripe */
#ctl-overview-view tbody tr[data-classification="psychotropic"]{
  background:rgba(124,58,237,.025)}
#ctl-overview-view tbody tr[data-classification="psychotropic"] td:first-child{
  border-left:4px solid #7c3aed!important}

/* action buttons compact */
.ctl-clean-actions{display:flex;gap:4px;flex-wrap:wrap}
.ctl-clean-actions .btn{padding:4px 8px;font-size:11.5px}

/* classification chips in overview */
#ctl-overview-view>.fl.g8:first-of-type .chip,
#ctl-overview-view .fl.g8:first-of-type .chip{
  padding:6px 14px;border-radius:20px;font-size:12.5px;font-weight:600}

/* ══════════════════════════════════════════════════════════
   DEPARTMENTS VIEW
══════════════════════════════════════════════════════════ */
/* card header accent */
#ctl-departments-view .card:first-child>.ch{
  background:linear-gradient(90deg,var(--s2) 0%,rgba(31,111,235,.05) 100%);
  border-radius:10px 10px 0 0;padding:14px 16px}
#ctl-departments-view .card:first-child>.ch>.ct{font-size:14px;font-weight:700}

/* dept table */
#ctl-departments-view table{border-collapse:collapse;width:100%}
#ctl-departments-view thead th{
  background:var(--s2);font-size:11px;font-weight:700;
  text-transform:uppercase;letter-spacing:.5px;
  border-bottom:2px solid var(--bd);padding:8px 9px;
  white-space:nowrap;color:var(--tx2)}
#ctl-departments-view tbody td{padding:7px 9px;vertical-align:middle;
  border-bottom:1px solid var(--bd)}
#ctl-departments-view tbody tr:hover td{background:var(--s2)}

/* Row classification stripes */
#ctl-departments-view tbody tr[data-classification="narcotic"]{
  background:rgba(218,122,42,.025)}
#ctl-departments-view tbody tr[data-classification="narcotic"] td:nth-child(2){
  border-left:3px solid #da7a2a!important}
#ctl-departments-view tbody tr[data-classification="psychotropic"]{
  background:rgba(124,58,237,.025)}
#ctl-departments-view tbody tr[data-classification="psychotropic"] td:nth-child(2){
  border-left:3px solid #7c3aed!important}

/* qty colouring */
.ctl-qty-cell{font-family:var(--mono,'monospace')!important;font-weight:700!important}
#ctl-departments-view tbody tr.qty-low .ctl-qty-cell{color:var(--rdl,#f85149)!important}
#ctl-departments-view tbody tr.qty-warn .ctl-qty-cell{color:var(--yll,#e3b341)!important}

/* shelf badge */
.shelf-badge{background:var(--s2);border:1px solid var(--bd);
  padding:2px 8px;border-radius:20px;font-size:11px;font-weight:600;color:var(--tx2)}

/* Movements log card */
#ctl-departments-view .card:last-child{margin-top:16px}

/* ══════════════════════════════════════════════════════════
   STORAGE / CABINETS VIEW
══════════════════════════════════════════════════════════ */
#ctl-storage-view>.fl.ic.jb.mb14 .stitle,
#ctl-storage-view>.fl.ic.jb.mb14 .ssub{display:none!important}

/* Summary strip */
#controlled-storage-summary{
  display:flex;flex-wrap:wrap;gap:8px;align-items:center;
  padding:0 0 14px;margin-bottom:0}
#controlled-storage-summary>span:first-child{
  font-weight:700;font-size:14px;color:var(--tx1);margin-inline-end:auto}
#controlled-storage-summary .chip{padding:4px 12px;border-radius:20px;font-size:12px;font-weight:600}

/* Cabinet unit card */
.r17-unit{
  background:var(--s1,var(--bg));border:1px solid var(--bd);
  border-radius:14px;margin-bottom:20px;overflow:hidden}
.r17-unit-head{
  display:flex;align-items:center;justify-content:space-between;
  flex-wrap:wrap;gap:8px;padding:14px 18px;
  background:linear-gradient(90deg,var(--s2) 0%,rgba(31,111,235,.06) 100%);
  border-bottom:1px solid var(--bd)}
.r21-storage-unit-meta{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.r21-storage-unit-meta b{font-size:15px;font-weight:700;color:var(--tx1)}
.r21-storage-unit-actions{display:flex;gap:6px;flex-wrap:wrap}
.r21-storage-unit-actions .btn{padding:5px 10px;font-size:12px}

/* Shelf rows */
.r17-storage-row{
  display:grid;gap:10px;padding:14px 16px;border-bottom:1px solid var(--bd)}
.r17-storage-row:last-child{border-bottom:none}

/* Individual cell */
.r17-cell{
  border:1.5px solid var(--bd);border-radius:10px;
  padding:10px;background:var(--s2);
  transition:border-color .15s,box-shadow .15s;
  display:flex;flex-direction:column;gap:6px;min-height:82px}
.r17-cell:hover{border-color:var(--acl,#1f6feb);
  box-shadow:0 0 0 2px rgba(31,111,235,.12)}
.r17-cell-code{font-size:10px;font-weight:800;color:var(--tx2);
  text-transform:uppercase;letter-spacing:.8px}
.r21-storage-cell-assigned{
  background:var(--s1,var(--bg))!important;
  border-color:var(--acl,#1f6feb)!important;
  box-shadow:0 0 0 1.5px rgba(31,111,235,.2)!important}
.r21-storage-cell-assigned .r17-cell-code{color:var(--acl,#1f6feb)}
.controlled-storage-med-search{width:100%!important;font-size:12px!important;margin:0!important}

/* Near-expiry & unassigned cards */
.r21-storage-unassigned-list{display:flex;flex-wrap:wrap;gap:8px;padding:4px 0}

/* ══════════════════════════════════════════════════════════
   ANALYTICS INLINE
══════════════════════════════════════════════════════════ */
#ctl-analytics-view{display:none}
.ctl-an-shell{display:flex;flex-direction:column;gap:20px}
.ctl-an-sub-tabs{display:flex;gap:4px;padding:4px;background:var(--s2);
  border:1px solid var(--bd);border-radius:12px;width:fit-content;flex-wrap:wrap}
.ctl-an-sub-tab{padding:7px 14px;border-radius:8px;border:none;
  background:transparent;color:var(--tx2);cursor:pointer;
  font-size:13px;font-weight:500;transition:background .14s,color .14s;white-space:nowrap}
.ctl-an-sub-tab.active{background:var(--acl,#1f6feb);color:#fff;font-weight:600}
.ctl-an-sub-tab:hover:not(.active){background:var(--s3,rgba(0,0,0,.06));color:var(--tx1)}
.ctl-an-panel{display:none}
.ctl-an-panel.active{display:block}
.ctl-an-filters{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:16px}
.ctl-an-filters input,.ctl-an-filters select{margin:0}
.ctl-an-stats-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));
  gap:10px;margin-bottom:16px}
.ctl-an-sc{background:var(--s2);border:1px solid var(--bd);border-radius:12px;padding:14px}
.ctl-an-sl{font-size:10.5px;color:var(--tx2);text-transform:uppercase;
  letter-spacing:.5px;font-weight:600;margin-bottom:4px}
.ctl-an-sv{font-size:24px;font-weight:800;font-family:var(--mono,'monospace');color:var(--tx1)}
.ctl-cmp-section{margin-bottom:20px}
.ctl-cmp-section-title{font-size:14px;font-weight:700;margin-bottom:8px;
  color:var(--tx1);display:flex;align-items:center;gap:6px}
.ctl-cmp-table{width:100%;border-collapse:collapse;font-size:13px}
.ctl-cmp-table th{background:var(--s2);border:1px solid var(--bd);
  padding:8px 10px;font-weight:700;font-size:12px;text-align:left}
.ctl-cmp-table td{border:1px solid var(--bd);padding:7px 10px;vertical-align:middle}
.ctl-cmp-table tr:nth-child(even) td{background:var(--s2)}
.ctl-cmp-up{color:var(--gn,#3fb950);font-weight:700}
.ctl-cmp-down{color:var(--rdl,#f85149);font-weight:700}
.ctl-cmp-flat{color:var(--tx2)}
.ctl-period-sel{display:flex;gap:8px;flex-wrap:wrap;align-items:center;
  margin-bottom:14px;padding:12px;background:var(--s2);
  border:1px solid var(--bd);border-radius:10px}
.ctl-period-sel label{font-size:12.5px;color:var(--tx2);margin:0}
.ctl-period-sel select,.ctl-period-sel input{margin:0;width:auto}
  `;
  document.head.appendChild(s);
})();

/* ══════════════════════════════════════════════════════════
   BOOT
══════════════════════════════════════════════════════════ */
/* Print patch: only needs window.doDeptPrint (openBlobPrint is a closure-private local) */
var _printAttempts=0;
function tryPatchPrint(){
  if(window.doDeptPrint){patchPrintFunctions();return;}
  if(++_printAttempts<120)setTimeout(tryPatchPrint,250);
}
tryPatchPrint();

var _attempts=0;
function tryPatch(){
  if(!window.ctlTabs||!window.renderControlled){if(++_attempts<80)setTimeout(tryPatch,250);return;}
  injectHero();
  patchCtlTabs();
  patchRenderControlled();
  ensureAnalyticsDiv();
}
tryPatch();
/* Dept patch needs renderCtlDepartments from module 07 — retry separately */
var _deptAttempts=0;
function tryDeptPatch(){
  if(typeof window.renderCtlDepartments!=='function'||window.renderCtlDepartments.__r688Wrapped){
    if(!window.renderCtlDepartments&&++_deptAttempts<80)setTimeout(tryDeptPatch,400);return;}
  patchRenderCtlDepartments();
}
setTimeout(tryDeptPatch,600);

/* ══════════════════════════════════════════════════════════
   HERO
══════════════════════════════════════════════════════════ */
function injectHero(){
  if(document.getElementById('ctl-hero-wrap'))return;
  var pg=document.getElementById('pg-controlled');if(!pg)return;
  var role=typeof window.fsEffectiveRole==='function'?window.fsEffectiveRole():String((window.CU&&window.CU.role)||'');
  var roleLabel=role==='controlled_pharmacy'?'🔒 Controlled Medicines Officer':role==='warehouse'?'📦 Warehouse':'👤 Department';
  var div=document.createElement('div');div.id='ctl-hero-wrap';
  div.innerHTML=
    '<div class="ctl-hero">'+
      '<div class="ctl-hero-left">'+
        '<div class="ctl-hero-title">💊 Controlled Medicines / الأدوية المخدرة والمقيدة</div>'+
        '<div class="ctl-hero-sub">Unified pharmacy custody, warehouse stock and inpatient department dispensing</div>'+
        '<div class="ctl-hero-badge">'+roleLabel+'</div>'+
      '</div>'+
      '<div class="ctl-hero-actions" id="ctl-hero-btn-row"></div>'+
    '</div>';
  pg.insertBefore(div,pg.firstChild);
}

/* ══════════════════════════════════════════════════════════
   TABS
══════════════════════════════════════════════════════════ */
function getTabDefs(){
  var role=typeof window.fsEffectiveRole==='function'?window.fsEffectiveRole():String((window.CU&&window.CU.role)||'');
  if(role==='department')return[['departments','🏥','My Controlled List / عهدتي']];
  if(role==='warehouse')return[['overview','💊','Stock / المخزون']];
  var tabs=[['overview','💊','Stock / المخزون']];
  if(typeof window.canControlledPharmacyStorage==='function'&&window.canControlledPharmacyStorage())
    tabs.push(['storage','🗄️','Cabinets / الدواليب']);
  tabs.push(['departments','🏥','Departments / الأقسام']);
  tabs.push(['analytics','📊','Analytics / التحليلات']);
  return tabs;
}

function patchCtlTabs(){
  window.ctlTabs=function(){
    var root=document.getElementById('ctl-tabs');if(!root||!window.CU)return;
    var tabs=getTabDefs();
    var view=window.CTL_VIEW||'overview';
    if(!tabs.some(function(t){return t[0]===view;}))view=tabs[0][0];
    window.CTL_VIEW=view;
    root.innerHTML='<div class="ctl-tab-row">'+
      tabs.map(function(t){
        return'<button type="button" class="ctl-tab'+(view===t[0]?' active':'')+'" data-view="'+t[0]+'">'+
          '<span class="ctl-tab-icon">'+t[1]+'</span><span>'+t[2]+'</span></button>';
      }).join('')+'</div>';
    root.querySelectorAll('.ctl-tab').forEach(function(btn){
      btn.onclick=function(){window.ctlSetView(btn.dataset.view);};
    });
    syncHeroBtns();
  };
  window.ctlSetView=function(v){window.CTL_VIEW=v;return window.renderControlled();};
}

function syncHeroBtns(){
  var row=document.getElementById('ctl-hero-btn-row');if(!row)return;
  var view=window.CTL_VIEW||'overview';
  var role=typeof window.fsEffectiveRole==='function'?window.fsEffectiveRole():String((window.CU&&window.CU.role)||'');
  var btns='';
  if(view==='departments'&&role!=='warehouse')
    btns+='<button class="btn bp" onclick="ctlOpenDepartmentPrintOptions()">🖨 Print custody</button>';
  if(view==='overview'&&(role==='controlled_pharmacy'||typeof window.isMaster==='function'&&window.isMaster()))
    btns+='<button class="btn bg bsm" onclick="ctlAddCatalogMedicine()">+ Add medicine</button>';
  if(view==='overview'&&(role==='controlled_pharmacy'||typeof window.isMaster==='function'&&window.isMaster())&&typeof window.ctlOpenHijriLedger==='function')
    btns+='<button class="btn bg bsm" onclick="ctlOpenHijriLedger()">📜 Hijri Ledger / السجل الهجري</button>';
  if(view==='overview'&&(role==='controlled_pharmacy'||typeof window.isMaster==='function'&&window.isMaster())&&typeof window.ctlOpenCustodyHandover==='function')
    btns+='<button class="btn bg bsm" onclick="ctlOpenCustodyHandover()">🧾 Handover / محضر تسليم</button>';
  if(view==='analytics')
    btns+='<button class="btn bg bsm" onclick="ctlAnPrint()">🖨 Print analytics</button>';
  row.innerHTML=btns;
}

/* ══════════════════════════════════════════════════════════
   ANALYTICS CONTAINER
══════════════════════════════════════════════════════════ */
function ensureAnalyticsDiv(){
  if(document.getElementById('ctl-analytics-view'))return;
  var pg=document.getElementById('pg-controlled');if(!pg)return;
  var div=document.createElement('div');div.id='ctl-analytics-view';pg.appendChild(div);
}

/* ══════════════════════════════════════════════════════════
   STAT CARDS
══════════════════════════════════════════════════════════ */
function buildStatCards(cat,wh,ph){
  var narcCount=cat.filter(function(m){return String(m.classification||'narcotic')!=='psychotropic'}).length;
  var psyCount=cat.filter(function(m){return String(m.classification||'narcotic')==='psychotropic'}).length;
  var alertCount=0,expiredCount=0,soonCount=0;
  var now=new Date().toISOString().slice(0,10);
  function addDays(iso,n){var d=new Date(iso);d.setDate(d.getDate()+n);return d.toISOString().slice(0,10)}
  var soon30=addDays(now,30);
  cat.forEach(function(m){
    var w=wh[m.id]||{},p=ph[m.id]||{};
    if(typeof window.ctlStatus==='function'){var st=window.ctlStatus(m,w,p);if(st&&st.key&&st.key!=='ok')alertCount++;}
    (p.batches||[]).concat(w.batches||[]).forEach(function(b){
      if(!b.expiry)return;var d=b.expiry.slice(0,10);
      if(d<now)expiredCount++;else if(d<soon30)soonCount++;
    });
  });
  return'<div class="ctl-stat-row">'+
    _sc('💊','Narcotic & Restricted',narcCount,'')+
    _sc('🧠','Psychotropics',psyCount,'')+
    _sc(alertCount?'⚠️':'✅','Stock Alerts',alertCount,alertCount?'alert':'ok')+
    _sc(expiredCount?'🔴':soonCount?'🟡':'🟢','Expiry Issues',expiredCount+soonCount,expiredCount?'alert':soonCount?'warn':'ok')+
  '</div>';
}
function _sc(icon,label,val,cls){
  return'<div class="ctl-stat-card'+(cls?' '+cls:'')+'">'+
    '<div class="ctl-stat-card-icon">'+icon+'</div>'+
    '<div class="ctl-stat-card-label">'+label+'</div>'+
    '<div class="ctl-stat-card-value">'+val+'</div></div>';
}

/* ══════════════════════════════════════════════════════════
   PATCH renderControlled
══════════════════════════════════════════════════════════ */
function patchRenderControlled(){
  var _orig=window.renderControlled;
  window.renderControlled=function(){
    if(window.CTL_VIEW==='analytics'){
      ['ctl-overview-view','ctl-departments-view','ctl-storage-view'].forEach(function(id){
        var el=document.getElementById(id);if(el)el.style.display='none';
      });
      ['ctl-pdf-receipt-card','ctl-permission-note','ctl-main-print-btn'].forEach(function(id){
        var el=document.getElementById(id);if(el)el.style.display='none';
      });
      window.ctlTabs();
      ensureAnalyticsDiv();
      var av=document.getElementById('ctl-analytics-view');
      if(av){av.style.display='block';renderAnalyticsInline(av);}
      return;
    }
    var av=document.getElementById('ctl-analytics-view');
    if(av)av.style.display='none';
    var result=_orig.apply(this,arguments);
    var old=document.getElementById('ctl-overview-stat-cards');if(old)old.remove();
    if(window.CTL_VIEW==='overview'||!window.CTL_VIEW){
      setTimeout(function(){
        var ov=document.getElementById('ctl-overview-view');
        if(!ov||document.getElementById('ctl-overview-stat-cards'))return;
        var cat=typeof ctlCatalog==='function'?(ctlCatalog()||[]):[];
        var wh=typeof ctlWarehouse==='function'?(ctlWarehouse()||{}):{};
        var ph=typeof ctlPharmacy==='function'?(ctlPharmacy()||{}):{};
        var wrap=document.createElement('div');wrap.id='ctl-overview-stat-cards';
        wrap.innerHTML=buildStatCards(cat,wh,ph);
        ov.insertBefore(wrap,ov.firstChild);
      },0);
    }
    syncHeroBtns();
    return result;
  };
}

/* ══════════════════════════════════════════════════════════
   PATCH renderCtlDepartments — add data-classification to rows
══════════════════════════════════════════════════════════ */
function patchRenderCtlDepartments(){
  var _origDept=window.renderCtlDepartments;
  window.renderCtlDepartments=function(){
    var result=_origDept.apply(this,arguments);
    setTimeout(function(){
      var tbody=document.getElementById('ctl-dept-table');if(!tbody)return;
      var dept=typeof window.ctlCurrentDept==='function'?window.ctlCurrentDept():'';
      var list=typeof window.ctlDeptList==='function'?window.ctlDeptList(dept):[];
      var rows=Array.from(tbody.querySelectorAll('tr'));
      rows.forEach(function(tr,i){
        var entry=list[i];if(!entry)return;
        var m=typeof window.ctlMedicine==='function'?(window.ctlMedicine(entry.medId)||{}):{};
        tr.dataset.classification=String(m.classification||'narcotic');
        var qty=Number(entry.qty);var min=Number(entry.min!=null?entry.min:m.min)||0;
        var tds=tr.querySelectorAll('td');
        /* 10th td (index 9) = Current qty column */
        if(tds[9])tds[9].className='ctl-qty-cell';
        tr.classList.remove('qty-low','qty-warn');
        if(isFinite(qty)&&qty===0)tr.classList.add('qty-low');
        else if(isFinite(qty)&&min>0&&qty<min)tr.classList.add('qty-warn');
      });
    },0);
    return result;
  };
  window.renderCtlDepartments.__r688Wrapped=true;
}

/* ══════════════════════════════════════════════════════════
   PRINT FIX — pre-open popup before await breaks gesture
══════════════════════════════════════════════════════════ */
var __preOpenedPW=null;

function patchPrintFunctions(){
  /* Pre-open the popup synchronously (before the async doDeptPrint breaks the gesture).
     Module 07's local openBlobPrint reads window.__preOpenedPW to reuse this window. */
  var _origDeptPrint=window.doDeptPrint;
  if(!_origDeptPrint||_origDeptPrint.__r689Wrapped)return;
  window.doDeptPrint=function(){
    window.__preOpenedPW=window.open('about:blank','_blank','width=1200,height=880');
    if(!window.__preOpenedPW){
      window.toast&&window.toast('السماح بالنوافذ المنبثقة مطلوب للطباعة / Allow pop-ups to print','err');
      return Promise.resolve(false);
    }
    try{
      window.__preOpenedPW.document.write(
        '<html><body style="font-family:Arial,Tahoma,sans-serif;text-align:center;padding:60px 40px;color:#666">'+
        '<div style="font-size:40px;margin-bottom:14px">💊</div>'+
        '<h3 style="margin:0 0 8px;color:#333">Preparing drug list…</h3>'+
        '<p style="font-size:13px;color:#888">جاري تحضير قائمة الأدوية</p></body></html>');
    }catch(e){}
    return _origDeptPrint.apply(this,arguments);
  };
  window.doDeptPrint.__r689Wrapped=true;
}

/* ══════════════════════════════════════════════════════════
   ANALYTICS INLINE
══════════════════════════════════════════════════════════ */
function renderAnalyticsInline(container){
  if(container.dataset.rendered==='1'){_applyFilters(container);return;}
  container.dataset.rendered='1';
  var esc=typeof window.esc==='function'?window.esc:function(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]});};
  var depts=(typeof gd==='function'?gd():[]).map(function(d){return'<option value="'+esc(d.id)+'">'+esc(d.name)+'</option>'}).join('');
  container.innerHTML=
    '<div class="ctl-an-shell">'+
      '<div class="ctl-an-sub-tabs">'+
        '<button type="button" class="ctl-an-sub-tab active" data-antab="records">📋 Dispensing Records</button>'+
        '<button type="button" class="ctl-an-sub-tab" data-antab="compare">📈 Department Comparison / مقارنة الأقسام</button>'+
      '</div>'+
      '<div id="ctl-an-panel-records" class="ctl-an-panel active">'+
        '<div class="ctl-an-filters">'+
          '<input id="ctl-ani-from" type="date" style="width:145px">'+
          '<input id="ctl-ani-to" type="date" style="width:145px">'+
          '<select class="psel" id="ctl-ani-type"><option value="">All types</option><option value="inpatient">Inpatient</option><option value="outpatient">Outpatient</option></select>'+
          '<select class="psel" id="ctl-ani-dept"><option value="">All departments</option>'+depts+'</select>'+
          '<input id="ctl-ani-rec" placeholder="Recipient name" style="width:170px">'+
          '<button class="btn bp" onclick="ctlAnApply()">Apply</button>'+
          '<button class="btn bg bsm" onclick="ctlAnPrint()">🖨 Print</button>'+
        '</div>'+
        '<div id="ctl-ani-stats" class="ctl-an-stats-row"></div>'+
        '<div class="card" style="margin:0"><div class="tw"><table>'+
          '<thead><tr><th>Date</th><th>Medicine</th><th>Qty</th><th>Source</th><th>Type</th><th>Department</th><th>Recipient</th><th>By</th></tr></thead>'+
          '<tbody id="ctl-ani-table"></tbody></table></div></div>'+
      '</div>'+
      '<div id="ctl-an-panel-compare" class="ctl-an-panel">'+
        '<div class="ctl-period-sel">'+
          '<label>Department</label>'+
          '<select id="ctl-cmp-dept"><option value="">All departments</option>'+depts+'</select>'+
          '<label>Year A</label>'+
          '<select id="ctl-cmp-year-a">'+_yearOptions(0)+'</select>'+
          '<label>Year B</label>'+
          '<select id="ctl-cmp-year-b">'+_yearOptions(-1)+'</select>'+
          '<button class="btn bp" onclick="ctlCmpApply()">Compare / قارن</button>'+
          '<button class="btn bg bsm" onclick="ctlCmpPrint()">🖨 Print</button>'+
        '</div>'+
        '<div id="ctl-cmp-result"></div>'+
      '</div>'+
    '</div>';
  container.querySelectorAll('.ctl-an-sub-tab').forEach(function(btn){
    btn.onclick=function(){
      container.querySelectorAll('.ctl-an-sub-tab').forEach(function(b){b.classList.remove('active');});
      container.querySelectorAll('.ctl-an-panel').forEach(function(p){p.classList.remove('active');});
      btn.classList.add('active');
      var panel=document.getElementById('ctl-an-panel-'+btn.dataset.antab);
      if(panel)panel.classList.add('active');
    };
  });
  ['ctl-ani-from','ctl-ani-to','ctl-ani-type','ctl-ani-dept','ctl-ani-rec'].forEach(function(id){
    var el=document.getElementById(id);if(!el)return;
    el.addEventListener(id==='ctl-ani-type'||id==='ctl-ani-dept'?'change':'input',function(){_applyFilters(container);});
  });
  _applyFilters(container);
  _applyComparison(container);
}

function _yearOptions(offset){
  var y=new Date().getFullYear()+offset,opts='';
  for(var i=0;i<5;i++)opts+='<option value="'+(y-i)+'">'+(y-i)+'</option>';
  return opts;
}

function _applyFilters(container){
  function q(id){return((container.querySelector('#'+id)||{}).value||'');}
  var from=q('ctl-ani-from'),to=q('ctl-ani-to'),type=q('ctl-ani-type'),dept=q('ctl-ani-dept'),rec=q('ctl-ani-rec').toLowerCase();
  var moves=typeof ctlMoves==='function'?ctlMoves():[];
  var rows=moves.filter(function(x){
    if(x.type!=='dispense')return false;
    var d=String(x.at||'').slice(0,10);
    return(!from||d>=from)&&(!to||d<=to)&&(!type||x.dispenseType===type)&&(!dept||x.dept===dept)&&(!rec||String(x.recipient||'').toLowerCase().indexOf(rec)>=0);
  });
  var total=rows.reduce(function(s,x){var n=Number(x.qty);return s+(isFinite(n)?n:0);},0);
  var rCount=new Set(rows.map(function(x){return x.recipient;}).filter(Boolean)).size;
  var dCount=new Set(rows.map(function(x){return x.dept;}).filter(Boolean)).size;
  var statsEl=container.querySelector('#ctl-ani-stats');
  if(statsEl)statsEl.innerHTML=_aSc('Transactions',rows.length)+_aSc('Total qty',total)+_aSc('Recipients',rCount)+_aSc('Departments',dCount);
  var fmtDT=typeof fmtDateTime==='function'?fmtDateTime:function(v){return String(v||'').slice(0,16).replace('T',' ');};
  var ctlMed=typeof ctlMedicine==='function'?ctlMedicine:function(){return{};};
  var esc=typeof window.esc==='function'?window.esc:function(v){return String(v==null?'':v);};
  var tbody=container.querySelector('#ctl-ani-table');
  if(tbody)tbody.innerHTML=rows.slice().reverse().map(function(x){
    var m=ctlMed(x.medId)||{};
    return'<tr><td>'+fmtDT(x.at)+'</td><td><b>'+esc(m.name||x.medId||'')+'</b></td>'+
      '<td style="font-family:var(--mono)">'+Number(x.qty||0)+'</td>'+
      '<td>'+esc(x.source||'')+'</td><td>'+esc(x.dispenseType||'')+'</td>'+
      '<td>'+esc(x.deptName||'—')+'</td><td>'+esc(x.recipient||'')+'</td><td>'+esc(x.by||'')+'</td></tr>';
  }).join('')||'<tr><td colspan="8" style="text-align:center;padding:24px;color:var(--tx2)">No matching records</td></tr>';
}
function _aSc(label,val){return'<div class="ctl-an-sc"><div class="ctl-an-sl">'+label+'</div><div class="ctl-an-sv">'+val+'</div></div>';}

function _applyComparison(container){
  function q(id){return((container.querySelector('#'+id)||{}).value||'');}
  var dept=q('ctl-cmp-dept'),yearA=Number(q('ctl-cmp-year-a')||new Date().getFullYear()),yearB=Number(q('ctl-cmp-year-b')||new Date().getFullYear()-1);
  var moves=typeof ctlMoves==='function'?ctlMoves():[];
  var ctlMed=typeof ctlMedicine==='function'?ctlMedicine:function(){return{};};
  var esc=typeof window.esc==='function'?window.esc:function(v){return String(v==null?'':v);};
  function qtrs(year){
    var out={};
    moves.filter(function(x){
      return x.type==='dispense'&&new Date(x.at||'').getFullYear()===year&&(!dept||x.dept===dept);
    }).forEach(function(x){
      var q=Math.floor(new Date(x.at||'').getMonth()/3);
      var m=ctlMed(x.medId)||{};
      if(!out[x.medId])out[x.medId]={name:esc(m.name||x.medId||''),q:[0,0,0,0]};
      out[x.medId].q[q]+=Number(x.qty)||0;
    });
    return out;
  }
  var dataA=qtrs(yearA),dataB=qtrs(yearB);
  var allIds=Object.keys(Object.assign({},dataA,dataB));
  if(!allIds.length){
    var res=container.querySelector('#ctl-cmp-result');
    if(res)res.innerHTML='<div class="alert-banner" style="margin-top:0">No dispensing records found for the selected period.</div>';
    return;
  }
  var QUARTERS=['Q1','Q2','Q3','Q4'],totalA=[0,0,0,0],totalB=[0,0,0,0];
  var rows=allIds.map(function(id){
    var a=dataA[id]||{name:esc((ctlMed(id)||{}).name||id),q:[0,0,0,0]};
    var b=dataB[id]||{name:esc((ctlMed(id)||{}).name||id),q:[0,0,0,0]};
    var sumA=a.q.reduce(function(s,v){return s+v;},0),sumB=b.q.reduce(function(s,v){return s+v;},0);
    for(var i=0;i<4;i++){totalA[i]+=a.q[i];totalB[i]+=b.q[i];}
    return{id:id,name:a.name||b.name,a:a.q,b:b.q,sumA:sumA,sumB:sumB};
  }).sort(function(x,y){return y.sumA-x.sumA;});
  function diffHtml(vA,vB){
    if(!vB&&!vA)return'<span class="ctl-cmp-flat">—</span>';
    var diff=vA-vB,pct=vB?Math.round(diff/vB*100):null;
    return'<span class="'+(diff>0?'ctl-cmp-up':diff<0?'ctl-cmp-down':'ctl-cmp-flat')+'">'+(diff>0?'▲':diff<0?'▼':'—')+' '+(diff>0?'+':'')+diff+(pct!==null?' ('+pct+'%)':'')+'</span>';
  }
  var sumA=totalA.reduce(function(s,v){return s+v;},0),sumB=totalB.reduce(function(s,v){return s+v;},0);
  var th='<th>Medicine</th>'+QUARTERS.map(function(q){return'<th>'+q+' '+yearA+'</th><th>'+q+' '+yearB+'</th><th>Δ</th>';}).join('')+'<th>Total '+yearA+'</th><th>Total '+yearB+'</th><th>Δ</th>';
  var tfoot='<tr style="font-weight:800;background:var(--s2)"><td>TOTAL</td>'+QUARTERS.map(function(q,i){return'<td style="font-family:var(--mono)">'+totalA[i]+'</td><td style="font-family:var(--mono)">'+totalB[i]+'</td><td>'+diffHtml(totalA[i],totalB[i])+'</td>';}).join('')+'<td style="font-family:var(--mono)">'+sumA+'</td><td style="font-family:var(--mono)">'+sumB+'</td><td>'+diffHtml(sumA,sumB)+'</td></tr>';
  var deptName=dept?(typeof gd==='function'?((gd().find(function(d){return d.id===dept;})||{}).name||dept):'All'):'All departments';
  var result=container.querySelector('#ctl-cmp-result');
  if(result)result.innerHTML=
    '<div class="ctl-cmp-section">'+
      '<div class="ctl-cmp-section-title">📈 '+esc(deptName)+' — '+yearA+' vs '+yearB+'</div>'+
      '<div style="overflow-x:auto"><table class="ctl-cmp-table"><thead><tr>'+th+'</tr></thead><tbody>'+
      rows.map(function(r){return'<tr><td><b>'+r.name+'</b></td>'+QUARTERS.map(function(q,i){return'<td style="font-family:var(--mono)">'+r.a[i]+'</td><td style="font-family:var(--mono)">'+r.b[i]+'</td><td>'+diffHtml(r.a[i],r.b[i])+'</td>';}).join('')+'<td style="font-family:var(--mono);font-weight:700">'+r.sumA+'</td><td style="font-family:var(--mono);font-weight:700">'+r.sumB+'</td><td>'+diffHtml(r.sumA,r.sumB)+'</td></tr>';}).join('')+
      tfoot+'</tbody></table></div>'+
    '</div>';
}

/* ── analytics global handlers ── */
window.ctlAnApply=function(){var c=document.getElementById('ctl-analytics-view');if(c)_applyFilters(c);};
window.ctlCmpApply=function(){var c=document.getElementById('ctl-analytics-view');if(c)_applyComparison(c);};
window.ctlAnPrint=function(){
  if(typeof window.showPg==='function')window.showPg('pg-ctl-analytics');
  setTimeout(function(){if(typeof window.renderCtlAnalytics==='function')window.renderCtlAnalytics();},120);
};
window.ctlCmpPrint=function(){
  var container=document.getElementById('ctl-analytics-view');if(!container)return;
  function q(id){return((container.querySelector('#'+id)||{}).value||'');}
  var dept=q('ctl-cmp-dept'),yearA=q('ctl-cmp-year-a'),yearB=q('ctl-cmp-year-b');
  var table=container.querySelector('#ctl-cmp-result table');
  if(!table){window.toast&&window.toast('Run comparison first / شغّل المقارنة أولاً','err');return;}
  var esc=typeof window.esc==='function'?window.esc:function(v){return String(v==null?'':v);};
  var logo=typeof officialPrintHeaderHTML==='function'?officialPrintHeaderHTML():'';
  var html='<!doctype html><html><head><meta charset="utf-8"><title>Comparison '+yearA+' vs '+yearB+'</title><style>'+
    '@page{size:A4 landscape;margin:8mm}body{font-family:Arial,Tahoma,sans-serif;font-size:9pt;color:#111}'+
    'h1{font-size:12pt;margin:0 0 4px}h2{font-size:9pt;font-weight:400;margin:0 0 10px;color:#555}'+
    'table{width:100%;border-collapse:collapse;font-size:8pt}'+
    'th{background:#1f3a6e;color:#fff;padding:5px 6px;text-align:left;border:1px solid #000;white-space:nowrap}'+
    'td{border:1px solid #ccc;padding:4px 6px;vertical-align:middle}'+
    'tr:nth-child(even) td{background:#f5f8ff}tfoot tr td{background:#e8eef7;font-weight:800}'+
    '.ctl-cmp-up{color:#1a7f37;font-weight:700}.ctl-cmp-down{color:#b91c1c;font-weight:700}'+
    '</style></head><body>'+logo+
    '<h1>Controlled Medicines Comparison / مقارنة صرف الأدوية المخدرة والمقيدة</h1>'+
    '<h2>'+esc(yearA)+' vs '+esc(yearB)+(dept?' — '+esc(dept):'')+'</h2>'+
    table.outerHTML+
    '<script>(function(){var d=false;function g(){if(d)return;d=true;window.focus();window.print();}if(document.readyState==="complete")setTimeout(g,400);else window.addEventListener("load",function(){setTimeout(g,400)},{once:true});})()</sc'+'ript></body></html>';
  var blob=new Blob([html],{type:'text/html;charset=utf-8'});
  var url=URL.createObjectURL(blob);
  var w=window.open(url,'_blank');
  setTimeout(function(){URL.revokeObjectURL(url);},60000);
  if(!w)window.toast&&window.toast('Allow pop-ups to print.','err');
};

})();

(function(){
  'use strict';
  var _narcoticSeedDone=false,_narcoticSeedBusy=false;
  function norm(v){return String(v==null?'':v).trim().replace(/\.0+$/,'');}

  async function ensureNarcoticSharedList(){
    if(_narcoticSeedDone||_narcoticSeedBusy)return false;
    _narcoticSeedBusy=true;
    try{
      var catalog=typeof ctlCatalog==='function'?(ctlCatalog()||[]).map(function(m){return Object.assign({},m)}):[];
      var pharmacy=typeof ctlPharmacy==='function'?Object.assign({},ctlPharmacy()||{}):{};
      var changedCatalog=false,changedStock=false;
      [].forEach(function(src){
        var srcName=norm(src.name).toLowerCase();
        var med=catalog.find(function(m){
          return (src.nupco&&norm(m.nupco)===norm(src.nupco))
            ||(src.moh&&norm(m.moh)===norm(src.moh))
            ||(srcName&&norm(m.name).toLowerCase()===srcName);
        });
        if(!med){
          var id=typeof ctlKey==='function'?ctlKey(src.moh,src.nupco,src.name):('cm_'+(src.moh||src.nupco||Date.now()));
          med={id:id,moh:src.moh||'',nupco:src.nupco||'',name:src.name||'',classification:'narcotic',min:0,max:0};
          catalog.push(med);changedCatalog=true;
        }else{
          if(!med.moh&&src.moh){med.moh=src.moh;changedCatalog=true;}
          if(!med.nupco&&src.nupco){med.nupco=src.nupco;changedCatalog=true;}
          if(!med.name&&src.name){med.name=src.name;changedCatalog=true;}
          if(String(med.classification||'')!=='narcotic'){med.classification='narcotic';changedCatalog=true;}
        }
        /* Repair missing rows only. Existing edited quantities and batches are never overwritten. */
        if(!Object.prototype.hasOwnProperty.call(pharmacy,med.id)){
          pharmacy[med.id]={
            qty:Number(src.qty)||0,
            actualQty:Number(src.qty)||0,
            batches:(src.batches||[]).map(function(b){return {qty:Number(b.qty)||0,expiry:b.expiry||'',lot:b.lot||''};}),
            updatedAt:(typeof nowISO==='function'?nowISO():new Date().toISOString()),
            source:'Recovered controlled shared catalogue seed'
          };
          changedStock=true;
        }
      });
      var jobs=[];
      if(changedCatalog&&typeof ctlSetCatalog==='function')jobs.push(Promise.resolve(ctlSetCatalog(catalog)));
      if(changedStock&&typeof ctlSetPharmacy==='function')jobs.push(Promise.resolve(ctlSetPharmacy(pharmacy)));
      if(jobs.length)await Promise.all(jobs);
      _narcoticSeedDone=true;
      return changedCatalog||changedStock;
    }catch(e){console.error('Narcotic shared list repair failed',e);return false;}
    finally{_narcoticSeedBusy=false;}
  }
  window.ensureNarcoticSharedList=ensureNarcoticSharedList;

})();
(function(){
  function q(id){return document.getElementById(id)}
  function val(id){return (q(id)||{}).value||''}
  function n(v){v=Number(v);return isFinite(v)?v:0}
  function medKey(it){return String((it&&it.name)||'').trim().toLowerCase()}
  function openReports(){return (crashReports()||[]).filter(function(r){return r.status==='open'||r.status==='pending'})}
  function isPharmacyCrashRole(){if(window.fsHasCapability)return window.fsHasCapability('crashCart.operate');var rRole=String((window.CU&&CU.role)||'');return !!window.CU&&['pharmacy','inpatient_supervisor','pharmacy_staff'].includes(rRole)}

  /* Role menus exactly as requested. */
  window.buildNav=function(){
    if(!window.CU)return;
    var nav=q('mnav');nav.innerHTML='';
    var commonFull=[['pg-dash','Dashboard'],['pg-inv','Inventory'],['pg-reqs','Requests'],['pg-notes-ph','📝 Notes'],['pg-schedule','⏰ Schedule'],['pg-print','Print'],['pg-analytics','Analytics'],['pg-import','⬇ Import'],['pg-controlled','🔒 Controlled custody'],['pg-ctl-analytics','📊 Controlled analytics'],['pg-crashcart','🚑 Crash Carts'],['pg-crash-ops','🛠 Crash Cart Operations'],['pg-med-accountability','🧾 Medication Accountability']];
    var items;
    var rRole=String((window.CU&&CU.role)||'');
    if(rRole==='pharmacy')items=commonFull.filter(function(x){return x[0]!=='pg-controlled'}).concat([['pg-users','Users']]);
    else if(rRole==='inpatient_supervisor')items=[['pg-dash','Dashboard'],['pg-inv','Inventory'],['pg-reqs','Requests'],['pg-notes-ph','📝 Notes'],['pg-schedule','⏰ Schedule'],['pg-print','Print'],['pg-analytics','Analytics'],['pg-import','⬇ Import'],['pg-crashcart','🚑 Crash Carts'],['pg-crash-ops','🛠 Crash Cart Operations'],['pg-med-accountability','🧾 Medication Accountability']];
    else if(rRole==='outpatient_pharmacy_supervisor')items=[['pg-dash','Dashboard'],['pg-inv','Inventory'],['pg-reqs','Requests'],['pg-notes-ph','📝 Notes'],['pg-print','Print'],['pg-crashcart','🚑 Crash Carts'],['pg-crash-ops','🛠 Crash Cart Operations'],['pg-med-accountability','🧾 Medication Accountability']];
    else if(rRole==='pharmacy_staff')items=[['pg-dash','Dashboard'],['pg-inv','Inventory status / حالة الأدوية'],['pg-reqs','Requests'],['pg-notes-ph','📝 Notes'],['pg-print','Print'],['pg-crashcart','🚑 Crash Carts'],['pg-crash-ops','🛠 Crash Cart Operations'],['pg-med-accountability','🧾 Medication Accountability']];
    else if(rRole==='controlled_pharmacy')items=[['pg-controlled','🔒 Controlled & psychotropic medicines'],['pg-ctl-analytics','📊 Controlled analytics']];
    else if(rRole==='warehouse')items=[['pg-controlled','🔒 Warehouse controlled custody'],['pg-ctl-analytics','📊 Dispensing analytics']];
    else items=[['pg-newreq','New Request / طلب جديد'],['pg-myreqs','My Requests / طلباتي'],['pg-shelves','📦 Shelves / أرفف'],['pg-crashcart','🚑 Crash Cart'],['pg-notes-dept','📝 Notes / ملاحظات'],['pg-deptprint','🖨 Print Drug List'],['pg-controlled','🔒 Controlled custody'],['pg-med-accountability','🧾 Medication documentation']];
    if((typeof isMasterActual==='function'&&isMasterActual())||(typeof window.clHasVisibleLists==='function'&&window.clHasVisibleLists()))items.push(['pg-classification-lists','⚠ Classification Lists']);
    if(typeof isMasterActual==='function'&&isMasterActual()){var mb=document.createElement('button');mb.className='nb';mb.id='master-nav-switch';mb.innerHTML=window.MASTER_EFFECTIVE?'🧪 تغيير الدور الحالي':'🔄 الانتقال بين الأدوار';mb.onclick=openMasterRoleSwitch;nav.appendChild(mb)}
    items.forEach(function(x){var b=document.createElement('button');b.className='nb';b.innerHTML=x[1];b.dataset.pg=x[0];b.onclick=function(){showPg(this.dataset.pg)};nav.appendChild(b)});
    if((typeof isMasterActual==='function'&&isMasterActual())||(CU&&rRole==='pharmacy')){var zb=document.createElement('button');zb.id='zebra-labels-nav';zb.className='nb';zb.dataset.pg='pg-zebra-labels';zb.innerHTML='🦓 Zebra Labels <small style="opacity:.72">Beta</small>';zb.onclick=function(){showPg('pg-zebra-labels')};nav.appendChild(zb)}
    (window.__buildNavAfterExtensions||[]).forEach(function(fn){try{fn()}catch(e){console.error('buildNav extension failed',e)}});
    ccUpdateBadges();
    if(typeof window.scheduleNavigationRefresh==='function')window.scheduleNavigationRefresh('');
    if(typeof window.enforceRoleUi==='function')window.enforceRoleUi();
  };

  function ccUpdateBadges(){
    var open=openReports().length, reqRows=(typeof gr==='function'?(gr()||[]):[]), badgeRole=window.fsEffectiveRole?window.fsEffectiveRole():String((window.CU&&CU.role)||'');
    if(badgeRole==='outpatient_pharmacy_supervisor'&&window.fsOutpatientDeptId){var badgeDept=window.fsOutpatientDeptId();reqRows=reqRows.filter(function(r){return String(r.deptId)===String(badgeDept)})}
    if(typeof window.fsCanAccessDepartment==='function')reqRows=reqRows.filter(function(r){return window.fsCanAccessDepartment(r.deptId)});
    var req=reqRows.filter(function(r){return r.status==='pending'}).length;
    var cb=document.querySelector('[data-pg="pg-crashcart"]'),rb=document.querySelector('[data-pg="pg-reqs"]');
    if(cb){cb.querySelectorAll('.cc-badge').forEach(function(x){x.remove()});if(open)cb.insertAdjacentHTML('beforeend','<span class="cc-badge">'+open+'</span>')}
    if(rb){rb.querySelectorAll('.cc-badge').forEach(function(x){x.remove()});if(req)rb.insertAdjacentHTML('beforeend','<span class="cc-badge">'+req+'</span>')}
  }
  window.ccUpdateBadges=ccUpdateBadges;

  window.renderCrashDashboardSummary=function(){var d=q('dstats');if(d&&isPharmacyCrashRole()){
    var open=openReports().length,reqRows=(typeof gr==='function'?(gr()||[]):[]),badgeRole=window.fsEffectiveRole?window.fsEffectiveRole():String((window.CU&&CU.role)||'');
    if(badgeRole==='outpatient_pharmacy_supervisor'&&window.fsOutpatientDeptId){var badgeDept=window.fsOutpatientDeptId();reqRows=reqRows.filter(function(r){return String(r.deptId)===String(badgeDept)})}
    if(typeof window.fsCanAccessDepartment==='function')reqRows=reqRows.filter(function(r){return window.fsCanAccessDepartment(r.deptId)});
    var req=reqRows.filter(function(r){return r.status==='pending'}).length;
    var existing=q('cc-dashboard-extra');if(existing)existing.remove();var wrap=document.createElement('div');wrap.id='cc-dashboard-extra';wrap.className='g2 mb14';wrap.innerHTML='<div class="sc"><div class="sl">Open Crash Cart Reports</div><div class="sv">'+open+'</div><div class="ss">Awaiting pharmacy response</div></div><div class="sc"><div class="sl">Pending Requests</div><div class="sv">'+req+'</div><div class="ss">Awaiting fulfillment</div></div>';d.parentNode.insertBefore(wrap,d.nextSibling)}ccUpdateBadges()};

  /* Crash Cart reporting and exact dated replacement. */
  function ccDateKey(value){return String(value||'').slice(0,10)}
  function ccItemPresent(item){return n(item&&item.present!=null?item.present:item&&item.qty)}
  function ccItemStandard(item){return n(item&&item.qty)}
  function ccDatedBatches(item){return ((item&&item.batches)||[]).filter(function(b){return ccDateKey(b.expiry)&&n(b.qty)>0})}
  function ccExpiryQuantity(item,date){return ccDatedBatches(item).filter(function(b){return ccDateKey(b.expiry)===ccDateKey(date)}).reduce(function(sum,b){return sum+n(b.qty)},0)}
  function ccExpiryOptions(item,selected,allowBlank){var dates={};ccDatedBatches(item).forEach(function(b){var d=ccDateKey(b.expiry);dates[d]=(dates[d]||0)+n(b.qty)});var html=allowBlank?'<option value="">Not specified / غير محدد</option>':'';return html+Object.keys(dates).sort().map(function(d){return '<option value="'+esc(d)+'" '+(ccDateKey(selected)===d?'selected':'')+'>'+esc(d)+' — '+dates[d]+' unit(s)</option>'}).join('')}
  function ccBatchSummary(item){var rows=ccDatedBatches(item);if(!rows.length)return '<span class="fhint">No dated batches / لا توجد دفعات مؤرخة</span>';return rows.sort(function(a,b){return ccDateKey(a.expiry).localeCompare(ccDateKey(b.expiry))}).map(function(b){return '<span class="crash-batch-chip">'+esc(ccDateKey(b.expiry))+' → '+n(b.qty)+'</span>'}).join('')}
  function ccRemoveFromExpiry(item,date,qty){var left=n(qty),next=[];((item&&item.batches)||[]).forEach(function(batch){var copy=Object.assign({},batch);if(left>0&&ccDateKey(copy.expiry)===ccDateKey(date)){var take=Math.min(left,n(copy.qty));copy.qty=n(copy.qty)-take;left-=take}if(n(copy.qty)>0)next.push(copy)});if(left>0.000001)throw new Error('The selected old expiry does not contain enough quantity. / التاريخ القديم المحدد لا يحتوي على كمية كافية.');item.batches=next}
  function ccAddDatedQuantity(item,date,qty,reportId){qty=n(qty);if(!(qty>0))return;var batches=Array.isArray(item.batches)?item.batches.map(function(b){return Object.assign({},b)}):[],target=batches.find(function(b){return ccDateKey(b.expiry)===ccDateKey(date)&&!String(b.lot||'').trim()});if(target){target.qty=n(target.qty)+qty;target.sourceReportId=reportId;target.updatedAt=nowISO()}else{batches.push({id:'ccb_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,7),qty:qty,expiry:ccDateKey(date),lot:'',source:'pharmacy_report_replacement',sourceReportId:reportId,updatedAt:nowISO(),updatedBy:actualActorName()})}item.batches=batches.sort(function(a,b){return ccDateKey(a.expiry).localeCompare(ccDateKey(b.expiry))})}
  function ccDeductReported(item,qty,reportedExpiry){
    var left=n(qty),taken=[],batches=Array.isArray(item.batches)?item.batches.map(function(batch){return Object.assign({},batch)}):[];
    var order=batches.map(function(batch,index){return {batch:batch,index:index}}).filter(function(entry){return n(entry.batch.qty)>0&&(!reportedExpiry||ccDateKey(entry.batch.expiry)===ccDateKey(reportedExpiry))}).sort(function(a,b){return ccDateKey(a.batch.expiry).localeCompare(ccDateKey(b.batch.expiry))||a.index-b.index});
    order.forEach(function(entry){if(left<=0)return;var take=Math.min(left,n(entry.batch.qty));if(!(take>0))return;entry.batch.qty=n(entry.batch.qty)-take;left-=take;taken.push({batchId:entry.batch.batchId||entry.batch.id||'',expiry:ccDateKey(entry.batch.expiry),lot:entry.batch.lot||entry.batch.batch||'',qty:take})});
    if(reportedExpiry&&left>0.000001)throw new Error('The selected expiry does not contain enough quantity. / التاريخ المحدد لا يحتوي على كمية كافية.');
    item.batches=batches.filter(function(batch){return n(batch.qty)>0});
    var untracked=Math.max(0,left),present=ccItemPresent(item);if(qty>present+0.000001)throw new Error('Reported quantity exceeds the current cart quantity.');
    item.present=Math.max(0,present-qty);item.stockStatus=item.present<=0?'out_of_stock':item.present<ccItemStandard(item)?'partial':'available';item.updatedAt=nowISO();item.updatedBy=actualActorName();
    return {deductionBatches:taken,untrackedDeductedQty:untracked,deductedQty:qty,deductedAtReport:true};
  }
  function ccRestoreReported(cart,report){
    if(!report||!report.inventoryDeductedAtReport)return;
    (report.consumed||[]).forEach(function(row){var item=(cart.items||[]).find(function(entry){return String(entry.id)===String(row.itemId)});if(!item)return;var restored=n(row.deductedQty||row.qty),batches=Array.isArray(item.batches)?item.batches.map(function(batch){return Object.assign({},batch)}):[];(row.deductionBatches||[]).forEach(function(part){var target=batches.find(function(batch){return (part.batchId&&String(batch.batchId||batch.id||'')===String(part.batchId))||(!part.batchId&&ccDateKey(batch.expiry)===ccDateKey(part.expiry)&&String(batch.lot||batch.batch||'')===String(part.lot||''))});if(target)target.qty=n(target.qty)+n(part.qty);else batches.push({batchId:part.batchId||('ccb_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,7)),expiry:ccDateKey(part.expiry),lot:part.lot||'',qty:n(part.qty),source:'restored_report_edit'})});item.batches=batches;item.present=Math.min(ccItemStandard(item),ccItemPresent(item)+restored);item.stockStatus=item.present<=0?'out_of_stock':item.present<ccItemStandard(item)?'partial':'available'});
  }
  // Master sets a minimum accepted length for crash cart seal numbers to make
  // trivial/guessable seals (e.g. a single digit) harder to slip past a
  // pharmacy/inpatient-supervisor closure. The exact minimum is intentionally
  // never revealed to non-master roles on rejection — only a generic message.
  function crashCartMinSealLength(){try{return Math.max(0,parseInt((typeof S!=='undefined'&&S.g&&S.g('crash_cart_min_seal_length'))||0,10)||0)}catch(e){return 0}}
  window.crashCartMinSealLength=crashCartMinSealLength;
  function sealMeetsMinLength(seal){return String(seal||'').trim().length>=crashCartMinSealLength()}
  window.crashCartSealMeetsMinLength=sealMeetsMinLength;
  window.ccSetMinSealLength=async function(){
    if(!(typeof window.isMaster==='function'&&window.isMaster()))return toast('Not authorized.','err');
    var current=crashCartMinSealLength(),input=window.prompt('Minimum accepted seal number length (0 = no minimum) / الحد الأدنى لعدد خانات رقم القفل (0 = بدون حد أدنى):',String(current));
    if(input==null)return;var next=parseInt(input,10);if(!isFinite(next)||next<0)return toast('Enter a valid non-negative number.','err');
    await S.s('crash_cart_min_seal_length',next);if(typeof auditAction==='function')auditAction('crash_cart_min_seal_length_set',{value:next});toast('Minimum seal length saved ✓','succ');
  };
  function ccUniqueSealAllowed(seal,cartId,reportId){var key=String(seal||'').trim().toLowerCase();if(!key)return false;var used=false;(crashCarts()||[]).forEach(function(c){if(String(c.id)!==String(cartId)&&String(c.seal||'').trim().toLowerCase()===key)used=true});(crashReports()||[]).forEach(function(r){if(String(r.id)===String(reportId))return;[r.oldSeal,r.newSeal].forEach(function(s){if(String(s||'').trim().toLowerCase()===key)used=true})});return !used}

  window.crashReportOpen=function(id){
    var effectiveRole=window.fsEffectiveRole?window.fsEffectiveRole():String(window.CU&&CU.role||'');
    var c=crashCart(id);if(!c||!window.CU||['department','department_employee'].indexOf(String(effectiveRole))<0||String(c.deptId)!==String(CU.deptId))return toast('No permission','err');
    var existing=(crashReports()||[]).find(function(report){return String(report.cartId)===String(id)&&(report.status==='open'||report.status==='pending')})||null,reasonInput=q('ccr-reason'),otherInput=q('v16-crash-other');
    q('ccr-cart-id').value=id;q('ccr-old-seal').value=existing&&existing.oldSeal||c.seal||'';
    if(reasonInput){var savedReason=String(existing&&existing.reason||'');if(savedReason.indexOf('Other / سبب آخر: ')===0){reasonInput.value='other';if(otherInput){otherInput.value=savedReason.slice('Other / سبب آخر: '.length);otherInput.style.display=''}}else{reasonInput.value=savedReason;if(otherInput){otherInput.value='';otherInput.style.display='none'}}}
    q('ccr-items').innerHTML=(c.items||[]).map(function(it){
      var prior=existing&&(existing.consumed||[]).find(function(row){return String(row.itemId)===String(it.id)}),displayItem=JSON.parse(JSON.stringify(it));
      if(prior&&existing.inventoryDeductedAtReport)ccRestoreReported({items:[displayItem]},{inventoryDeductedAtReport:true,consumed:[prior]});
      var max=ccItemPresent(displayItem),checked=!!prior,qty=prior?n(prior.qty):(max>0?1:0),reportedExpiry=prior&&prior.reportedExpiry||'';
      return '<div class="cc-med-choice '+(checked?'on':'')+'" data-id="'+esc(it.id)+'"><div class="cc-med-head"><label><input type="checkbox" '+(checked?'checked ':'')+(max>0?'':'disabled ')+'onchange="this.closest(\'.cc-med-choice\').classList.toggle(\'on\',this.checked)"><span>'+esc(it.name)+' <small style="color:var(--tx2)">'+esc(it.strength||it.concentration||'')+'</small></span></label><span class="chip">Available: '+max+' / Standard: '+ccItemStandard(it)+'</span></div><div class="cc-med-qty"><div class="cc-report-item-grid"><div class="fg"><label>Consumed quantity / الكمية المستخدمة</label><input class="ccr-qty" type="number" min="0.001" max="'+max+'" step="any" value="'+qty+'"><div class="fhint">Maximum allowed: '+max+'</div></div><div class="fg"><label>Consumed expiry — optional / تاريخ الكمية المستخدمة — اختياري</label><select class="ccr-expiry">'+ccExpiryOptions(displayItem,reportedExpiry,true)+'</select><div class="fhint">Leave blank if the department does not know the batch date.</div></div></div></div></div>';
    }).join('')||'<div class="fhint">No medicines configured.</div>';
    OM('mcc-report');
  };
  // Replacement is the only mode now (no separate "add" choice). The old
  // expiry to deduct the reported quantity from is derived automatically
  // from what the department reported (data-reported-expiry), never chosen
  // manually — the one date field the pharmacist fills in is the expiry the
  // REPLACEMENT quantity gets, picked from a merged cart+report date list or
  // typed as a new date.
  function ccResponseRowPlan(row){
    var unavailable=!!(row.querySelector('.ccc-unavailable')||{}).checked;
    var choice=row.querySelector('.ccc-exp-choice'),choiceVal=choice?choice.value:'',newExpInput=row.querySelector('.ccc-exp');
    var expiry=unavailable?'':ccDateKey(choiceVal==='__new__'?(newExpInput&&newExpInput.value):choiceVal);
    return {itemId:row.dataset.id,reportedQty:n(row.dataset.reported),unavailable:unavailable,action:unavailable?'add':'replace',sourceExpiry:unavailable?'':ccDateKey(row.dataset.reportedExpiry||''),qty:unavailable?0:n((row.querySelector('.ccc-qty')||{}).value),expiry:expiry}
  }
  function ccMergedExpiryOptions(item,reportedExpiry,selected){var dates={};ccDatedBatches(item).forEach(function(b){var d=ccDateKey(b.expiry);dates[d]=(dates[d]||0)+n(b.qty)});var repKey=ccDateKey(reportedExpiry),fromReport=repKey&&!(repKey in dates);if(fromReport)dates[repKey]=0;return Object.keys(dates).sort().map(function(d){return '<option value="'+esc(d)+'" '+(ccDateKey(selected)===d?'selected':'')+'>'+esc(d)+' — '+dates[d]+' unit(s)'+(d===repKey&&fromReport?' (from report / من البلاغ)':'')+'</option>'}).join('')}
  window.ccCrashExpiryChoiceChanged=function(select){var row=select.closest('tr'),input=row&&row.querySelector('.ccc-exp');if(input)input.style.display=select.value==='__new__'?'':'none';ccCrashResponsePreview()};
  // Marking a row "not currently available" always means qty=0 / action=add — no
  // source expiry required and closing is never blocked by a missing item; the
  // cart simply closes with that item left below standard / out of stock.
  window.ccCrashUnavailableToggled=function(checkbox){var row=checkbox.closest('tr');if(!row)return;var choice=row.querySelector('.ccc-exp-choice'),newExp=row.querySelector('.ccc-exp'),qty=row.querySelector('.ccc-qty'),checked=checkbox.checked;if(choice)choice.disabled=checked;if(newExp){newExp.disabled=checked;if(checked)newExp.value=''}if(qty){qty.disabled=checked;if(checked)qty.value=0}ccCrashResponsePreview()};
  window.ccCrashResponsePreview=function(){var id=val('ccc-report-id'),r=(crashReports()||[]).find(function(x){return String(x.id)===String(id)}),c=r&&crashCart(r.cartId),alreadyDeducted=!!(r&&r.inventoryDeductedAtReport),messages=[],valid=true;document.querySelectorAll('#ccc-items tr').forEach(function(row){var p=ccResponseRowPlan(row),it=c&&(c.items||[]).find(function(x){return String(x.id)===String(p.itemId)}),current=ccItemPresent(it),standard=ccItemStandard(it),remove=alreadyDeducted?0:(p.action==='replace'?p.reportedQty:0),result=current-remove+p.qty,error='';if(!p.unavailable&&!alreadyDeducted&&!p.sourceExpiry)error='The original reported expiry date is missing for this item — contact a pharmacy admin.';else if(!p.unavailable&&!alreadyDeducted&&ccExpiryQuantity(it,p.sourceExpiry)<p.reportedQty)error='The reported expiry no longer has enough quantity to deduct.';else if(p.qty<0)error='Replacement quantity cannot be negative.';else if(!p.unavailable&&p.qty>0&&!p.expiry)error='Every replacement quantity requires an expiry date.';else if(result<0)error='Resulting quantity cannot be negative.';else if(result>standard+0.000001)error='Result '+result+' exceeds standard '+standard+'.';row.classList.toggle('crash-response-error',!!error);var out=row.querySelector('.ccc-row-result');if(out)out.textContent=error||(p.unavailable?'Marked not available — final '+result+' / '+standard:('Final '+result+' / '+standard+(alreadyDeducted?' · reported quantity already deducted':'')));if(error){valid=false;messages.push((it&&it.name||'Medicine')+': '+error)}});var box=q('ccc-validation');if(box){box.className='crash-response-validation '+(valid?'ok':'err');box.innerHTML=valid?'✓ All rows are within the approved standard quantity. / جميع الكميات ضمن العدد المعتمد.':esc(messages.join(' | '))}var save=q('ccc-save-btn');if(save)save.disabled=!valid;return valid};
  window.crashCloseReport=function(reportId){
    if(!canManageCrashCart())return toast('No permission','err');var r=(crashReports()||[]).find(function(x){return String(x.id)===String(reportId)});if(!r)return;var c=crashCart(r.cartId);if(!c)return toast('Crash Cart not found.','err');
    q('ccc-report-id').value=reportId;q('ccc-new-seal').value=r.newSeal||'';q('ccc-note').value=r.pharmacyNote||'';
    var reportedIds=(r.consumed||[]).map(function(x){return String(x.itemId)});
    var reportedRows=(r.consumed||[]).map(function(x){
      var it=(c.items||[]).find(function(z){return String(z.id)===String(x.itemId)})||{},saved=(r.replacements||[]).find(function(z){return String(z.itemId)===String(x.itemId)})||{},savedUnavailable=!!saved.unavailable,qty=saved.qty!=null?n(saved.qty):n(x.qty),expiry=saved.expiry||'';
      var isKnownDate=!!expiry&&(ccDatedBatches(it).some(function(b){return ccDateKey(b.expiry)===ccDateKey(expiry)})||ccDateKey(expiry)===ccDateKey(x.reportedExpiry));
      var choiceValue=expiry?(isKnownDate?ccDateKey(expiry):'__new__'):'';
      return '<tr data-id="'+esc(x.itemId)+'" data-reported="'+n(x.qty)+'" data-reported-expiry="'+esc(x.reportedExpiry||'')+'"><td><b>'+esc(x.name)+'</b><div class="fhint">'+esc(x.strength||'')+'</div><label class="ccc-unavailable-label"><input type="checkbox" class="ccc-unavailable" '+(savedUnavailable?'checked':'')+' onchange="ccCrashUnavailableToggled(this)"> Not currently available / غير متوفر حالياً</label><div class="ccc-row-result"></div></td><td>'+n(x.qty)+(x.reportedExpiry?'<div class="fhint">Reported expiry: '+esc(x.reportedExpiry)+'</div>':'<div class="fhint">Expiry not reported</div>')+'</td><td><div class="crash-current-batches">'+ccBatchSummary(it)+'</div><div class="fhint">Present '+ccItemPresent(it)+' / Standard '+ccItemStandard(it)+'</div></td><td><select class="ccc-exp-choice" '+(savedUnavailable?'disabled':'')+' onchange="ccCrashExpiryChoiceChanged(this)"><option value="">Choose expiry date... / اختر تاريخ الانتهاء...</option>'+ccMergedExpiryOptions(it,x.reportedExpiry,choiceValue==='__new__'?'':choiceValue)+'<option value="__new__" '+(choiceValue==='__new__'?'selected':'')+'>+ New date / تاريخ جديد</option></select><input class="ccc-exp" type="date" value="'+esc(savedUnavailable?'':(choiceValue==='__new__'?expiry:''))+'" style="'+(choiceValue==='__new__'&&!savedUnavailable?'':'display:none')+'" '+(savedUnavailable?'disabled':'')+' onchange="ccCrashResponsePreview()"></td><td><input class="ccc-qty" type="number" min="0" step="any" value="'+(savedUnavailable?0:qty)+'" '+(savedUnavailable?'disabled':'')+' oninput="ccCrashResponsePreview()"></td></tr>';
    }).join('');
    // While a cart is open for any reason, also allow topping up other medicines in the
    // SAME cart that are already short (present < standard) even though nobody reported
    // them specifically — still logged through this seal-correction workflow, not the
    // unrestricted master-only editor.
    var extraShort=(c.items||[]).filter(function(it){return reportedIds.indexOf(String(it.id))<0&&ccItemPresent(it)<ccItemStandard(it)});
    var extraRows=extraShort.map(function(it){
      var saved=(r.replacements||[]).find(function(z){return String(z.itemId)===String(it.id)})||{},qty=saved.qty!=null?n(saved.qty):0,expiry=saved.expiry||'',choiceValue=expiry?(ccDatedBatches(it).some(function(b){return ccDateKey(b.expiry)===ccDateKey(expiry)})?ccDateKey(expiry):'__new__'):'';
      return '<tr data-id="'+esc(it.id)+'" data-reported="0" data-reported-expiry=""><td><b>'+esc(it.name)+'</b><div class="fhint">'+esc(it.strength||it.concentration||'')+'</div><div class="fhint">Also below standard in this cart / أيضًا أقل من المعياري في هذه العربة</div><input type="checkbox" class="ccc-unavailable" checked disabled style="display:none"><div class="ccc-row-result"></div></td><td>0<div class="fhint">Not part of this report / ليست ضمن هذا البلاغ</div></td><td><div class="crash-current-batches">'+ccBatchSummary(it)+'</div><div class="fhint">Present '+ccItemPresent(it)+' / Standard '+ccItemStandard(it)+'</div></td><td><select class="ccc-exp-choice" onchange="ccCrashExpiryChoiceChanged(this)"><option value="">Choose expiry date... / اختر تاريخ الانتهاء...</option>'+ccMergedExpiryOptions(it,'',choiceValue==='__new__'?'':choiceValue)+'<option value="__new__" '+(choiceValue==='__new__'?'selected':'')+'>+ New date / تاريخ جديد</option></select><input class="ccc-exp" type="date" value="'+esc(choiceValue==='__new__'?expiry:'')+'" style="'+(choiceValue==='__new__'?'':'display:none')+'" onchange="ccCrashResponsePreview()"></td><td><input class="ccc-qty" type="number" min="0" step="any" value="'+qty+'" oninput="ccCrashResponsePreview()"></td></tr>';
    }).join('');
    q('ccc-items').innerHTML=reportedRows+extraRows;
    var h=q('ccx-close-actor');if(h){var u=window.CU||{},name=typeof actualActorName==='function'?actualActorName():(u.name||u.username||u.email||'Unknown'),user=u.username||u.email||u.id||'Unknown';h.innerHTML='<b>Closing pharmacist / الصيدلي الذي سيغلق العربة:</b><br>'+esc(name)+'<br><b>System user / مستخدم النظام:</b> '+esc(user)}OM('mcc-close');setTimeout(ccCrashResponsePreview,0);
  };
  // Dry-run every row's final quantity/status without mutating state, so the
  // pre-close warning below can list exactly what will be below standard or
  // out of stock — the same classification ccSavePharmacyResponse commits.
  function ccCrashResponseBelowStandardItems(report,cart){
    var alreadyDeducted=!!(report&&report.inventoryDeductedAtReport),out=[];
    document.querySelectorAll('#ccc-items tr').forEach(function(row){
      var p=ccResponseRowPlan(row),it=(cart.items||[]).find(function(x){return String(x.id)===String(p.itemId)});
      if(!it)return;
      var current=ccItemPresent(it),standard=ccItemStandard(it),removed=alreadyDeducted?0:(p.action==='replace'?p.reportedQty:0),result=current-removed+p.qty;
      if(result<standard-0.000001)out.push({name:it.name||'Medicine',result:result,standard:standard,outOfStock:result<=0});
    });
    return out;
  }
  window.ccSavePharmacyResponse=async function(){
    var id=val('ccc-report-id'),originalReports=crashReports(),originalCarts=crashCarts(),rs=JSON.parse(JSON.stringify(originalReports||[])),carts=JSON.parse(JSON.stringify(originalCarts||[])),r=rs.find(function(x){return String(x.id)===String(id)});if(!r)return;var c=carts.find(function(x){return String(x.id)===String(r.cartId)});if(!c)return toast('Crash Cart not found.','err');var seal=val('ccc-new-seal').trim();if(!seal)return toast('Enter the new seal number / أدخل رقم القفل الجديد.','err');if(!sealMeetsMinLength(seal))return toast('Enter a valid seal number. / أدخل رقم قفل صالح.','err');if(!ccUniqueSealAllowed(seal,c.id,id))return toast('The new seal number is already used. Enter a unique seal.','err');if(!ccCrashResponsePreview())return toast('Correct the highlighted replacement rows first.','err');
    var belowStandard=ccCrashResponseBelowStandardItems(r,c);
    if(belowStandard.length){
      var list=belowStandard.map(function(x){return '• '+x.name+' — '+x.result+' / '+x.standard+(x.outOfStock?' (نافد / out of stock)':'')}).join('\n');
      var proceed=await uiConfirm('الأصناف التالية أقل من الحد القياسي / The following items are below standard:\n\n'+list+'\n\nهل تريد تأكيد الإغلاق رغم النقص؟ / Confirm closing anyway?',{title:'⚠ Confirm closing below standard',okText:'Confirm closing / تأكيد الإغلاق'});
      if(!proceed)return false;
    }
    var replacements=[],alreadyDeducted=!!r.inventoryDeductedAtReport;
    try{document.querySelectorAll('#ccc-items tr').forEach(function(row){var p=ccResponseRowPlan(row),it=(c.items||[]).find(function(x){return String(x.id)===String(p.itemId)});if(!it)throw new Error('A reported medicine no longer exists in the cart.');var current=ccItemPresent(it),standard=ccItemStandard(it),removed=0;if(!alreadyDeducted&&p.action==='replace'){if(!p.sourceExpiry)throw new Error(it.name+': the original reported expiry date is missing.');removed=p.reportedQty;ccRemoveFromExpiry(it,p.sourceExpiry,removed)}if(p.qty>0){if(!p.expiry)throw new Error(it.name+': replacement expiry is required.');ccAddDatedQuantity(it,p.expiry,p.qty,id)}var result=current-removed+p.qty;if(result<0||result>standard+0.000001)throw new Error(it.name+': final quantity '+result+' exceeds the allowed range 0–'+standard+'.');it.present=result;it.stockStatus=result<=0?'out_of_stock':result<standard?'partial':'available';it.updatedAt=nowISO();it.updatedBy=actualActorName();replacements.push({itemId:p.itemId,name:it.name||'',action:alreadyDeducted?'replace_after_report_deduction':p.action,unavailable:p.unavailable,sourceExpiry:alreadyDeducted?'':p.sourceExpiry,reportedQty:p.reportedQty,removedQty:removed,qty:p.qty,expiry:p.expiry,resultingPresent:result,standardQty:standard})});
      var actorUser=window.CU||{},actorName=actualActorName(),actorLogin=actorUser.username||actorUser.email||actorUser.id||'Unknown',actorId=actorUser.id||actorUser.uid||'',stamp=nowISO();c.seal=seal;c.updatedAt=stamp;c.updatedBy=actorName;c.lastClosedByName=actorName;c.lastClosedByUser=actorLogin;c.lastClosedAt=stamp;r.status='closed';r.closedAt=stamp;r.closedBy=actorName;r.closedByName=actorName;r.closedByUser=actorLogin;r.closedById=actorId;r.newSeal=seal;r.pharmacyNote=val('ccc-note').trim();r.replacements=replacements;r.lastEditedAt=stamp;r.lastEditedBy=actorName;r.lastEditedByName=actorName;r.lastEditedByUser=actorLogin;
      await setCrashCarts(carts);try{await setCrashReports(rs)}catch(reportError){await setCrashCarts(originalCarts);throw reportError}auditAction('crash_cart_report_closed_exact_dated_replacement',{reportId:id,newSeal:seal,replacements:replacements,inventoryAlreadyDeducted:alreadyDeducted});if(q('ccx-state'))q('ccx-state').value='';CM('mcc-close');renderCrashCarts();ccUpdateBadges();toast(alreadyDeducted?'Replacement saved; reported deductions were not deducted twice ✓':'Pharmacy response saved; old dated quantities were deducted exactly ✓','succ');
    }catch(e){console.error(e);toast('Pharmacy response was not saved: '+String(e&&e.message||e),'err')}
  };

  /* Print: no details/signatures below department head, add strength and clear expiry→quantity arrows. */
  
  /* Wrap Crash Cart rendering to add bulk button, edit closed reports, and badges. */
/* Pharmacy inventory: expiry filtering is integrated into the existing list card. */
  function pharmacyExpiryRules(){
    var x=S.g('pharmacy_department_expiry_rules')||{};
    var urgent=Math.max(1,n(x.urgentDays||7)),near=Math.max(urgent+1,n(x.nearDays||30));
    return {urgentDays:urgent,nearDays:near};
  }
  window.phExpiryView=window.phExpiryView||'inventory';
  window.phExpiryDeptIds=Array.isArray(window.phExpiryDeptIds)?window.phExpiryDeptIds:[];
  function allDeptExpiryRows(){
    var rows=[];
    (gd()||[]).forEach(function(d){
      var meds=getMeds(d.id)||[];
      (getExpiry(d.id)||[]).forEach(function(b){
        var date=b.expiry||b.date||'',days=daysUntil(date),m=meds.find(function(x){return x.id===b.medId})||{};
        rows.push({deptId:d.id,dept:d.name,med:m.name||b.medId,strength:m.strength||'',qty:b.qty,date:date,days:days});
      });
    });
    return rows.sort(function(a,b){return String(a.date).localeCompare(String(b.date))});
  }
  function phExpiryStatus(days,rules){
    if(days===null||days===undefined||isNaN(days))return 'unknown';
    if(days<0)return 'expired';
    if(days<=rules.urgentDays)return 'urgent';
    if(days<=rules.nearDays)return 'near';
    return 'normal';
  }
  function phExpiryKnownDeptIds(){return (gd()||[]).map(function(d){return String(d.id)})}
  function phExpirySelectedDeptIds(){
    var known=phExpiryKnownDeptIds();
    var selected=(window.phExpiryDeptIds||[]).map(String).filter(function(id){return known.includes(id)});
    return selected.length?selected:known;
  }
  window.phExpirySetView=function(v){window.phExpiryView=v||'inventory';renderPhExpiryIntegrated()};
  window.phExpiryToggleDept=function(id,checked){
    var known=phExpiryKnownDeptIds(),cur=(window.phExpiryDeptIds||[]).map(String).filter(function(x){return known.includes(x)});
    if(!cur.length)cur=known.slice();
    if(checked&&!cur.includes(String(id)))cur.push(String(id));
    if(!checked)cur=cur.filter(function(x){return x!==String(id)});
    window.phExpiryDeptIds=cur.length===known.length?[]:cur;
    renderPhExpiryIntegrated();
  };
  window.phExpirySelectAllDepartments=function(){window.phExpiryDeptIds=[];renderPhExpiryIntegrated()};
  window.phExpiryClearDepartments=function(){window.phExpiryDeptIds=['__none__'];renderPhExpiryIntegrated()};
  window.phExpiryEditRules=function(){
    if(!window.CU||!['pharmacy','inpatient_supervisor'].includes(CU.role))return toast('No permission','err');
    if(typeof window.ccxEditRules==='function')return window.ccxEditRules();
    return toast('Expiry rules editor is unavailable.','err')
  };
  function phExpiryEnsureIntegratedUI(){
    var body=q('itbl'),originalWrap=body&&body.closest('.tw'),card=originalWrap&&originalWrap.closest('.card'),head=card&&card.querySelector('.ch');
    if(!card||!head)return null;
    var bar=q('ph-expiry-top-filter');
    if(!bar){
      bar=document.createElement('div');bar.id='ph-expiry-top-filter';bar.className='expiry-top-filter';head.appendChild(bar);
    }
    var result=q('ph-expiry-integrated-results');
    if(!result){result=document.createElement('div');result.id='ph-expiry-integrated-results';result.className='tw';result.style.display='none';originalWrap.insertAdjacentElement('afterend',result)}
    return {bar:bar,result:result,originalWrap:originalWrap};
  }
  function renderPhExpiryIntegrated(){
    if(!q('pg-inv')||!window.CU||!['pharmacy','inpatient_supervisor'].includes(CU.role))return;
    var ui=phExpiryEnsureIntegratedUI();if(!ui)return;
    var view=window.phExpiryView||'inventory',rules=pharmacyExpiryRules(),depts=gd()||[];
    var rawSel=(window.phExpiryDeptIds||[]).map(String),noneSelected=rawSel.includes('__none__');
    var selectedIds=noneSelected?[]:phExpirySelectedDeptIds();
    var all=allDeptExpiryRows().filter(function(x){return selectedIds.includes(String(x.deptId))});
    var counts={all:all.length,urgent:0,near:0,expired:0};
    all.forEach(function(x){var st=phExpiryStatus(x.days,rules);if(st==='urgent')counts.urgent++;else if(st==='near')counts.near++;else if(st==='expired')counts.expired++});
    var selectedLabel=noneSelected?'No departments':(selectedIds.length===depts.length?'All departments':selectedIds.length+' departments');
    var deptChecks=depts.map(function(d){var checked=!noneSelected&&selectedIds.includes(String(d.id));return '<label class="expiry-dept-option"><input type="checkbox" '+(checked?'checked':'')+' onchange="phExpiryToggleDept(\''+esc(d.id)+'\',this.checked)"><span>'+esc(d.name)+'</span></label>'}).join('');
    ui.bar.innerHTML='<div class="expiry-filter-row">'+
      '<select class="psel expiry-view-select" onchange="phExpirySetView(this.value)"><option value="inventory" '+(view==='inventory'?'selected':'')+'>Medication list / قائمة الأدوية</option><option value="all" '+(view==='all'?'selected':'')+'>All expiry records ('+counts.all+')</option><option value="urgent" '+(view==='urgent'?'selected':'')+'>Urgent ('+counts.urgent+')</option><option value="near" '+(view==='near'?'selected':'')+'>Near expiry ('+counts.near+')</option><option value="expired" '+(view==='expired'?'selected':'')+'>Expired ('+counts.expired+')</option></select>'+
      '<details class="expiry-dept-picker" '+(view==='inventory'?'style="display:none"':'')+'><summary>Departments: '+selectedLabel+'</summary><div class="expiry-dept-menu"><div class="expiry-dept-actions"><button type="button" class="btn bg bxs" onclick="phExpirySelectAllDepartments()">All</button><button type="button" class="btn bg bxs" onclick="phExpiryClearDepartments()">Clear</button></div>'+deptChecks+'</div></details>'+
      '<button type="button" class="btn bg bsm expiry-rules-btn" '+(view==='inventory'?'style="display:none"':'')+' onclick="phExpiryEditRules()">⚙ Rules: urgent ≤ '+rules.urgentDays+'d · near ≤ '+rules.nearDays+'d</button></div>';
    if(view==='inventory'){ui.originalWrap.style.display='';ui.result.style.display='none';return}
    ui.originalWrap.style.display='none';ui.result.style.display='block';
    var rows=all.filter(function(x){var st=phExpiryStatus(x.days,rules);return view==='all'||st===view});
    ui.result.innerHTML='<table><thead><tr><th>Department</th><th>Medication</th><th>Strength</th><th>Qty</th><th>Expiry</th><th>Days</th><th>Status</th></tr></thead><tbody>'+rows.map(function(x){var st=phExpiryStatus(x.days,rules),label=st==='urgent'?'Urgent':st==='near'?'Near expiry':st==='expired'?'Expired':st==='normal'?'Normal':'Unknown',cls=st==='urgent'||st==='expired'?'exp-red':st==='near'?'exp-yellow':'';return '<tr class="'+(st==='urgent'||st==='expired'?'rha':st==='near'?'rhz':'')+'"><td>'+esc(x.dept)+'</td><td>'+esc(x.med)+'</td><td>'+esc(x.strength||'—')+'</td><td>'+esc(x.qty==null?'—':x.qty)+'</td><td>'+esc(fmtDate(x.date))+'</td><td class="'+cls+'">'+esc(x.days==null?'—':x.days)+'</td><td><span class="badge '+(st==='urgent'||st==='expired'?'brd':st==='near'?'byl':'bgr')+'">'+label+'</span></td></tr>'}).join('')+(rows.length?'':'<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--tx2)">No medicines match the selected filters.</td></tr>')+'</tbody></table>';
  }
  window.renderPhExpiryIntegrated=renderPhExpiryIntegrated;
})();

export {};
