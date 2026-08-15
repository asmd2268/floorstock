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

// --- Merged from 20-psychotropic-shared-list-v12.js (Phase 6 consolidation) ---
(function(){
  var PSYCHOTROPIC_SHARED_SEED=[{"moh":"545051836","nupco":"5114169900100","name":"AGOMELATINE 25MG","classification":"psychotropic","min":0,"max":0},{"moh":"545031410","nupco":"5114160100100","name":"AMITRIPTYLINE 25MG","classification":"psychotropic","min":0,"max":0},{"moh":"545031400","nupco":"5114160100200","name":"AMITRIPTYLINE 10MG","classification":"psychotropic","min":0,"max":0},{"moh":"545031589","nupco":"5114163400200","name":"ARIPIPRAZOLE 10MG","classification":"psychotropic","min":0,"max":0},{"moh":"545031382","nupco":"5114163400100","name":"ARIPIPRAZOLE 15MG","classification":"psychotropic","min":0,"max":0},{"moh":"545021061","nupco":"5112176600000","name":"ATOMOXETINE 10MG","classification":"psychotropic","min":0,"max":0},{"moh":"545071925","nupco":"5115160200000","name":"BENZTROPINE 2MG","classification":"psychotropic","min":0,"max":0},{"moh":"545031402","nupco":"5129340200000","name":"BUPROPION 150MG","classification":"psychotropic","min":0,"max":0},{"moh":"545031500","nupco":"5114179800200","name":"CHLORPROMAZINE 25MG","classification":"psychotropic","min":0,"max":0},{"moh":"545034510","nupco":"5114179800000","name":"CHLORPROMAZINE 50MG INJ","classification":"psychotropic","min":0,"max":0},{"moh":"545031631","nupco":"5129200400000","name":"CITALOPRAM 20MG","classification":"psychotropic","min":0,"max":0},{"moh":"545031430","nupco":"5114161600200","name":"CLOMIPRAMINE 10 MG","classification":"psychotropic","min":0,"max":0},{"moh":"545031435","nupco":"5114161600000","name":"CLOMIPRAMINE 25MG","classification":"psychotropic","min":0,"max":0},{"moh":"545031539","nupco":"5114171500100","name":"CLOZAPINE 100MG","classification":"psychotropic","min":0,"max":0},{"moh":"545031538","nupco":"5114171500200","name":"CLOZAPINE 25 MG","classification":"psychotropic","min":0,"max":0},{"moh":"545064880","nupco":"5115190300000","name":"DANTROLINE 25MG INJ","classification":"psychotropic","min":0,"max":0},{"moh":"545051830","nupco":"5114153900000","name":"DULOXETINE 60MG","classification":"psychotropic","min":0,"max":0},{"moh":"545031632","nupco":"5114163300000","name":"ESCITALOPRAM 10MG","classification":"psychotropic","min":0,"max":0},{"moh":"545034639","nupco":"5114161800100","name":"FLUPENTHIXOL 25MG INJ","classification":"psychotropic","min":0,"max":0},{"moh":"545031642","nupco":"5114160700100","name":"FLUVOXAMINE 100MG","classification":"psychotropic","min":0,"max":0},{"moh":"545031636","nupco":"5114160700000","name":"FLUVOXAMINE 50MG","classification":"psychotropic","min":0,"max":0},{"moh":"545034638","nupco":"5114161800000","name":"FLUOXETINE 20MG","classification":"psychotropic","min":0,"max":0},{"moh":"545034639","nupco":"5114161800100","name":"FLUOXETINE 20MG/5ML LIQUID","classification":"psychotropic","min":0,"max":0},{"moh":"545034615","nupco":"5114170200600","name":"HALOPERIDOL 5MG INJ","classification":"psychotropic","min":0,"max":0},{"moh":"545031600","nupco":"5114170200700","name":"HALOPERIDOL 1.5MG","classification":"psychotropic","min":0,"max":0},{"moh":"545034618","nupco":"5114170200000","name":"HALOPERIDOL 50MG INJ","classification":"psychotropic","min":0,"max":0},{"moh":"545031605","nupco":"5114170200100","name":"HALOPERIDOL 5MG TAB","classification":"psychotropic","min":0,"max":0},{"moh":"545031450","nupco":"5114162100000","name":"IMIPRAMINE 10 MG","classification":"psychotropic","min":0,"max":0},{"moh":"545031455","nupco":"5114162100100","name":"IMIPRAMINE 25MG","classification":"psychotropic","min":0,"max":0},{"moh":"545031470","nupco":"5114162300000","name":"MAPROTILINE 25MG","classification":"psychotropic","min":0,"max":0},{"moh":"545071926","nupco":"5114154100000","name":"MEMANTINE 10MG","classification":"psychotropic","min":0,"max":0},{"moh":"545031635","nupco":"5114160400000","name":"MIRTAZAPINE 30MG","classification":"psychotropic","min":0,"max":0},{"moh":"545031379","nupco":"5114170300500","name":"OLANZAPINE 10MG TAB","classification":"psychotropic","min":0,"max":0},{"moh":"545031372","nupco":"5114170300000","name":"OLANZAPINE 5MG DIS","classification":"psychotropic","min":0,"max":0},{"moh":"545031378","nupco":"5114170300600","name":"OLANZAPINE 5MG TAB","classification":"psychotropic","min":0,"max":0},{"moh":"545031542","nupco":"5133200300400","name":"PALIPERIDONE 3MG","classification":"psychotropic","min":0,"max":0},{"moh":"545031546","nupco":"5133200300000","name":"PALIPERIDONE 100MG INJ","classification":"psychotropic","min":0,"max":0},{"moh":"545031543","nupco":"5133200300100","name":"PALIPERIDONE 150MG INJ","classification":"psychotropic","min":0,"max":0},{"moh":"545031353","nupco":"5114172200100","name":"QUETIAPINE 100MG","classification":"psychotropic","min":0,"max":0},{"moh":"545031354","nupco":"5114172200200","name":"QUETIAPINE 200MG","classification":"psychotropic","min":0,"max":0},{"moh":"545031356","nupco":"5114172200300","name":"QUETIAPINE 300MG","classification":"psychotropic","min":0,"max":0},{"moh":"545031527","nupco":"5114170400200","name":"RISPERIDONE 25 MG INJ","classification":"psychotropic","min":0,"max":0},{"moh":"545031536","nupco":"5114170400100","name":"RISPERIDONE 2MG TAB","classification":"psychotropic","min":0,"max":0},{"moh":"545031529","nupco":"5114170400300","name":"RISPERIDONE 37.5 MG INJ","classification":"psychotropic","min":0,"max":0},{"moh":"545031534","nupco":"5114170400400","name":"RISPERIDONE 4MG TAB","classification":"psychotropic","min":0,"max":0},{"moh":"545031525","nupco":"5114170400600","name":"RISPERIDONE 50 MG INJ","classification":"psychotropic","min":0,"max":0},{"moh":"545032550","nupco":"5114170400500","name":"RISPERIDONE 1MG SYRUP","classification":"psychotropic","min":0,"max":0},{"moh":"545031385","nupco":"5133210300000","name":"SULPRIDE 200MG","classification":"psychotropic","min":0,"max":0},{"moh":"545031531","nupco":"5133210300100","name":"SULPRIDE 50MG","classification":"psychotropic","min":0,"max":0},{"moh":"545031580","nupco":"5114179900300","name":"TRIFLUPHENAZINE 1MG","classification":"psychotropic","min":0,"max":0},{"moh":"545031590","nupco":"5114179900100","name":"TRIFLUPHENAZINE 5MG","classification":"psychotropic","min":0,"max":0},{"moh":"545031358","nupco":"5114163600100","name":"VENLAFAXINE 150MG","classification":"psychotropic","min":0,"max":0},{"moh":"545031641","nupco":"5114163600200","name":"VENLAFAXINE 75 MG","classification":"psychotropic","min":0,"max":0},{"moh":"","nupco":"5115151500000","name":"RIVASTIGMINE PATCHES 4.6MG/24H","classification":"psychotropic","min":0,"max":0},{"moh":"","nupco":"5115151500100","name":"RIVASTIGMINE PATCHES 9.5MG/24H","classification":"psychotropic","min":0,"max":0},{"moh":"","nupco":"5112176600200","name":"ATOMOXETINE 25MG","classification":"psychotropic","min":0,"max":0},{"moh":"","nupco":"5114153900100","name":"DULOXETINE 30MG","classification":"psychotropic","min":0,"max":0},{"moh":"","nupco":"5110230200000","name":"AMANTADINE 100MG TAB","classification":"psychotropic","min":0,"max":0},{"moh":"","nupco":"5114153800100","name":"DONEPEZIL 10MG TABLET","classification":"psychotropic","min":0,"max":0}];
  window.PSYCHOTROPIC_SHARED_SEED=PSYCHOTROPIC_SHARED_SEED;
})();

// --- Merged from 69-r676-narcotic-catalog-restore-20260728.js (Phase 6 consolidation) ---
(function(){
  'use strict';
  var RESTORE_KEY='narcotic_restore_from_backup_20260728_v1';
  var DEPT_ENRICH_KEY='controlled_dept_list_name_enrich_v1';
  var NARCOTIC_CATALOG=[{"min":0,"nupco":"","name":"ALPRAZOLAM .5 MG","max":0,"id":"cm_545031626","classification":"narcotic","moh":"545031626"},{"nupco":"5115160400200","min":0,"name":"BENZOHXOLE 2 MG","max":0,"classification":"narcotic","id":"cm_545071900","moh":"545071900"},{"id":"cm_549551905","classification":"narcotic","max":0,"moh":"549551905","min":0,"nupco":"5136150100000","name":"CHLORAL HYDRATE 100MG/1ML"},{"moh":"545051785","id":"cm_545051785","classification":"narcotic","max":0,"name":"CLONAZEPAM 2 MG TAB","nupco":"5114150200200","min":0},{"moh":"545054595","max":0,"classification":"narcotic","id":"cm_545054595","name":"CLONAZEPAM 2.5 MG DROP","nupco":"5114150200300","min":0},{"moh":"545064870","classification":"narcotic","id":"cm_545064870","max":0,"name":"DIAZEPAM 10 MG INJ","min":0,"nupco":"5114192000300"},{"moh":"545031370","max":0,"id":"cm_545031370","classification":"narcotic","name":"DIAZEPAM 5 MG TAB","nupco":"5114192000500","min":0},{"max":0,"classification":"narcotic","id":"cm_545031365","moh":"545031365","nupco":"5114192000000","min":0,"name":"DIAZEPAM 5 MG TUBE"},{"classification":"narcotic","id":"cm_544094615","max":0,"moh":"544094615","min":0,"nupco":"5139171700000","name":"EPHIDRINE 50 MG"},{"moh":"545024065","max":0,"id":"cm_545024065","classification":"narcotic","name":"FENTANYL 100 MCG","min":0,"nupco":"5137230500300"},{"nupco":"5137230500400","min":0,"name":"FENTANYL 500 MCG","classification":"narcotic","id":"cm_545024064","max":0,"moh":"545024064"},{"name":"GABAPENTINE 300","nupco":"5114151700000","min":0,"moh":"545051784","classification":"narcotic","id":"cm_545051784","max":0},{"nupco":"5127220400000","min":0,"name":"KETAMINE 10 mg/1ml/20 ml","classification":"narcotic","id":"cm_545044670","max":0,"moh":"545044670"},{"min":0,"nupco":"5114191600100","name":"LORAZEPAM 1 MG T","max":0,"classification":"narcotic","id":"cm_545031350","moh":"545031350"},{"moh":"545021064","max":0,"classification":"narcotic","id":"cm_545021064","name":"METHYPHENEDATE 36 MG","nupco":"5114261800100","min":0},{"name":"METHYPHENEDATE 18 MG","min":0,"nupco":"5114261800200","moh":"545021065","id":"cm_545021065","classification":"narcotic","max":0},{"min":0,"nupco":"5114154200100","name":"MIDAZOLAM 15 MG","max":0,"id":"cm_545034625","classification":"narcotic","moh":"545034625"},{"max":0,"classification":"narcotic","id":"cm_545024051","moh":"545024051","min":0,"nupco":"5114220600300","name":"MORPHINE 10 MG"},{"name":"PETHIDINE 100 MG","min":0,"nupco":"5137180300000","moh":"545024060","max":0,"id":"cm_545024060","classification":"narcotic"},{"max":0,"id":"cm_545024055","classification":"narcotic","moh":"545024055","min":0,"nupco":"5137180300100","name":"PETHIDINE 50 MG"},{"nupco":"5114150500000","min":0,"name":"PHENO 10 MG TAB","classification":"narcotic","id":"cm_545051700","max":0,"moh":"545051700"},{"name":"PHENO 100 MG TAB","nupco":"5114150500900","min":0,"moh":"545051715","max":0,"classification":"narcotic","id":"cm_545051715"},{"nupco":"5114150500700","min":0,"name":"PHENO 200 MG INJ","id":"cm_545054730","classification":"narcotic","max":0,"moh":"545054730"},{"id":"cm_545054725","classification":"narcotic","max":0,"moh":"545054725","min":0,"nupco":"5114150500800","name":"PHENO 40-60 MG INJ"},{"nupco":"5114150500200","min":0,"name":"PHENO 50 MG TAB","id":"cm_545051710","classification":"narcotic","max":0,"moh":"545051710"},{"moh":"545051812","id":"cm_545051812","classification":"narcotic","max":0,"name":"PREGABALINE 150 MG","min":0,"nupco":"5114153400000"},{"name":"PREGABALINE 75 MG","min":0,"nupco":"5114153400100","moh":"545051816","id":"cm_545051816","classification":"narcotic","max":0},{"name":"PROCYCLIDINE 5 MG","min":0,"nupco":"5115160300000","moh":"545071902","max":0,"classification":"narcotic","id":"cm_545071902"},{"moh":"545044658","max":0,"classification":"narcotic","id":"cm_545044658","name":"PROPOFOL","nupco":"5114294100000","min":0},{"id":"cm_545046696","classification":"narcotic","max":0,"moh":"545046696","min":0,"nupco":"5114294200100","name":"SEVOFLORAN"},{"name":"THIOPENTAL 500 MG","min":0,"nupco":"5114292100000","moh":"545044650","max":0,"id":"cm_545044650"},{"min":0,"nupco":"5137160100300","name":"TRAMADOL 100 MG INJ","id":"cm_545024089","classification":"narcotic","max":0,"moh":"545024089"},{"id":"cm_545021091","classification":"narcotic","max":0,"moh":"545021091","min":0,"nupco":"5137160100100","name":"TRAMADOL 50 MG C"}];
  var NARCOTIC_STOCK={"cm_545031370":{"source":"Recovered controlled shared catalogue seed","qty":722,"actualQty":722,"batches":[{"qty":722,"lot":"","expiry":"2029-01-31"}],"updatedAt":"2026-07-25T17:31:54.223Z"},"cm_545044650":{"source":"Recovered controlled shared catalogue seed","qty":0,"actualQty":0,"batches":[],"updatedAt":"2026-07-25T17:31:54.223Z"},"cm_545021064":{"updatedAt":"2026-07-25T17:31:54.223Z","batches":[],"qty":0,"actualQty":0,"source":"Recovered controlled shared catalogue seed"},"cm_545051812":{"batches":[{"expiry":"2027-08-31","lot":"","qty":1679}],"source":"Recovered controlled shared catalogue seed","qty":1679,"actualQty":1679,"updatedAt":"2026-07-25T17:31:54.223Z"},"cm_545024051":{"updatedAt":"2026-07-25T17:31:54.223Z","actualQty":49,"qty":49,"source":"Recovered controlled shared catalogue seed","batches":[{"expiry":"2028-06-30","qty":49,"lot":""}]},"cm_545024089":{"batches":[{"lot":"","qty":4,"expiry":"2029-05-31"}],"source":"Recovered controlled shared catalogue seed","qty":4,"actualQty":4,"updatedAt":"2026-07-25T17:31:54.223Z"},"cm_545054595":{"updatedAt":"2026-07-25T17:31:54.223Z","qty":0,"actualQty":0,"source":"Recovered controlled shared catalogue seed","batches":[]},"cm_545044670":{"source":"Recovered controlled shared catalogue seed","qty":0,"actualQty":0,"batches":[],"updatedAt":"2026-07-25T17:31:54.223Z"},"cm_545024064":{"updatedAt":"2026-07-25T17:31:54.223Z","qty":162,"actualQty":162,"source":"Recovered controlled shared catalogue seed","batches":[{"expiry":"2027-12-31","qty":162,"lot":""}]},"cm_545024060":{"batches":[{"expiry":"2027-12-31","qty":96,"lot":""}],"qty":96,"actualQty":96,"source":"Recovered controlled shared catalogue seed","updatedAt":"2026-07-25T17:31:54.223Z"},"cm_545051816":{"batches":[{"qty":970,"lot":"","expiry":"2028-08-31"}],"qty":970,"actualQty":970,"source":"Recovered controlled shared catalogue seed","updatedAt":"2026-07-25T17:31:54.223Z"},"cm_545031626":{"source":"Recovered controlled shared catalogue seed","actualQty":0,"qty":0,"batches":[],"updatedAt":"2026-07-25T17:31:54.223Z"},"cm_545051700":{"updatedAt":"2026-07-25T17:31:54.223Z","batches":[{"qty":1384,"lot":"","expiry":"2027-03-30"}],"qty":1384,"actualQty":1384,"source":"Recovered controlled shared catalogue seed"},"cm_549551905":{"updatedAt":"2026-07-25T17:31:54.223Z","source":"Recovered controlled shared catalogue seed","actualQty":0,"qty":0,"batches":[]},"cm_545021065":{"qty":0,"actualQty":0,"source":"Recovered controlled shared catalogue seed","batches":[],"updatedAt":"2026-07-25T17:31:54.223Z"},"cm_545021091":{"qty":737,"actualQty":737,"source":"Recovered controlled shared catalogue seed","batches":[{"expiry":"2026-12-31","qty":737,"lot":""}],"updatedAt":"2026-07-25T17:31:54.223Z"},"cm_545024055":{"updatedAt":"2026-07-25T17:31:54.223Z","qty":171,"actualQty":171,"source":"Recovered controlled shared catalogue seed","batches":[{"lot":"","qty":171,"expiry":"2026-12-31"}]},"cm_545051710":{"qty":264,"actualQty":264,"source":"Recovered controlled shared catalogue seed","batches":[{"expiry":"2027-03-30","qty":264,"lot":""}],"updatedAt":"2026-07-25T17:31:54.223Z"},"cm_545024065":{"actualQty":479,"qty":479,"source":"Recovered controlled shared catalogue seed","batches":[{"expiry":"2027-12-31","qty":479,"lot":""}],"updatedAt":"2026-07-25T17:31:54.223Z"},"cm_545051784":{"batches":[{"expiry":"31/11/2028","lot":"","qty":1850}],"qty":1850,"actualQty":1850,"source":"Recovered controlled shared catalogue seed","updatedAt":"2026-07-25T17:31:54.223Z"},"cm_545051785":{"qty":787,"actualQty":787,"source":"Recovered controlled shared catalogue seed","batches":[{"expiry":"31/06/2028","qty":787,"lot":""}],"updatedAt":"2026-07-25T17:31:54.223Z"},"cm_545071900":{"source":"Recovered controlled shared catalogue seed","qty":438,"actualQty":438,"batches":[{"expiry":"31/09/2028","lot":"","qty":438}],"updatedAt":"2026-07-25T17:31:54.223Z"},"cm_545064870":{"batches":[{"lot":"","qty":34,"expiry":"31/11/2028"}],"qty":34,"actualQty":34,"source":"Recovered controlled shared catalogue seed","updatedAt":"2026-07-25T17:31:54.223Z"},"cm_545044658":{"qty":0,"actualQty":0,"source":"Recovered controlled shared catalogue seed","batches":[],"updatedAt":"2026-07-25T17:31:54.223Z"},"cm_545046696":{"updatedAt":"2026-07-25T17:31:54.223Z","batches":[],"source":"Recovered controlled shared catalogue seed","qty":0,"actualQty":0},"cm_545054730":{"batches":[{"expiry":"31/11/2027","lot":"","qty":48}],"actualQty":48,"qty":48,"source":"Recovered controlled shared catalogue seed","updatedAt":"2026-07-25T17:31:54.223Z"},"cm_545071902":{"source":"Recovered controlled shared catalogue seed","qty":555,"actualQty":555,"batches":[{"qty":555,"lot":"","expiry":"2028-08-31"}],"updatedAt":"2026-07-25T17:31:54.223Z"},"cm_545034625":{"source":"Recovered controlled shared catalogue seed","actualQty":175,"qty":175,"batches":[{"lot":"","qty":175,"expiry":"2027-03-31"}],"updatedAt":"2026-07-25T17:31:54.223Z"},"cm_545031365":{"updatedAt":"2026-07-25T17:31:54.223Z","batches":[],"source":"Recovered controlled shared catalogue seed","actualQty":0,"qty":0},"cm_544094615":{"updatedAt":"2026-07-25T17:31:54.223Z","batches":[],"actualQty":0,"qty":0,"source":"Recovered controlled shared catalogue seed"},"cm_545051715":{"updatedAt":"2026-07-25T17:31:54.223Z","qty":1196,"actualQty":1196,"source":"Recovered controlled shared catalogue seed","batches":[{"expiry":"2027-01-31","qty":1196,"lot":""}]},"cm_545054725":{"updatedAt":"2026-07-25T17:31:54.223Z","batches":[],"source":"Recovered controlled shared catalogue seed","qty":0,"actualQty":0},"cm_545031350":{"updatedAt":"2026-07-25T17:31:54.223Z","source":"Recovered controlled shared catalogue seed","qty":115,"actualQty":115,"batches":[{"qty":100,"lot":"","expiry":"31/04/2028"},{"expiry":"31/09/2028","qty":15,"lot":""}]}};

  window.restoreNarcoticCatalogFromBackup=async function(){
    if(!window.S||!S.ready)return false;
    if(S.g(RESTORE_KEY))return false;
    var role=String((window.CU&&CU.role)||'');
    if(!(window.CU&&(CU.master===true||role==='pharmacy'||role==='controlled_pharmacy')))return false;
    var liveCatalog=(typeof ctlCatalog==='function'?ctlCatalog():S.g('controlled_catalog'))||[];
    var liveStock=Object.assign({},(typeof ctlPharmacy==='function'?ctlPharmacy():S.g('controlled_pharmacy_stock'))||{});
    var existingNarcIds=new Set(liveCatalog.filter(function(m){return String(m.classification||'').toLowerCase()==='narcotic'}).map(function(m){return m.id}));
    var toAdd=NARCOTIC_CATALOG.filter(function(m){return !existingNarcIds.has(m.id)});
    var stockToAdd={};
    Object.keys(NARCOTIC_STOCK).forEach(function(id){if(!Object.prototype.hasOwnProperty.call(liveStock,id))stockToAdd[id]=NARCOTIC_STOCK[id];});
    await S.s(RESTORE_KEY,{done:true,restoredAt:new Date().toISOString(),added:toAdd.length});
    if(!toAdd.length&&!Object.keys(stockToAdd).length)return false;
    var mergedCatalog=liveCatalog.concat(toAdd);
    var mergedStock=Object.assign({},liveStock,stockToAdd);
    await S.s('controlled_catalog',mergedCatalog);
    await S.s('controlled_pharmacy_stock',mergedStock);
    console.log('[narcotic-restore] Restored',toAdd.length,'narcotic catalog entries.');
    if(typeof window.toast==='function')toast('Narcotic medicines restored ('+toAdd.length+') ✓','succ');
    return true;
  };

  window.enrichAllDeptListNames=async function(){
    if(!window.S||!S.ready)return false;
    if(S.g(DEPT_ENRICH_KEY))return false;
    var role=String((window.CU&&CU.role)||'');
    if(!(window.CU&&(CU.master===true||role==='pharmacy'||role==='controlled_pharmacy')))return false;
    var depts=(typeof gd==='function'?gd():[]);
    if(!depts.length)return false;
    var cat=(typeof ctlCatalog==='function'?ctlCatalog():[]);
    if(!cat.length)return false;
    var catMap={};cat.forEach(function(m){catMap[m.id]=m;});
    var enriched=0;
    for(var i=0;i<depts.length;i++){
      var dept=depts[i],deptId=String(dept.id||'');
      if(!deptId)continue;
      var list=S.g('controlled_dept_list_'+deptId);
      if(!Array.isArray(list)||!list.length)continue;
      var needsEnrich=list.some(function(row){return !row.name&&catMap[row.medId]&&catMap[row.medId].name;});
      if(!needsEnrich)continue;
      var enriched_list=list.map(function(row){
        if(row.name)return row;
        var m=catMap[row.medId]||{};
        if(!m.name)return row;
        return Object.assign({},row,{name:m.name,moh:m.moh||row.moh||'',nupco:m.nupco||row.nupco||'',classification:m.classification||row.classification||'narcotic'});
      });
      await S.s('controlled_dept_list_'+deptId,enriched_list);
      enriched++;
    }
    await S.s(DEPT_ENRICH_KEY,{done:true,at:new Date().toISOString(),depts:enriched});
    if(enriched>0)console.log('[dept-enrich] Embedded medicine names in',enriched,'dept lists.');
    return enriched>0;
  };
})();


// --- Merged from 21-r664-psychotropic-pharmacy-stock-import-20260728.js (Phase 6 consolidation) ---
(function(){
  'use strict';
  var IMPORT_KEY='psychotropic_pharmacy_stock_import_r664_20260728_v2_safe_psych_only';
  var SOURCE_FILE='متوفر الادوية النفسية.xlsx';
  var DATA=[{"name":"AGOMELATINE 25MG","sourceName":"AGOMELATINE 25MG","matchMoh":"545051836","matchNupco":"5114169900100","moh":"545051836","nupco":"5114169900100","qty":1000,"batches":[{"qty":1000,"expiry":"2026-12-31","lot":""}]},{"name":"AMITRIPTYLINE 25MG","sourceName":"AMITRIPTYLINE 25MG","matchMoh":"545031410","matchNupco":"5114160100100","moh":"545031410","nupco":"5114160100100","qty":1000,"batches":[{"qty":1000,"expiry":"2027-04-30","lot":""}]},{"name":"AMITRIPTYLINE 10MG","sourceName":"AMITRIPTYLINE 10MG","matchMoh":"545031400","matchNupco":"5114160100200","moh":"545031400","nupco":"5114160100200","qty":1000,"batches":[{"qty":1000,"expiry":"2027-04-30","lot":""}]},{"name":"ARIPIPRAZOLE 10MG","sourceName":"ARIPIPRAZOLE 10MG","matchMoh":"545031589","matchNupco":"5114163400200","moh":"545031589","nupco":"5114163400200","qty":1000,"batches":[{"qty":1000,"expiry":"2027-02-28","lot":""}]},{"name":"ARIPIPRAZOLE 15MG","sourceName":"ARIPIPRAZOLE 15MG","matchMoh":"545031382","matchNupco":"5114163400100","moh":"545031382","nupco":"5114163400100","qty":1000,"batches":[{"qty":1000,"expiry":"2027-11-30","lot":""}]},{"name":"ATOMOXETINE 10MG","sourceName":"ATOMOXETINE10MG","matchMoh":"545021061","matchNupco":"5112176600000","moh":"545021061","nupco":"5112176600000","qty":1000,"batches":[{"qty":1000,"expiry":"2027-12-31","lot":""}]},{"name":"BENZTROPINE 2MG","sourceName":"BENZTROPINE 2MG","matchMoh":"545071925","matchNupco":"5115160200000","moh":"545071925","nupco":"5115160200000","qty":1000,"batches":[{"qty":1000,"expiry":"2028-11-30","lot":""}]},{"name":"BUPROPION 150MG","sourceName":"BUPROPION 150MG","matchMoh":"545031402","matchNupco":"5129340200000","moh":"545031402","nupco":"5129340200000","qty":1000,"batches":[{"qty":1000,"expiry":"2027-08-31","lot":""}]},{"name":"CHLORPROMAZINE 25MG","sourceName":"CHLORPROMAZINE 25mg","matchMoh":"545031500","matchNupco":"5114179800200","moh":"545031500","nupco":"5114179800200","qty":0,"batches":[]},{"name":"CHLORPROMAZINE 50MG INJ","sourceName":"CHLORPROMAZINE 50mg INJ","matchMoh":"545034510","matchNupco":"5114179800000","moh":"545034510","nupco":"5114179800000","qty":0,"batches":[]},{"name":"CITALOPRAM 20MG","sourceName":"CITALOPRAM 20MG","matchMoh":"545031631","matchNupco":"5129200400000","moh":"545031631","nupco":"5129200400000","qty":0,"batches":[]},{"name":"CLOMIPRAMINE 10 MG","sourceName":"CLOMIPRAMINE 10 MG","matchMoh":"545031430","matchNupco":"5114161600200","moh":"545031430","nupco":"5114161600200","qty":0,"batches":[]},{"name":"CLOMIPRAMINE 25MG","sourceName":"CLOMIPRAMINE 25MG","matchMoh":"545031435","matchNupco":"5114161600000","moh":"545031435","nupco":"5114161600000","qty":2000,"batches":[{"qty":1000,"expiry":"2027-03-31","lot":""},{"qty":1000,"expiry":"2027-06-30","lot":""}]},{"name":"CLOZAPINE 100MG","sourceName":"CLOZAPINE 100MG","matchMoh":"545031539","matchNupco":"5114171500100","moh":"545031539","nupco":"5114171500100","qty":0,"batches":[]},{"name":"CLOZAPINE 25 MG","sourceName":"CLOZAPINE 25 MG","matchMoh":"545031538","matchNupco":"5114171500200","moh":"545031538","nupco":"5114171500200","qty":1000,"batches":[{"qty":1000,"expiry":"2027-05-31","lot":""}]},{"name":"DANTROLINE 25MG INJ","sourceName":"DANTROLINE 25MG INJ","matchMoh":"545064880","matchNupco":"5115190300000","moh":"545064880","nupco":"5115190300000","qty":60,"batches":[{"qty":60,"expiry":"2028-04-30","lot":""}]},{"name":"DULOXETINE 60MG","sourceName":"DULOXETINE 60MG","matchMoh":"545051830","matchNupco":"5114153900000","moh":"545051830","nupco":"5114153900000","qty":1000,"batches":[{"qty":1000,"expiry":"2027-02-28","lot":""}]},{"name":"ESCITALOPRAM 10MG","sourceName":"ESCITALOPRAM 10MG","matchMoh":"545031632","matchNupco":"5114163300000","moh":"545034640","nupco":"5114179900500","qty":1000,"batches":[{"qty":1000,"expiry":"2027-06-30","lot":""}]},{"name":"FLUPENTHIXOL 25MG INJ","sourceName":"FLUPENTHIXOL 20MG INJ","matchMoh":"545034639","matchNupco":"5114161800100","moh":"545034639","nupco":"5114161800100","qty":0,"batches":[]},{"name":"FLUVOXAMINE 100MG","sourceName":"FLUVOXAMINE 100MG","matchMoh":"545031642","matchNupco":"5114160700100","moh":"545031642","nupco":"5114160700100","qty":1000,"batches":[{"qty":1000,"expiry":"2027-05-31","lot":""}]},{"name":"FLUVOXAMINE 50MG","sourceName":"FLUVOXAMINE 50MG","matchMoh":"545031636","matchNupco":"5114160700000","moh":"545031636","nupco":"5114160700000","qty":1000,"batches":[{"qty":1000,"expiry":"2027-06-30","lot":""}]},{"name":"FLUOXETINE 20MG","sourceName":"FLUXETINE 20MG","matchMoh":"545034638","matchNupco":"5114161800000","moh":"545034638","nupco":"5114161800000","qty":1000,"batches":[{"qty":1000,"expiry":"2028-09-30","lot":""}]},{"name":"FLUOXETINE 20MG/5ML LIQUID","sourceName":"FLUXETINE 20MG/5 ML LIQUID","matchMoh":"545034639","matchNupco":"5114161800100","moh":"545034639","nupco":"5114161800100","qty":12,"batches":[{"qty":12,"expiry":"2026-09-30","lot":""}]},{"name":"HALOPERIDOL 5MG INJ","sourceName":"HALOORIDOLE 5MG INJ","matchMoh":"545034615","matchNupco":"5114170200600","moh":"545034615","nupco":"5114170200600","qty":0,"batches":[]},{"name":"HALOPERIDOL 1.5MG","sourceName":"HALOPRIDOLE 1.5MG","matchMoh":"545031600","matchNupco":"5114170200700","moh":"545031600","nupco":"5114170200700","qty":1000,"batches":[{"qty":1000,"expiry":"2029-12-31","lot":""}]},{"name":"HALOPERIDOL 50MG INJ","sourceName":"HALOPRIDOLE 50MG INJ","matchMoh":"545034618","matchNupco":"5114170200000","moh":"545034618","nupco":"5114170200000","qty":0,"batches":[]},{"name":"HALOPERIDOL 5MG TAB","sourceName":"HALOPRIDOLE 5MG TAB","matchMoh":"545031605","matchNupco":"5114170200100","moh":"545031605","nupco":"5114170200100","qty":0,"batches":[]},{"name":"IMIPRAMINE 10 MG","sourceName":"IMIPRAMINE 10 MG","matchMoh":"545031450","matchNupco":"5114162100000","moh":"545031450","nupco":"5114162100000","qty":0,"batches":[]},{"name":"IMIPRAMINE 25MG","sourceName":"IMIPRAMINE 25MG","matchMoh":"545031455","matchNupco":"5114162100100","moh":"545031455","nupco":"5114162100100","qty":0,"batches":[]},{"name":"MAPROTILINE 25MG","sourceName":"MAPROTILINE  25MG","matchMoh":"545031470","matchNupco":"5114162300000","moh":"545031470","nupco":"5114162300000","qty":0,"batches":[]},{"name":"MEMANTINE 10MG","sourceName":"MEMANTINE 10MG","matchMoh":"545071926","matchNupco":"5114154100000","moh":"545071926","nupco":"5114154100000","qty":300,"batches":[{"qty":300,"expiry":"2027-12-31","lot":""}]},{"name":"MIRTAZAPINE 30MG","sourceName":"MIRTAZAPINE 30MG","matchMoh":"545031635","matchNupco":"5114160400000","moh":"545031635","nupco":"5114160400000","qty":1000,"batches":[{"qty":1000,"expiry":"2027-10-31","lot":""}]},{"name":"OLANZAPINE 10MG TAB","sourceName":"OLANZAPINE 10MG TAB","matchMoh":"545031379","matchNupco":"5114170300500","moh":"545031379","nupco":"5114170300500","qty":0,"batches":[]},{"name":"OLANZAPINE 5MG DIS","sourceName":"OLANZAPINE 5mg DIS","matchMoh":"545031372","matchNupco":"5114170300000","moh":"545031372","nupco":"5114170300000","qty":0,"batches":[]},{"name":"OLANZAPINE 5MG TAB","sourceName":"OLANZAPINE 5MG TAB","matchMoh":"545031378","matchNupco":"5114170300600","moh":"545031378","nupco":"5114170300600","qty":60,"batches":[{"qty":60,"expiry":"2027-04-30","lot":""}]},{"name":"PALIPERIDONE 3MG","sourceName":"PALIPERIDONE 3MG","matchMoh":"545031542","matchNupco":"5133200300400","moh":"545031542","nupco":"5133200300400","qty":0,"batches":[]},{"name":"PALIPERIDONE 100MG INJ","sourceName":"PALPRIDONE 100MG INJ","matchMoh":"545031546","matchNupco":"5133200300000","moh":"545031546","nupco":"5133200300000","qty":200,"batches":[{"qty":200,"expiry":"2027-08-31","lot":""}]},{"name":"PALIPERIDONE 150MG INJ","sourceName":"PALPRIDONE 150MG INJ","matchMoh":"545031543","matchNupco":"5133200300100","moh":"545031543","nupco":"5133200300100","qty":200,"batches":[{"qty":200,"expiry":"2027-05-31","lot":""}]},{"name":"QUETIAPINE 100MG","sourceName":"QUTEAPINE 100MG","matchMoh":"545031353","matchNupco":"5114172200100","moh":"545031353","nupco":"5114172200100","qty":1000,"batches":[{"qty":1000,"expiry":"2028-11-30","lot":""}]},{"name":"QUETIAPINE 200MG","sourceName":"QUTEAPINE 200MG","matchMoh":"545031354","matchNupco":"5114172200200","moh":"545031354","nupco":"5114172200200","qty":1000,"batches":[{"qty":1000,"expiry":"2027-09-30","lot":""}]},{"name":"QUETIAPINE 300MG","sourceName":"QUTEAPINE 300MG","matchMoh":"545031356","matchNupco":"5114172200300","moh":"545031356","nupco":"5114172200300","qty":0,"batches":[]},{"name":"RISPERIDONE 25 MG INJ","sourceName":"RISPERIDONE 25 MG inj","matchMoh":"545031527","matchNupco":"5114170400200","moh":"545031527","nupco":"5114170400200","qty":0,"batches":[]},{"name":"RISPERIDONE 2MG TAB","sourceName":"RISPERIDONE 2MG TAB","matchMoh":"545031536","matchNupco":"5114170400100","moh":"545031536","nupco":"5114170400100","qty":1000,"batches":[{"qty":1000,"expiry":"2027-12-31","lot":""}]},{"name":"RISPERIDONE 37.5 MG INJ","sourceName":"RISPERIDONE 37.5 MG inj","matchMoh":"545031529","matchNupco":"5114170400300","moh":"545031529","nupco":"5114170400300","qty":0,"batches":[]},{"name":"RISPERIDONE 4MG TAB","sourceName":"RISPERIDONE 4MG TAB","matchMoh":"545031534","matchNupco":"5114170400400","moh":"545031534","nupco":"5114170400400","qty":1000,"batches":[{"qty":1000,"expiry":"2028-05-31","lot":""}]},{"name":"RISPERIDONE 50 MG INJ","sourceName":"RISPERIDONE 50 MG inj","matchMoh":"545031525","matchNupco":"5114170400600","moh":"545031525","nupco":"5114170400600","qty":5,"batches":[{"qty":5,"expiry":"2027-02-28","lot":""}]},{"name":"RISPERIDONE 1MG SYRUP","sourceName":"RISPREDONE 1MG SYP","matchMoh":"545032550","matchNupco":"5114170400500","moh":"545032550","nupco":"5114170400500","qty":1000,"batches":[{"qty":1000,"expiry":"2027-02-28","lot":""}]},{"name":"SULPRIDE 200MG","sourceName":"SULPRIDE 200MG","matchMoh":"545031385","matchNupco":"5133210300000","moh":"545031385","nupco":"5133210300000","qty":1000,"batches":[{"qty":1000,"expiry":"2027-06-30","lot":""}]},{"name":"SULPRIDE 50MG","sourceName":"SULPRIDE 50MG","matchMoh":"545031531","matchNupco":"5133210300100","moh":"545031531","nupco":"5133210300100","qty":1000,"batches":[{"qty":1000,"expiry":"2027-11-30","lot":""}]},{"name":"TRIFLUPHENAZINE 1MG","sourceName":"TRIFLUPHENAZINE 1MG","matchMoh":"545031580","matchNupco":"5114179900300","moh":"545031580","nupco":"5114179900300","qty":0,"batches":[]},{"name":"TRIFLUPHENAZINE 5MG","sourceName":"TRIFLUPHENAZINE 5MG","matchMoh":"545031590","matchNupco":"5114179900100","moh":"545031590","nupco":"5114179900100","qty":0,"batches":[]},{"name":"VENLAFAXINE 150MG","sourceName":"VENLAFAXINE 150MG","matchMoh":"545031358","matchNupco":"5114163600100","moh":"545031358","nupco":"5114163600100","qty":2000,"batches":[{"qty":1000,"expiry":"2027-03-31","lot":""},{"qty":1000,"expiry":"2027-07-31","lot":""}]},{"name":"VENLAFAXINE 75 MG","sourceName":"VENLAFAXINE 75 MG","matchMoh":"545031641","matchNupco":"5114163600200","moh":"545031641","nupco":"5114163600200","qty":0,"batches":[]},{"name":"RIVASTIGMINE PATCHES 4.6MG/24H","sourceName":"RIVASTIGMINE PATCHES 4.6MG/24H","matchMoh":"","matchNupco":"5115151500000","moh":"","nupco":"5115151500000","qty":0,"batches":[]},{"name":"RIVASTIGMINE PATCHES 9.5MG/24H","sourceName":"RIVASTIGMINE PATCHES 9.5MG/24H","matchMoh":"","matchNupco":"5115151500100","moh":"","nupco":"5115151500100","qty":200,"batches":[{"qty":200,"expiry":"2026-08-31","lot":""}]},{"name":"ATOMOXETINE 25MG","sourceName":"Atomoxetine 25mg","matchMoh":"","matchNupco":"5112176600200","moh":"","nupco":"5112176600200","qty":1000,"batches":[{"qty":1000,"expiry":"2027-08-31","lot":""}]},{"name":"DULOXETINE 30MG","sourceName":"DULOXETINE 30MG","matchMoh":"","matchNupco":"5114153900100","moh":"","nupco":"5114153900100","qty":0,"batches":[]},{"name":"AMANTADINE 100MG TAB","sourceName":"AMANTADINE 100MG TAB","matchMoh":"","matchNupco":"5110230200000","moh":"","nupco":"5110230200000","qty":1000,"batches":[{"qty":1000,"expiry":"2027-12-31","lot":""}]},{"name":"DONEPEZIL 10MG TABLET","sourceName":"DONEPEZIL 10MG TABLET","matchMoh":"","matchNupco":"5114153800100","moh":"","nupco":"5114153800100","qty":1000,"batches":[{"qty":1000,"expiry":"2027-06-30","lot":""}]}];

  function norm(v){
    return String(v==null?'':v).trim().toLowerCase()
      .replace(/\s+/g,' ')
      .replace(/[^a-z0-9\u0600-\u06ff]+/g,'');
  }
  function code(v){return String(v==null?'':v).replace(/[^0-9]/g,'')}
  function canApply(){
    var u=window.CU||{},r=String(u.role||'');
    return !!(u.master===true||r==='pharmacy'||r==='controlled_pharmacy');
  }
  function sourceCodeIsUnique(field,value){
    value=code(value);if(!value)return false;
    return DATA.filter(function(row){return code(row[field])===value}).length===1;
  }
  function findMedicine(catalog,src){
    var byName=catalog.find(function(m){return norm(m.name)===norm(src.name)});
    if(byName)return byName;
    var oldMoh=code(src.matchMoh),oldNupco=code(src.matchNupco);
    return catalog.find(function(m){
      return (oldMoh&&sourceCodeIsUnique('matchMoh',oldMoh)&&code(m.moh||m.mohCode)===oldMoh)||
             (oldNupco&&sourceCodeIsUnique('matchNupco',oldNupco)&&code(m.nupco||m.nupcoCode)===oldNupco);
    })||null;
  }
  async function applyPsychotropicPharmacyStockR664(){
    if(!window.S||!S.ready||!canApply())return false;
    if(S.g(IMPORT_KEY))return false;

    var catalog=typeof window.ctlCatalog==='function'
      ?(ctlCatalog()||[]).map(function(m){return Object.assign({},m)})
      :[];
    var pharmacy=typeof window.ctlPharmacy==='function'
      ?Object.assign({},ctlPharmacy()||{})
      :{};
    var stamp=typeof window.nowISO==='function'?nowISO():new Date().toISOString();
    var created=0,updated=0,totalQty=0;
    var originalNonPsychStockKeys=Object.keys(pharmacy).filter(function(id){
      var med=catalog.find(function(item){return String(item&&item.id||'')===String(id)});
      return !med||String(med.classification||'').toLowerCase()!=='psychotropic';
    });

    DATA.forEach(function(src,index){
      var med=findMedicine(catalog,src);
      /* Never convert or overwrite an existing narcotic/restricted catalogue item.
         If a code/name collision exists, create a separate psychotropic record. */
      if(med&&String(med.classification||'').toLowerCase()&&String(med.classification||'').toLowerCase()!=='psychotropic')med=null;
      if(!med){
        var baseId=(typeof window.ctlKey==='function'
          ?ctlKey(src.matchMoh||src.moh,src.matchNupco||src.nupco,src.name)
          :'psy_r664')+'_r664_'+String(index+1);
        var id=baseId,idSuffix=1;
        while(catalog.some(function(item){return String(item&&item.id||'')===String(id)})){id=baseId+'_'+idSuffix;idSuffix++;}
        med={id:id,name:src.name,moh:src.moh||'',nupco:src.nupco||'',classification:'psychotropic',min:0,max:0};
        catalog.push(med);created++;
      }else{
        if(src.moh)med.moh=src.moh;
        if(src.nupco)med.nupco=src.nupco;
        med.classification='psychotropic';
        updated++;
      }

      var stock=Object.assign({},pharmacy[med.id]||{});
      var qty=Number(src.qty)||0;
      stock.name=med.name||src.name;
      stock.moh=src.moh||med.moh||'';
      stock.nupco=src.nupco||med.nupco||'';
      stock.classification='psychotropic';
      stock.qty=qty;
      stock.actualQty=qty;
      stock.batches=qty>0?(src.batches||[]).map(function(b,i){
        return {
          id:'r664psy_'+String(index+1)+'_'+String(i+1),
          batchId:'r664psy_'+String(index+1)+'_'+String(i+1),
          qty:Number(b.qty)||0,
          expiry:String(b.expiry||'').slice(0,10),
          lot:String(b.lot||'')
        };
      }):[];
      stock.updatedAt=stamp;
      stock.updatedBy=(window.CU&&(CU.email||CU.username||CU.id||CU.uid))||'R6.64 import';
      stock.source='R6.64 psychotropic pharmacy balance import';
      stock.sourceFile=SOURCE_FILE;
      stock.sourceName=src.sourceName||src.name;
      pharmacy[med.id]=stock;
      totalQty+=qty;
    });
    /* No deletion or filtering is performed. Existing narcotic/restricted stock keys are preserved. */
    var missingProtected=originalNonPsychStockKeys.filter(function(id){return !Object.prototype.hasOwnProperty.call(pharmacy,id)});
    if(missingProtected.length)throw new Error('Safety stop: non-psychotropic pharmacy stock would be removed');

    /* Direct state writes avoid department-custody setters and do not modify any controlled_dept_list_* document. */
    await S.s('controlled_catalog',catalog);
    await S.s('controlled_pharmacy_stock',pharmacy);
    await S.s(IMPORT_KEY,{
      applied:true,appliedAt:stamp,sourceFile:SOURCE_FILE,
      rows:DATA.length,totalQty:totalQty,createdCatalogRows:created,updatedCatalogRows:updated,
      departmentCustodyTouched:false,nonPsychotropicStockPreserved:true
    });
    if(typeof window.auditAction==='function'){
      try{await Promise.resolve(auditAction('controlled_pharmacy_psychotropic_balance_import',{
        sourceFile:SOURCE_FILE,rows:DATA.length,totalQty:totalQty,
        createdCatalogRows:created,updatedCatalogRows:updated,
        departmentCustodyTouched:false,nonPsychotropicStockPreserved:true
      }))}catch(e){console.warn('Psychotropic import audit warning',e)}
    }
    if(typeof window.renderControlled==='function'){
      var active=document.querySelector('.pg.on');
      if(active&&active.id==='pg-controlled')window.renderControlled();
    }
    if(typeof window.toast==='function')toast('Psychotropic pharmacy balance updated from the approved file ✓','succ');
    return true;
  }
  window.applyPsychotropicPharmacyStockR664=applyPsychotropicPharmacyStockR664;
})();

export {};
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
    if(typeof isMasterActual==='function'&&isMasterActual()){var mb=document.createElement('button');mb.className='nb';mb.id='master-nav-switch';mb.innerHTML=window.MASTER_EFFECTIVE?'🧪 تغيير الدور الحالي':'🔄 الانتقال بين الأدوار';mb.onclick=openMasterRoleSwitch;nav.appendChild(mb)}
    items.forEach(function(x){var b=document.createElement('button');b.className='nb';b.innerHTML=x[1];b.dataset.pg=x[0];b.onclick=function(){showPg(this.dataset.pg)};nav.appendChild(b)});
    if((typeof isMasterActual==='function'&&isMasterActual())||(CU&&rRole==='pharmacy')){var zb=document.createElement('button');zb.id='zebra-labels-nav';zb.className='nb';zb.dataset.pg='pg-zebra-labels';zb.innerHTML='🦓 Zebra Labels <small style="opacity:.72">Beta</small>';zb.onclick=function(){showPg('pg-zebra-labels')};nav.appendChild(zb)}
    ccUpdateBadges();
    if(typeof window.scheduleNavigationRefresh==='function')window.scheduleNavigationRefresh('');
    if(typeof window.enforceRoleUi==='function')window.enforceRoleUi();
  };

  function ccUpdateBadges(){
    var open=openReports().length, reqRows=(typeof gr==='function'?(gr()||[]):[]), badgeRole=window.fsEffectiveRole?window.fsEffectiveRole():String((window.CU&&CU.role)||'');
    if(badgeRole==='outpatient_pharmacy_supervisor'&&window.fsOutpatientDeptId){var badgeDept=window.fsOutpatientDeptId();reqRows=reqRows.filter(function(r){return String(r.deptId)===String(badgeDept)})}
    var req=reqRows.filter(function(r){return r.status==='pending'}).length;
    var cb=document.querySelector('[data-pg="pg-crashcart"]'),rb=document.querySelector('[data-pg="pg-reqs"]');
    if(cb){cb.querySelectorAll('.cc-badge').forEach(function(x){x.remove()});if(open)cb.insertAdjacentHTML('beforeend','<span class="cc-badge">'+open+'</span>')}
    if(rb){rb.querySelectorAll('.cc-badge').forEach(function(x){x.remove()});if(req)rb.insertAdjacentHTML('beforeend','<span class="cc-badge">'+req+'</span>')}
  }
  window.ccUpdateBadges=ccUpdateBadges;

  window.renderCrashDashboardSummary=function(){var d=q('dstats');if(d&&isPharmacyCrashRole()){
    var open=openReports().length,reqRows=(typeof gr==='function'?(gr()||[]):[]),badgeRole=window.fsEffectiveRole?window.fsEffectiveRole():String((window.CU&&CU.role)||'');
    if(badgeRole==='outpatient_pharmacy_supervisor'&&window.fsOutpatientDeptId){var badgeDept=window.fsOutpatientDeptId();reqRows=reqRows.filter(function(r){return String(r.deptId)===String(badgeDept)})}
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
  function ccResponseRowPlan(row){var unavailable=!!(row.querySelector('.ccc-unavailable')||{}).checked;return {itemId:row.dataset.id,reportedQty:n(row.dataset.reported),unavailable:unavailable,action:unavailable?'add':((row.querySelector('.ccc-action')||{}).value||'replace'),sourceExpiry:unavailable?'':ccDateKey((row.querySelector('.ccc-source-exp')||{}).value),qty:unavailable?0:n((row.querySelector('.ccc-qty')||{}).value),expiry:unavailable?'':ccDateKey((row.querySelector('.ccc-exp')||{}).value)}}
  // Marking a row "not currently available" always means qty=0 / action=add — no
  // source expiry required and closing is never blocked by a missing item; the
  // cart simply closes with that item left below standard / out of stock.
  window.ccCrashUnavailableToggled=function(checkbox){var row=checkbox.closest('tr');if(!row)return;var action=row.querySelector('.ccc-action'),source=row.querySelector('.ccc-source-exp'),qty=row.querySelector('.ccc-qty'),expiry=row.querySelector('.ccc-exp'),checked=checkbox.checked;if(action)action.disabled=checked;if(source)source.disabled=checked||(action&&action.value==='add');if(qty){qty.disabled=checked;if(checked)qty.value=0}if(expiry){expiry.disabled=checked;if(checked)expiry.value=''}ccCrashResponsePreview()};
  window.ccCrashResponsePreview=function(){var id=val('ccc-report-id'),r=(crashReports()||[]).find(function(x){return String(x.id)===String(id)}),c=r&&crashCart(r.cartId),alreadyDeducted=!!(r&&r.inventoryDeductedAtReport),messages=[],valid=true;document.querySelectorAll('#ccc-items tr').forEach(function(row){var p=ccResponseRowPlan(row),it=c&&(c.items||[]).find(function(x){return String(x.id)===String(p.itemId)}),current=ccItemPresent(it),standard=ccItemStandard(it),remove=alreadyDeducted?0:(p.action==='replace'?p.reportedQty:0),result=current-remove+p.qty,error='';if(!p.unavailable&&!alreadyDeducted&&p.action==='replace'&&!p.sourceExpiry)error='Choose the exact old expiry to deduct.';else if(!p.unavailable&&!alreadyDeducted&&p.action==='replace'&&ccExpiryQuantity(it,p.sourceExpiry)<p.reportedQty)error='Old expiry quantity is insufficient.';else if(p.qty<0)error='Replacement quantity cannot be negative.';else if(!p.unavailable&&p.qty>0&&!p.expiry)error='Every replacement quantity requires an expiry date.';else if(result<0)error='Resulting quantity cannot be negative.';else if(result>standard+0.000001)error='Result '+result+' exceeds standard '+standard+'.';row.classList.toggle('crash-response-error',!!error);var out=row.querySelector('.ccc-row-result');if(out)out.textContent=error||(p.unavailable?'Marked not available — final '+result+' / '+standard:('Final '+result+' / '+standard+(alreadyDeducted?' · reported quantity already deducted':'')));if(error){valid=false;messages.push((it&&it.name||'Medicine')+': '+error)}});var box=q('ccc-validation');if(box){box.className='crash-response-validation '+(valid?'ok':'err');box.innerHTML=valid?'✓ All rows are within the approved standard quantity. / جميع الكميات ضمن العدد المعتمد.':esc(messages.join(' | '))}var save=q('ccc-save-btn');if(save)save.disabled=!valid;return valid};
  window.ccCrashActionChanged=function(select){var row=select.closest('tr'),source=row&&row.querySelector('.ccc-source-exp');if(source)source.disabled=select.value==='add';ccCrashResponsePreview()};
  window.crashCloseReport=function(reportId){
    if(!canManageCrashCart())return toast('No permission','err');var r=(crashReports()||[]).find(function(x){return String(x.id)===String(reportId)});if(!r)return;var c=crashCart(r.cartId);if(!c)return toast('Crash Cart not found.','err');
    q('ccc-report-id').value=reportId;q('ccc-new-seal').value=r.newSeal||'';q('ccc-note').value=r.pharmacyNote||'';
    q('ccc-items').innerHTML=(r.consumed||[]).map(function(x){var it=(c.items||[]).find(function(z){return String(z.id)===String(x.itemId)})||{},saved=(r.replacements||[]).find(function(z){return String(z.itemId)===String(x.itemId)})||{},savedUnavailable=!!saved.unavailable,defaultAction=saved.action||(ccDatedBatches(it).length?'replace':'add'),source=saved.sourceExpiry||x.reportedExpiry||'',qty=saved.qty!=null?n(saved.qty):n(x.qty),expiry=saved.expiry||'';return '<tr data-id="'+esc(x.itemId)+'" data-reported="'+n(x.qty)+'"><td><b>'+esc(x.name)+'</b><div class="fhint">'+esc(x.strength||'')+'</div><label class="ccc-unavailable-label"><input type="checkbox" class="ccc-unavailable" '+(savedUnavailable?'checked':'')+' onchange="ccCrashUnavailableToggled(this)"> Not currently available / غير متوفر حالياً</label><div class="ccc-row-result"></div></td><td>'+n(x.qty)+(x.reportedExpiry?'<div class="fhint">Reported expiry: '+esc(x.reportedExpiry)+'</div>':'<div class="fhint">Expiry not reported</div>')+'</td><td><div class="crash-current-batches">'+ccBatchSummary(it)+'</div><div class="fhint">Present '+ccItemPresent(it)+' / Standard '+ccItemStandard(it)+'</div></td><td><select class="ccc-action" '+(savedUnavailable?'disabled':'')+' onchange="ccCrashActionChanged(this)"><option value="replace" '+(defaultAction==='replace'?'selected':'')+'>Replace from old expiry / استبدال من تاريخ قديم</option><option value="add" '+(defaultAction==='add'?'selected':'')+'>Add only / إضافة فقط</option></select></td><td><select class="ccc-source-exp" '+(defaultAction==='add'||savedUnavailable?'disabled':'')+' onchange="ccCrashResponsePreview()"><option value="">Select old expiry...</option>'+ccExpiryOptions(it,source,false)+'</select></td><td><input class="ccc-qty" type="number" min="0" step="any" value="'+(savedUnavailable?0:qty)+'" '+(savedUnavailable?'disabled':'')+' oninput="ccCrashResponsePreview()"></td><td><input class="ccc-exp" type="date" value="'+esc(savedUnavailable?'':expiry)+'" '+(savedUnavailable?'disabled':'')+' onchange="ccCrashResponsePreview()"></td></tr>'}).join('');
    var h=q('ccx-close-actor');if(h){var u=window.CU||{},name=typeof actualActorName==='function'?actualActorName():(u.name||u.username||u.email||'Unknown'),user=u.username||u.email||u.id||'Unknown';h.innerHTML='<b>Closing pharmacist / الصيدلي الذي سيغلق العربة:</b><br>'+esc(name)+'<br><b>System user / مستخدم النظام:</b> '+esc(user)}OM('mcc-close');setTimeout(ccCrashResponsePreview,0);
  };
  window.ccSavePharmacyResponse=async function(){
    var id=val('ccc-report-id'),originalReports=crashReports(),originalCarts=crashCarts(),rs=JSON.parse(JSON.stringify(originalReports||[])),carts=JSON.parse(JSON.stringify(originalCarts||[])),r=rs.find(function(x){return String(x.id)===String(id)});if(!r)return;var c=carts.find(function(x){return String(x.id)===String(r.cartId)});if(!c)return toast('Crash Cart not found.','err');var seal=val('ccc-new-seal').trim();if(!seal)return toast('Enter the new seal number / أدخل رقم القفل الجديد.','err');if(!ccUniqueSealAllowed(seal,c.id,id))return toast('The new seal number is already used. Enter a unique seal.','err');if(!ccCrashResponsePreview())return toast('Correct the highlighted replacement rows first.','err');
    var replacements=[],alreadyDeducted=!!r.inventoryDeductedAtReport;
    try{document.querySelectorAll('#ccc-items tr').forEach(function(row){var p=ccResponseRowPlan(row),it=(c.items||[]).find(function(x){return String(x.id)===String(p.itemId)});if(!it)throw new Error('A reported medicine no longer exists in the cart.');var current=ccItemPresent(it),standard=ccItemStandard(it),removed=0;if(!alreadyDeducted&&p.action==='replace'){if(!p.sourceExpiry)throw new Error(it.name+': choose the old expiry.');removed=p.reportedQty;ccRemoveFromExpiry(it,p.sourceExpiry,removed)}if(p.qty>0){if(!p.expiry)throw new Error(it.name+': replacement expiry is required.');ccAddDatedQuantity(it,p.expiry,p.qty,id)}var result=current-removed+p.qty;if(result<0||result>standard+0.000001)throw new Error(it.name+': final quantity '+result+' exceeds the allowed range 0–'+standard+'.');it.present=result;it.stockStatus=result<=0?'out_of_stock':result<standard?'partial':'available';it.updatedAt=nowISO();it.updatedBy=actualActorName();replacements.push({itemId:p.itemId,name:it.name||'',action:alreadyDeducted?'replace_after_report_deduction':p.action,unavailable:p.unavailable,sourceExpiry:alreadyDeducted?'':p.sourceExpiry,reportedQty:p.reportedQty,removedQty:removed,qty:p.qty,expiry:p.expiry,resultingPresent:result,standardQty:standard})});
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

// --- Merged from 15-controlled-print-pages.js (Phase 6 consolidation) ---
(function(){

  window.ctlPrintHTML=function(title,body,preparedWindow){
    var w=preparedWindow||window.open('','_blank');
    if(!w){toast('Allow pop-ups to print.','err');return null}
    try{
      w.document.open();
      w.document.write('<!doctype html><html dir="ltr"><head><meta charset="utf-8"><title>'+esc(title)+'</title><style>'+
        '@page{size:A4 landscape;margin:5mm}'+
        '*{box-sizing:border-box}html,body{width:100%;height:auto!important;max-height:none!important;margin:0;padding:0;overflow:visible!important;direction:ltr!important}'+
        'body{font-family:Arial,Tahoma,sans-serif;color:#111;text-align:left;padding:0}'+
        '.print-page{width:100%;height:auto!important;max-height:none!important;max-width:none;margin:0;overflow:visible!important;transform:none!important}'+
        'h1,h2{text-align:center;margin:2px 0;direction:ltr}'+
        '.head{display:grid;grid-template-columns:105px minmax(0,1fr) 105px;align-items:center;width:100%;gap:8px;break-inside:avoid;page-break-inside:avoid}'+
        '.logo{max-width:95px;max-height:68px}.qr{width:88px;height:88px}'+
        '.printed-date{text-align:left;font-size:9px;margin:4px 0 6px;direction:ltr}'+
        'table{width:100%!important;max-width:none;border-collapse:collapse;table-layout:auto;margin:6px 0 0;direction:ltr!important;page-break-inside:auto;break-inside:auto}'+
        'thead{display:table-header-group}tbody{display:table-row-group}tfoot{display:table-footer-group}'+
        'tr{page-break-inside:avoid!important;break-inside:avoid!important}'+
        'th,td{border:1px solid #333;padding:4px 5px;text-align:left!important;font-size:9.5px;line-height:1.25;direction:ltr!important;vertical-align:middle}'+
        'th{background:#e8eef7;font-weight:700}'+
        'th:first-child,td:first-child{width:30px;text-align:center!important}'+
        '.med{width:auto!important;min-width:230px;text-align:left!important;font-weight:bold}'+
        '.expiry{text-align:left!important;line-height:1.45;white-space:normal;overflow:visible!important}'+
        '.signs{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin-top:16px;direction:ltr;page-break-inside:avoid!important;break-inside:avoid!important}'+
        '.sig{text-align:center;border-top:1px solid #222;padding-top:5px;margin-top:24px;page-break-inside:avoid;break-inside:avoid}'+
        '.electronic-cert{margin-top:10px;padding:6px;border:1px solid #333;text-align:center;font-size:9px;font-weight:bold;page-break-inside:avoid;break-inside:avoid}'+
        '.by{font-size:8px;text-align:center;margin-top:8px;page-break-inside:avoid;break-inside:avoid}.handover{margin:8px 0;padding:7px;border:1px solid #444;page-break-inside:avoid;break-inside:avoid}.ltr{direction:ltr!important}'+
        '@media print{html,body,.print-page{height:auto!important;max-height:none!important;overflow:visible!important}table{page-break-inside:auto!important;break-inside:auto!important}thead{display:table-header-group!important}tr{page-break-inside:avoid!important;break-inside:avoid!important}}'+
        '</style></head><body><div class="print-page">'+officialPrintHeaderHTML()+body+'<div class="electronic-cert">هذه القائمة معتمدة ومصدقة إلكترونيًا ولا تحتاج إلى ختم<br>This list is electronically approved and certified and does not require a stamp.</div><div class="by">By Ali Abudahash</div></div><script>(function(){var fired=false;function go(){if(fired)return;fired=true;try{window.focus()}catch(e){}window.print()}window.addEventListener("load",function(){setTimeout(go,250)},{once:true});setTimeout(go,1800)})();<\/script></body></html>');
      w.document.close();
      return w
    }catch(err){
      try{w.document.open();w.document.write('<!doctype html><html><body style="font-family:Arial;padding:24px"><h2>Print failed / تعذر تجهيز الطباعة</h2><pre>'+String(err&&err.message||err).replace(/[&<>]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;'}[c]})+'</pre></body></html>');w.document.close()}catch(e){}
      throw err
    }
  };
})();


// --- Merged from 06-zebra-label-printing.js (Phase 6 consolidation) ---
(function(){
  var ZDB_KEY='asdhealth_zebra_label_db_v12',ZPR_KEY='asdhealth_zebra_printer_v12';
  var zdb=[],zprinters=[],zebraDevice=null;
  const E=globalThis.E;
  function clean(v){return String(v==null?'':v).trim()}
  function htmlSafe(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
  function safeNum(v,d){v=Number(v);return isFinite(v)&&v>0?v:d}
  function allowed(){return !!(window.CU&&(CU.role==='pharmacy'||CU.master===true))}
  function message(t,kind){var x=E('zebra-message');if(x){x.textContent=t||'';x.style.color=kind==='err'?'var(--rdl)':kind==='ok'?'var(--gnl)':'var(--tx2)'}}
  function status(t,cls){var x=E('zebra-status');if(x){x.textContent=t;x.className='badge '+(cls||'bgr')}}
  function loadDB(){try{zdb=JSON.parse(localStorage.getItem(ZDB_KEY)||'[]');if(!Array.isArray(zdb))zdb=[]}catch(e){zdb=[]}renderDB()}
  function saveDB(){localStorage.setItem(ZDB_KEY,JSON.stringify(zdb));renderDB()}
  function keyOf(x){return (clean(x.name)+'|'+clean(x.strength)).toLowerCase()}
  function zebraCollectMed(map,name,strength,source,expiry){name=clean(name);strength=clean(strength);if(!name)return;var k=(name+'|'+strength).toLowerCase(),x=map[k]||{name:name,strength:strength,sources:[],expiries:[]};if(source&&x.sources.indexOf(source)<0)x.sources.push(source);if(expiry&&x.expiries.indexOf(expiry)<0)x.expiries.push(expiry);map[k]=x}
  function extractAll(source){
    var map={};
    try{
      if(source==='all'||source==='inventory'){
        var depts=typeof gd==='function'?(gd()||[]):[];
        depts.forEach(function(d){(getMeds(d.id)||[]).forEach(function(m){zebraCollectMed(map,m.name||m.medication,m.strength||m.dose,'Inventory: '+(d.name||d.id),(m.expiry||''));(m.batches||[]).forEach(function(b){zebraCollectMed(map,m.name||m.medication,m.strength||m.dose,'Inventory: '+(d.name||d.id),b.expiry||b.date)})})});
      }
      if(source==='all'||source==='controlled'){
        try{(typeof ctlCatalog==='function'?(ctlCatalog()||[]):[]).forEach(function(m){zebraCollectMed(map,m.name,m.strength||m.dose,'Controlled medicines','')})}catch(e){}
        try{(gd()||[]).forEach(function(d){(ctlDeptList(d.id)||[]).forEach(function(x){var m=ctlMedicine(x.medId)||{};(x.batches||[]).forEach(function(b){zebraCollectMed(map,m.name,m.strength||m.dose,'Controlled custody: '+(d.name||d.id),b.expiry)});zebraCollectMed(map,m.name,m.strength||m.dose,'Controlled custody: '+(d.name||d.id),'')})})}catch(e){}
      }
      if(source==='all'||source==='crash'){
        try{(crashCarts()||[]).forEach(function(c){(c.items||[]).forEach(function(it){zebraCollectMed(map,it.name,it.strength,'Crash Cart: '+(c.name||c.deptName||c.id||''),'');(it.batches||[]).forEach(function(b){zebraCollectMed(map,it.name,it.strength,'Crash Cart: '+(c.name||c.deptName||c.id||''),b.expiry)})})})}catch(e){}
      }
    }catch(e){console.error('Zebra import extraction',e)}
    return Object.keys(map).map(function(k){return map[k]}).sort(function(a,b){return a.name.localeCompare(b.name)})
  }
  window.zebraImportDatabase=function(){if(!allowed())return;var src=E('zebra-source')?E('zebra-source').value:'all',items=extractAll(src);var merged={};zdb.forEach(function(x){merged[keyOf(x)]=x});items.forEach(function(x){var k=keyOf(x),old=merged[k];if(old){x.sources.forEach(function(v){if(old.sources.indexOf(v)<0)old.sources.push(v)});x.expiries.forEach(function(v){if(old.expiries.indexOf(v)<0)old.expiries.push(v)})}else merged[k]=x});zdb=Object.keys(merged).map(function(k){return merged[k]}).sort(function(a,b){return a.name.localeCompare(b.name)});saveDB();message('Imported '+items.length+' medicines from '+src+'. Database now contains '+zdb.length+' unique medicines.','ok');if(typeof toast==='function')toast('Zebra label database refreshed: '+zdb.length+' medicines','succ')};
  function renderDB(){var c=E('zebra-db-count');if(c)c.textContent=zdb.length+' medicines';window.zebraFilterMedicines()}
  window.zebraFilterMedicines=function(){var sel=E('zebra-med');if(!sel)return;var q=clean(E('zebra-search')&&E('zebra-search').value).toLowerCase(),cur=sel.value;sel.innerHTML='';zdb.filter(function(x){return !q||(x.name+' '+x.strength).toLowerCase().indexOf(q)>=0}).forEach(function(x){var o=document.createElement('option');o.value=keyOf(x);o.textContent=x.name+(x.strength?' — '+x.strength:'');sel.appendChild(o)});if(cur)sel.value=cur};
  window.zebraSelectMedicine=function(){var k=E('zebra-med').value,x=zdb.find(function(v){return keyOf(v)===k});if(!x)return;E('zebra-name').value=x.name||'';E('zebra-strength').value=x.strength||'';if(E('zebra-expiry')&&!E('zebra-expiry').value&&x.expiries&&x.expiries.length)E('zebra-expiry').value=x.expiries.slice().sort()[0];zebraUpdatePreview()};
  window.zebraTemplateChanged=function(){var show=E('zebra-template').value==='name_strength_expiry';E('zebra-expiry-wrap').style.display=show?'block':'none';zebraUpdatePreview()};
  function mmToPx(mm){return Math.max(80,Math.round(mm*6))}
  window.zebraUpdatePreview=function(){var w=safeNum(E('zebra-width')&&E('zebra-width').value,50),h=safeNum(E('zebra-height')&&E('zebra-height').value,25),box=E('zebra-preview');if(!box)return;var name=clean(E('zebra-name').value)||'MEDICINE NAME',strength=clean(E('zebra-strength').value)||'Strength',expiry=E('zebra-expiry').value,footer=clean(E('zebra-footer').value),hasExp=E('zebra-template').value==='name_strength_expiry';box.style.width=mmToPx(w)+'px';box.style.height=mmToPx(h)+'px';var ratio=Math.min(1.6,Math.max(.65,w/50)),base=Math.max(15,Math.min(44,Math.floor((h*1.5)*ratio)));box.innerHTML='<div class="zl-name" style="font-size:'+base+'px">'+(typeof esc==='function'?esc(name):name)+'</div><div class="zl-strength" style="font-size:'+Math.max(13,Math.round(base*.68))+'px">'+(typeof esc==='function'?esc(strength):strength)+'</div>'+(hasExp?'<div class="zl-expiry" style="font-size:'+Math.max(12,Math.round(base*.55))+'px">EXP '+(expiry||'DD/MM/YYYY')+'</div>':'')+(footer?'<div class="zl-footer" style="font-size:'+Math.max(10,Math.round(base*.38))+'px">'+(typeof esc==='function'?esc(footer):footer)+'</div>':'');E('zebra-size-label').textContent=w+' × '+h+' mm'};
  function zplEscape(v){return clean(v).replace(/[\\^~]/g,' ')}
  function dots(mm,dpi){return Math.max(1,Math.round(mm*dpi/25.4))}
  function buildZPL(test){var wmm=safeNum(E('zebra-width').value,50),hmm=safeNum(E('zebra-height').value,25),dpi=safeNum(E('zebra-dpi').value,203),W=dots(wmm,dpi),H=dots(hmm,dpi),copies=Math.min(500,Math.max(1,Math.floor(safeNum(E('zebra-copies').value,1)))),name=test?'ZEBRA TEST LABEL':zplEscape(E('zebra-name').value),strength=test?(wmm+' x '+hmm+' mm · '+dpi+' dpi'):zplEscape(E('zebra-strength').value),hasExp=!test&&E('zebra-template').value==='name_strength_expiry',expiry=hasExp?zplEscape(E('zebra-expiry').value):'',footer=test?'ASDHealth v1.2':zplEscape(E('zebra-footer').value),margin=Math.max(8,Math.round(W*.035)),usable=W-margin*2,nameH=Math.max(24,Math.round(H*(hasExp?.28:.38))),strH=Math.max(20,Math.round(H*.21)),expH=Math.max(18,Math.round(H*.18)),y=Math.round(H*.09),z='^XA^CI28^PW'+W+'^LL'+H+'^LH0,0';z+='^FO'+margin+','+y+'^A0N,'+nameH+','+Math.max(18,Math.round(nameH*.72))+'^FB'+usable+',2,0,C,0^FD'+name+'^FS';y+=Math.round(H*.36);z+='^FO'+margin+','+y+'^A0N,'+strH+','+Math.max(15,Math.round(strH*.72))+'^FB'+usable+',1,0,C,0^FD'+strength+'^FS';if(hasExp){y+=Math.round(H*.22);z+='^FO'+margin+','+y+'^A0N,'+expH+','+Math.max(14,Math.round(expH*.72))+'^FB'+usable+',1,0,C,0^FDEXP '+expiry+'^FS'}if(footer){z+='^FO'+margin+','+Math.round(H*.88)+'^A0N,'+Math.max(14,Math.round(H*.09))+','+Math.max(10,Math.round(H*.06))+'^FB'+usable+',1,0,C,0^FD'+footer+'^FS'}z+='^PQ'+copies+',0,1,N^XZ';return z}
  function installLocalBrowserPrintShim(base){window.BrowserPrint={getLocalDevices:function(ok,fail,type){fetch(base+'/available').then(function(r){if(!r.ok)throw new Error('HTTP '+r.status);return r.json()}).then(function(data){var list=Array.isArray(data)?data:(data.printer||data.printers||data.devices||[]);list=list.map(function(d){d.deviceType=d.deviceType||d.type||'printer';d.send=function(payload,success,error){fetch(base+'/write',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({device:d,data:payload})}).then(function(r){if(!r.ok)throw new Error('HTTP '+r.status);return r.text()}).then(function(){if(success)success()}).catch(function(e){if(error)error(e)})};return d});if(type)list=list.filter(function(d){return d.deviceType===type||type==='printer'});ok(list)}).catch(function(e){if(fail)fail(e)})}};return true}
  function tryLoadBrowserPrint(cb){if(window.BrowserPrint)return cb(true);var urls=['http://localhost:9100/BrowserPrint-3.1.250.min.js','https://localhost:9101/BrowserPrint-3.1.250.min.js'];var i=0;function probeShim(){fetch('http://localhost:9100/available').then(function(r){if(!r.ok)throw new Error();installLocalBrowserPrintShim('http://localhost:9100');cb(true)}).catch(function(){fetch('https://localhost:9101/available').then(function(r){if(!r.ok)throw new Error();installLocalBrowserPrintShim('https://localhost:9101');cb(true)}).catch(function(){cb(false)})})}function next(){if(window.BrowserPrint)return cb(true);if(i>=urls.length)return probeShim();var sc=document.createElement('script');sc.src=urls[i++];sc.onload=function(){if(window.BrowserPrint)cb(true);else next()};sc.onerror=next;document.head.appendChild(sc)}next()}
  window.zebraRefreshPrinters=function(){if(!allowed())return;status('Detecting…','byl');message('Searching for Zebra printers connected to this device…');tryLoadBrowserPrint(function(ok){if(!ok){status('Browser Print unavailable','brd');message('Zebra Browser Print is not available. Install/run Zebra Browser Print, then use Detect printers again. Browser print and ZPL download remain available.','err');return}BrowserPrint.getLocalDevices(function(devs){zprinters=(devs||[]).filter(function(d){return !d.deviceType||d.deviceType==='printer'});var sel=E('zebra-printer'),saved=localStorage.getItem(ZPR_KEY)||'';sel.innerHTML='';if(!zprinters.length){sel.innerHTML='<option value="">No Zebra printers detected</option>';status('No printer','brd');message('No Zebra printer was detected. Check USB/network connection and Zebra Browser Print.','err');return}zprinters.forEach(function(d,i){var o=document.createElement('option');o.value=String(i);o.textContent=d.name||d.uid||('Zebra printer '+(i+1));sel.appendChild(o)});var idx=zprinters.findIndex(function(d){return (d.uid||d.name)===saved});sel.value=String(idx>=0?idx:0);zebraDevice=zprinters[Number(sel.value)];status(zprinters.length+' printer'+(zprinters.length>1?'s':''),'bgn');message('Detected '+zprinters.length+' Zebra printer(s). Select the printer to use.','ok');sel.onchange=function(){zebraDevice=zprinters[Number(sel.value)]||null;if(zebraDevice)localStorage.setItem(ZPR_KEY,zebraDevice.uid||zebraDevice.name||'')}} ,function(e){status('Detection failed','brd');message('Printer detection failed: '+(e&&e.message?e.message:e),'err')},'printer')})};
  function browserPrint(){var w=safeNum(E('zebra-width').value,50),h=safeNum(E('zebra-height').value,25),copies=Math.min(500,Math.max(1,Math.floor(safeNum(E('zebra-copies').value,1)))),name=htmlSafe(clean(E('zebra-name').value)),strength=htmlSafe(clean(E('zebra-strength').value)),hasExp=E('zebra-template').value==='name_strength_expiry',expiry=htmlSafe(E('zebra-expiry').value),footer=htmlSafe(clean(E('zebra-footer').value)),win=window.open('','_blank');if(!win)return message('Allow pop-ups to print labels.','err');var labels='';for(var i=0;i<copies;i++)labels+='<section class="label"><div class="name">'+name+'</div><div class="strength">'+strength+'</div>'+(hasExp?'<div class="expiry">EXP '+expiry+'</div>':'')+(footer?'<div class="footer">'+footer+'</div>':'')+'</section>';win.document.write('<!doctype html><html><head><meta charset="utf-8"><style>@page{size:'+w+'mm '+h+'mm;margin:0}*{box-sizing:border-box}html,body{margin:0;padding:0;font-family:Arial,sans-serif}.label{width:'+w+'mm;height:'+h+'mm;page-break-after:always;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:1.5mm;overflow:hidden}.name{font-size:'+Math.max(12,Math.min(34,h*1.05))+'pt;font-weight:800;line-height:1}.strength{font-size:'+Math.max(10,Math.min(24,h*.65))+'pt;font-weight:700;line-height:1.05;margin-top:1mm}.expiry{font-size:'+Math.max(9,Math.min(20,h*.52))+'pt;font-weight:800;margin-top:1mm}.footer{font-size:'+Math.max(7,Math.min(13,h*.30))+'pt;font-weight:600;margin-top:1mm}</style></head><body>'+labels+'<script>onload=function(){print()}<\/script></body></html>');win.document.close()}
  window.zebraDownloadZPL=function(test){var z=buildZPL(!!test),blob=new Blob([z],{type:'text/plain'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='ASDHealth_Zebra_Label_v1_2.zpl';a.click();setTimeout(function(){URL.revokeObjectURL(a.href)},1000);message('ZPL file downloaded.','ok')};
  function sendZPL(test){var z=buildZPL(!!test);if(!zebraDevice){var sel=E('zebra-printer');zebraDevice=zprinters[Number(sel&&sel.value)]||null}if(!zebraDevice)return message('No Zebra printer selected. Click Detect printers first.','err');localStorage.setItem(ZPR_KEY,zebraDevice.uid||zebraDevice.name||'');zebraDevice.send(z,function(){message('Labels sent successfully to '+(zebraDevice.name||'Zebra printer')+'.','ok');if(typeof toast==='function')toast('Zebra labels sent successfully','succ')},function(e){message('Zebra print failed: '+(e&&e.message?e.message:e),'err')})}
  window.zebraPrintLabels=function(){if(!allowed())return;if(!clean(E('zebra-name').value))return message('Select or enter a medicine name.','err');if(E('zebra-template').value==='name_strength_expiry'&&!E('zebra-expiry').value)return message('Enter the expiry date.','err');var mode=E('zebra-mode').value;if(mode==='browser')return browserPrint();if(mode==='download')return zebraDownloadZPL(false);sendZPL(false)};
  window.zebraTestLabel=function(){if(E('zebra-mode').value==='browser')return browserPrint();if(E('zebra-mode').value==='download')return zebraDownloadZPL(true);sendZPL(true)};
  function initPage(){var ok=allowed();if(E('zebra-access-denied'))E('zebra-access-denied').style.display=ok?'none':'block';if(E('zebra-main'))E('zebra-main').style.display=ok?'block':'none';if(!ok)return;loadDB();zebraTemplateChanged();['zebra-width','zebra-height','zebra-dpi','zebra-copies'].forEach(function(id){var x=E(id);if(x)x.oninput=zebraUpdatePreview});zebraUpdatePreview();if(!zdb.length)zebraImportDatabase();setTimeout(zebraRefreshPrinters,250)}
  window.renderZebraPageUi=initPage;
})();


// --- Merged from 28-v13-final-controlled-bulk-print-fix.js (Phase 6 consolidation) ---
(function(){
'use strict';
const E=globalThis.E;
function escH(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function n(v){var x=Number(v);return isFinite(x)?x:0}
function openM(id){var m=E(id);if(m)m.classList.add('on')}
function closeM(id){var m=E(id);if(m)m.classList.remove('on')}
function toast2(msg,type){if(typeof window.toast==='function')window.toast(msg,type||'info');else alert(msg)}
function role(){return window.fsEffectiveRole?window.fsEffectiveRole():String((window.CU&&CU.role)||'')}
function currentDept(){return typeof window.ctlCurrentDept==='function'?ctlCurrentDept():((window.CU&&CU.deptId)||'')}
function settingsFor(dept){return (window.S&&S.g)?(S.g('controlled_settings_'+dept)||{}):{}}
function createModals(){
 if(!E('v13-final-sign-modal')){
  var a=document.createElement('div');a.id='v13-final-sign-modal';a.className='modal-bg v13-final-modal';a.innerHTML='<div class="modal"><div class="mh"><span class="mt">Edit custody print details / تعديل بيانات طباعة العهدة</span><button class="xbtn" type="button" data-close="v13-final-sign-modal">✕</button></div><div class="v13-final-grid"><div class="fg"><label>Head nurse / رئيس تمريض القسم</label><input id="v13-final-head-nurse"></div><div class="fg"><label>Controlled Medicines Officer / مسؤول الأدوية المخدرة والمقيدة</label><input id="v13-final-controlled-officer"></div><div class="fg"><label>Pharmacy manager / مدير الصيدلية</label><input id="v13-final-pharmacy-manager"></div><div class="fg"><label>Print code mode / أكواد الطباعة</label><select id="v13-final-code-mode"><option value="none">No codes / بدون أكواد</option><option value="moh">MOH only / الوزاري فقط</option><option value="nupco">NUPCO only / نوبكو فقط</option><option value="both">MOH + NUPCO / الوزاري + نوبكو</option></select></div></div><div class="fl g8" style="justify-content:flex-end;margin-top:14px"><button class="btn bg" type="button" data-close="v13-final-sign-modal">Cancel</button><button class="btn bp" type="button" id="v13-final-save-sign">Save</button></div></div>';document.body.appendChild(a)
 }
 if(!E('v13-final-bulk-modal')){
  var b=document.createElement('div');b.id='v13-final-bulk-modal';b.className='modal-bg v13-final-modal';b.innerHTML='<div class="modal"><div class="mh"><span class="mt">Bulk edit one medication across departments</span><button class="xbtn" type="button" data-close="v13-final-bulk-modal">✕</button></div><div class="v13-final-grid"><div class="fg"><label>Medication</label><select id="v13-final-bulk-med"></select></div><div class="fg"><label>Quantity operation</label><select id="v13-final-bulk-qty-op"><option value="keep">Keep current quantity</option><option value="unavailable">Mark unavailable (0)</option><option value="set">Set exact quantity</option><option value="adjust">Add / deduct quantity</option></select></div><div class="fg"><label>Quantity / adjustment</label><input id="v13-final-bulk-qty" type="number" value="0"><div class="fhint">Use -1 to deduct one unit.</div></div><div class="fg"><label>Expiry operation</label><select id="v13-final-bulk-exp-op"><option value="keep">Keep current expiry</option><option value="add">Add expiry batch</option><option value="replace">Replace all expiry batches</option></select></div><div class="fg"><label>Expiry date</label><input id="v13-final-bulk-expiry" type="date"></div><div class="fg"><label>Quantity linked to this expiry</label><input id="v13-final-bulk-exp-qty" type="number" min="0" value="0"></div></div><div class="fl g8 ic" style="margin:8px 0"><button class="btn bg bsm" type="button" id="v13-final-select-all">Select all departments</button><span id="v13-final-selected-count" class="fhint"></span></div><div id="v13-final-bulk-scope" class="v13-final-scope"></div><div class="fl g8" style="justify-content:flex-end;margin-top:14px"><button class="btn bg" type="button" data-close="v13-final-bulk-modal">Cancel</button><button class="btn bp" type="button" id="v13-final-apply-bulk">Apply to selected departments</button></div></div>';document.body.appendChild(b)
 }
 document.querySelectorAll('[data-close]').forEach(function(x){x.onclick=function(){closeM(x.dataset.close)}})
 E('v13-final-save-sign').onclick=saveSignatures;
 E('v13-final-bulk-med').onchange=renderBulkDepartments;
 E('v13-final-select-all').onclick=toggleAllBulk;
 E('v13-final-apply-bulk').onclick=applyBulk;
 if(typeof window.extendControlledBulkUi==='function')window.extendControlledBulkUi();
}
window.ctlEditSignatures=function(){
  createModals();
  var dept=currentDept();
  if(!dept)return toast2('Choose an inpatient department first.','err');
  var settings=settingsFor(dept);
  E('v13-final-head-nurse').value=settings.nursingHead||'';
  E('v13-final-controlled-officer').value=settings.controlledOfficer||settings.controlledPharmacyOfficer||'';
  E('v13-final-pharmacy-manager').value=settings.pharmacyManager||'';
  E('v13-final-code-mode').value=settings.printCodeMode||'both';
  openM('v13-final-sign-modal');
  var focus=E('v13-final-head-nurse');
  if(focus)focus.focus();
};
async function saveSignatures(){
  var dept=currentDept();
  if(!dept)return toast2('Choose an inpatient department first.','err');
  var settings=Object.assign({},settingsFor(dept));
  settings.nursingHead=E('v13-final-head-nurse').value.trim();
  settings.controlledOfficer=E('v13-final-controlled-officer').value.trim();
  settings.controlledPharmacyOfficer=settings.controlledOfficer;
  settings.pharmacyManager=E('v13-final-pharmacy-manager').value.trim();
  settings.printCodeMode=E('v13-final-code-mode').value||'both';
  try{
    await S.s('controlled_settings_'+dept,settings);
    closeM('v13-final-sign-modal');
    toast2('Signatures saved for this department ✓','succ');
    if(typeof renderControlled==='function')renderControlled();
  }catch(error){
    toast2(error&&error.message||'Could not save signatures.','err');
  }
}

function deptName(id){return window.fsDeptName?window.fsDeptName(id):String(id||'—')}
function renderBulkDepartments(){
 var med=E('v13-final-bulk-med').value,host=E('v13-final-bulk-scope');if(!med){host.innerHTML='<div class="fhint" style="padding:12px">Choose a medication.</div>';return}var depts=typeof gd==='function'?(gd()||[]):[];var rows=[];depts.forEach(function(d){var list=typeof ctlDeptList==='function'?(ctlDeptList(d.id)||[]):[];var item=list.find(function(x){return String(x.medId)===String(med)});if(item)rows.push({dept:d,item:item})});host.innerHTML=rows.length?rows.map(function(r){return '<label><input type="checkbox" class="v13-final-dept-check" data-dept="'+escH(r.dept.id)+'"><span><b>'+escH(r.dept.name)+'</b><br><small>Current qty: '+n(r.item.qty)+' · Expiry batches: '+((r.item.batches||[]).length)+'</small></span></label>'}).join(''):'<div class="fhint" style="padding:12px">This medication is not assigned to any inpatient department.</div>';host.querySelectorAll('input').forEach(function(x){x.onchange=updateBulkCount});updateBulkCount()
}
function updateBulkCount(){var c=document.querySelectorAll('.v13-final-dept-check:checked').length;E('v13-final-selected-count').textContent=c+' department(s) selected'}
function toggleAllBulk(){var boxes=Array.from(document.querySelectorAll('.v13-final-dept-check'));var on=boxes.some(function(x){return !x.checked});boxes.forEach(function(x){x.checked=on});E('v13-final-select-all').textContent=on?'Clear selection':'Select all departments';updateBulkCount()}
async function applyBulk(){
 var med=E('v13-final-bulk-med').value;var selected=Array.from(document.querySelectorAll('.v13-final-dept-check:checked'));if(!med)return toast2('Select a medication.','err');if(!selected.length)return toast2('Select at least one department.','err');var qop=E('v13-final-bulk-qty-op').value,qv=n(E('v13-final-bulk-qty').value),eop=E('v13-final-bulk-exp-op').value,date=E('v13-final-bulk-expiry').value,eq=Math.max(0,n(E('v13-final-bulk-exp-qty').value));if(eop!=='keep'&&!date)return toast2('Choose an expiry date.','err');var changed=0;
 try{for(var i=0;i<selected.length;i++){var dept=selected[i].dataset.dept;var list=(ctlDeptList(dept)||[]).map(function(x){return Object.assign({},x,{batches:(x.batches||[]).map(function(b){return Object.assign({},b)})})});var item=list.find(function(x){return String(x.medId)===String(med)});if(!item)continue;var cur=n(item.qty);if(qop==='unavailable')item.qty=0;else if(qop==='set')item.qty=Math.max(0,qv);else if(qop==='adjust')item.qty=Math.max(0,cur+qv);if(eop==='replace')item.batches=[];if(eop==='add'||eop==='replace'){item.batches=item.batches||[];item.batches.push({expiry:date,qty:eq,lot:''})}await ctlSetDeptList(dept,list);changed++}closeM('v13-final-bulk-modal');toast2(changed+' department(s) updated ✓','succ');if(typeof auditAction==='function')auditAction('controlled_bulk_department_medication_edit',{medId:med,departments:changed,quantityOperation:qop,expiryOperation:eop});if(typeof renderControlled==='function')renderControlled()}catch(e){toast2(e&&e.message||'Bulk update failed.','err')}
}
async function persistPrintOrdersMeta(ids){
  var requests=typeof gr==='function'?(gr()||[]):[];
  var actor=typeof actualActorName==='function'?actualActorName():'';
  var actorUser=typeof actualUser==='function'?actualUser():null;
  var when=typeof nowISO==='function'?nowISO():new Date().toISOString();
  if(window.S&&S.upd){
    await Promise.all(ids.map(function(id){
      var r=requests.find(function(x){return String(x.id)===String(id)});
      if(!r)return Promise.resolve();
      return S.upd('requests',id,{printCount:(r.printCount||0)+1,lastPrintedAt:when,lastPrintedBy:actor,lastPrintedById:(actorUser&&actorUser.id)||'',lastPrintedEffectiveRole:(window.CU&&CU.role)||''});
    }));
  }
  if(typeof auditAction==='function')await Promise.resolve(auditAction('requests_printed',{requestIds:ids}));
}


})();

export {};
export {};
