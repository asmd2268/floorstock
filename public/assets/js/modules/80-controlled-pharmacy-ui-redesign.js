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

export {};
