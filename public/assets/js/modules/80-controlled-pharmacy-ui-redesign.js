/* R6.76.85 — Controlled Medicines Pharmacy Officer: polished tab bar, stat cards, analytics tab */
(function(){
'use strict';

/* ── Inject CSS ── */
(function injectCss(){
  if(document.getElementById('ctl-redesign-css'))return;
  var s=document.createElement('style');
  s.id='ctl-redesign-css';
  s.textContent=`
/* ── Controlled tab row ── */
#ctl-tabs{margin-bottom:20px}
.ctl-tab-row{display:flex;gap:4px;padding:4px;background:var(--s2);border:1px solid var(--bd);border-radius:14px;width:fit-content;max-width:100%;flex-wrap:wrap}
.ctl-tab{display:flex;align-items:center;gap:7px;padding:9px 18px;border-radius:10px;border:none;background:transparent;color:var(--tx2);cursor:pointer;font-size:13.5px;font-weight:500;transition:background .14s,color .14s;white-space:nowrap}
.ctl-tab:hover{background:var(--s3,rgba(0,0,0,.06));color:var(--tx1)}
.ctl-tab.active{background:var(--acl,#1f6feb);color:#fff;font-weight:600;box-shadow:0 2px 8px rgba(31,111,235,.22)}
.ctl-tab-icon{font-size:16px;line-height:1}

/* ── Stat summary cards ── */
.ctl-stat-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:12px;margin-bottom:18px}
.ctl-stat-card{background:var(--s2);border:1px solid var(--bd);border-radius:12px;padding:14px 16px;display:flex;flex-direction:column;gap:5px;position:relative;overflow:hidden}
.ctl-stat-card-icon{font-size:22px;line-height:1}
.ctl-stat-card-label{font-size:11px;color:var(--tx2);font-weight:500;text-transform:uppercase;letter-spacing:.5px}
.ctl-stat-card-value{font-size:26px;font-weight:700;color:var(--tx1);font-family:var(--mono,'monospace');line-height:1}
.ctl-stat-card.alert .ctl-stat-card-value{color:var(--rdl,#f85149)}
.ctl-stat-card.warn .ctl-stat-card-value{color:var(--yll,#e3b341)}
.ctl-stat-card.ok .ctl-stat-card-value{color:var(--gn,#3fb950)}

/* ── Analytics inline view ── */
#ctl-analytics-view{display:none}
#ctl-analytics-view .stitle{font-size:18px;font-weight:700;margin-bottom:4px}
#ctl-analytics-view .ssub{font-size:13px;color:var(--tx2);margin-bottom:16px}
.ctl-an-header{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:18px}
.ctl-an-filters{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.ctl-an-filters input,.ctl-an-filters select{margin:0}

/* ── Analytics stat cards ── */
#ctl-an-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:12px;margin-bottom:18px}
#ctl-an-stats .sc{background:var(--s2);border:1px solid var(--bd);border-radius:12px;padding:14px 16px}
#ctl-an-stats .sl{font-size:11px;color:var(--tx2);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px}
.ctl-stat-number{font-size:26px;font-weight:700;font-family:var(--mono,'monospace');color:var(--tx1)}

/* ── Page header badge ── */
.ctl-role-badge{display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:20px;font-size:11.5px;font-weight:600;background:rgba(31,111,235,.12);color:var(--acl,#1f6feb);border:1px solid rgba(31,111,235,.2);margin-left:10px}
  `;
  document.head.appendChild(s);
})();

/* ── Wait for core to be ready then patch ── */
var _patchAttempts=0;
function tryPatch(){
  if(!window.ctlTabs||!window.renderControlled){
    if(++_patchAttempts<60)setTimeout(tryPatch,300);
    return;
  }
  patchCtlTabs();
  patchRenderControlled();
  ensureAnalyticsViewInPage();
}
tryPatch();

/* ── Tab definitions per role ── */
function getCtlTabDefs(){
  var role=typeof window.fsEffectiveRole==='function'?window.fsEffectiveRole():String((window.CU&&window.CU.role)||'');
  if(role==='department') return [['departments','🏥','My Controlled List / عهدتي']];
  if(role==='warehouse')  return [['overview','💊','Controlled Stock / المخزون']];
  var tabs=[['overview','💊','Stock / المخزون']];
  if(typeof window.canControlledPharmacyStorage==='function'&&window.canControlledPharmacyStorage())
    tabs.push(['storage','🗄️','Cabinets / الدواليب']);
  tabs.push(['departments','🏥','Departments / الأقسام']);
  tabs.push(['analytics','📊','Analytics / التحليلات']);
  return tabs;
}

function buildTabRowHtml(tabs,activeView){
  return '<div class="ctl-tab-row">'+
    tabs.map(function(t){
      return '<button type="button" class="ctl-tab'+(activeView===t[0]?' active':'')+'" data-view="'+t[0]+'">'+
        '<span class="ctl-tab-icon">'+t[1]+'</span>'+
        '<span class="ctl-tab-label">'+t[2]+'</span>'+
        '</button>';
    }).join('')+
  '</div>';
}

/* ── Patch ctlTabs ── */
function patchCtlTabs(){
  window.ctlTabs=function(){
    var root=document.getElementById('ctl-tabs');
    if(!root||!window.CU)return;
    var tabs=getCtlTabDefs();
    var view=window.CTL_VIEW||'overview';
    if(!tabs.some(function(t){return t[0]===view;}))view=tabs[0][0];
    window.CTL_VIEW=view;
    root.innerHTML=buildTabRowHtml(tabs,view);
    root.querySelectorAll('.ctl-tab').forEach(function(btn){
      btn.onclick=function(){window.ctlSetView(btn.dataset.view);};
    });
  };

  window.ctlSetView=function(v){
    window.CTL_VIEW=v;
    return window.renderControlled();
  };
}

/* ── Inject analytics view container into pg-controlled ── */
function ensureAnalyticsViewInPage(){
  if(document.getElementById('ctl-analytics-view'))return;
  var pg=document.getElementById('pg-controlled');
  if(!pg)return;
  var div=document.createElement('div');
  div.id='ctl-analytics-view';
  pg.appendChild(div);
}

/* ── Stat cards HTML for overview ── */
function buildStatCards(cat,wh,ph){
  var numC=function(v){v=Number(v);return isFinite(v)?v:0};
  var narcCount=cat.filter(function(m){return String(m.classification||'narcotic')!=='psychotropic'}).length;
  var psyCount=cat.filter(function(m){return String(m.classification||'narcotic')==='psychotropic'}).length;
  var alertCount=0,lowCount=0,expiredCount=0,soonCount=0,now=new Date().toISOString().slice(0,10);
  cat.forEach(function(m){
    var w=wh[m.id]||{},p=ph[m.id]||{};
    var batches=(p.batches||[]).concat(w.batches||[]);
    batches.forEach(function(b){
      if(!b.expiry)return;
      var d=b.expiry.slice(0,10);
      if(d<now)expiredCount++;
      else if(d<addDays(now,30))soonCount++;
    });
    var pq=numC(p.qty!=null?p.qty:p.actualQty),wq=numC(w.system)+numC(w.outside);
    var role=typeof window.fsEffectiveRole==='function'?window.fsEffectiveRole():String((window.CU&&window.CU.role)||'');
    var stock=role==='warehouse'?wq:pq;
    if(typeof window.ctlStatus==='function'){var st=window.ctlStatus(m,w,p);if(st&&st.key&&st.key!=='ok')alertCount++;}
    else if(stock===0&&(m.min>0||narcCount))lowCount++;
  });
  return '<div class="ctl-stat-row">'+
    '<div class="ctl-stat-card"><div class="ctl-stat-card-icon">💊</div><div class="ctl-stat-card-label">Narcotics &amp; Restricted</div><div class="ctl-stat-card-value">'+narcCount+'</div></div>'+
    '<div class="ctl-stat-card"><div class="ctl-stat-card-icon">🧠</div><div class="ctl-stat-card-label">Psychotropics</div><div class="ctl-stat-card-value">'+psyCount+'</div></div>'+
    '<div class="ctl-stat-card'+(alertCount?' alert':' ok')+'"><div class="ctl-stat-card-icon">'+(alertCount?'⚠️':'✅')+'</div><div class="ctl-stat-card-label">Stock Alerts</div><div class="ctl-stat-card-value">'+alertCount+'</div></div>'+
    '<div class="ctl-stat-card'+(expiredCount?' alert':soonCount?' warn':' ok')+'"><div class="ctl-stat-card-icon">'+(expiredCount?'🔴':soonCount?'🟡':'🟢')+'</div><div class="ctl-stat-card-label">Expiry Issues</div><div class="ctl-stat-card-value">'+(expiredCount+soonCount)+'</div></div>'+
  '</div>';
}
function addDays(iso,n){var d=new Date(iso);d.setDate(d.getDate()+n);return d.toISOString().slice(0,10)}

/* ── Patch renderControlled to inject stat cards + handle analytics tab ── */
function patchRenderControlled(){
  var _orig=window.renderControlled;
  window.renderControlled=function(){

    /* Analytics tab: delegate to pg-ctl-analytics page rendering inline */
    if(window.CTL_VIEW==='analytics'){
      ['ctl-overview-view','ctl-departments-view','ctl-storage-view'].forEach(function(id){
        var el=document.getElementById(id);if(el)el.style.display='none';
      });
      var pdf=document.getElementById('ctl-pdf-receipt-card');if(pdf)pdf.style.display='none';
      var permNote=document.getElementById('ctl-permission-note');if(permNote)permNote.style.display='none';
      var prnBtn=document.getElementById('ctl-main-print-btn');if(prnBtn)prnBtn.style.display='none';

      window.ctlTabs();

      ensureAnalyticsViewInPage();
      var av=document.getElementById('ctl-analytics-view');
      if(av){
        av.style.display='block';
        renderAnalyticsInline(av);
      }
      return;
    }

    /* All other tabs: hide analytics view */
    var av=document.getElementById('ctl-analytics-view');
    if(av)av.style.display='none';

    var result=_orig.apply(this,arguments);

    /* Inject stat cards after overview renders */
    if(window.CTL_VIEW==='overview'||!window.CTL_VIEW){
      setTimeout(function(){
        var ov=document.getElementById('ctl-overview-view');
        if(!ov||document.getElementById('ctl-overview-stat-cards'))return;
        var cat=typeof ctlCatalog==='function'?(ctlCatalog()||[]):[];
        var wh=typeof ctlWarehouse==='function'?(ctlWarehouse()||{}):{};
        var ph=typeof ctlPharmacy==='function'?(ctlPharmacy()||{}):{};
        var statsHtml=buildStatCards(cat,wh,ph);
        var wrap=document.createElement('div');wrap.id='ctl-overview-stat-cards';
        wrap.innerHTML=statsHtml;
        ov.insertBefore(wrap,ov.firstChild);
      },0);
    }

    return result;
  };
}

/* ── Render analytics inline inside ctl-analytics-view ── */
/* Uses namespaced IDs (ctl-an-inline-*) to avoid colliding with pg-ctl-analytics IDs */
function renderAnalyticsInline(container){
  var esc=typeof window.esc==='function'?window.esc:function(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})};
  var Q=function(id){return container.querySelector('#'+id)};

  var depts=(typeof gd==='function'?gd():[]).map(function(d){return '<option value="'+esc(d.id)+'">'+esc(d.name)+'</option>'}).join('');
  container.innerHTML=
    '<div class="stitle">Controlled Dispensing Analytics / إحصائيات الصرف</div>'+
    '<div class="ssub">Quantities, recipients, departments and dispensing types by date range.</div>'+
    '<div class="ctl-an-header">'+
      '<div class="ctl-an-filters">'+
        '<input id="ctl-an-inline-from" type="date" style="width:145px;margin:0">'+
        '<input id="ctl-an-inline-to" type="date" style="width:145px;margin:0">'+
        '<select class="psel" id="ctl-an-inline-type"><option value="">All types</option><option value="inpatient">Inpatient</option><option value="outpatient">Outpatient</option></select>'+
        '<select class="psel" id="ctl-an-inline-dept"><option value="">All departments</option>'+depts+'</select>'+
        '<input id="ctl-an-inline-recipient" placeholder="Recipient name" style="width:180px;margin:0">'+
        '<button class="btn bp" onclick="ctlAnApply()">Apply</button>'+
      '</div>'+
      '<button class="btn bg bsm" onclick="ctlAnPrint()">🖨 Print</button>'+
    '</div>'+
    '<div id="ctl-an-inline-stats" class="g4 mb14"></div>'+
    '<div class="card"><div class="ch"><span class="ct">Dispensing records / سجل الصرف</span></div>'+
      '<div class="tw"><table><thead><tr><th>Date</th><th>Medicine</th><th>Qty</th><th>Source</th><th>Type</th><th>Department</th><th>Recipient</th><th>By</th></tr></thead>'+
      '<tbody id="ctl-an-inline-table"></tbody>'+
    '</table></div></div>';

  function applyFilters(){
    var from=(Q('ctl-an-inline-from')||{}).value||'';
    var to=(Q('ctl-an-inline-to')||{}).value||'';
    var type=(Q('ctl-an-inline-type')||{}).value||'';
    var dept=(Q('ctl-an-inline-dept')||{}).value||'';
    var rec=((Q('ctl-an-inline-recipient')||{}).value||'').toLowerCase();
    var ctlMoves2=typeof ctlMoves==='function'?ctlMoves():[];
    var rows=ctlMoves2.filter(function(x){
      if(x.type!=='dispense')return false;
      var d=String(x.at||'').slice(0,10);
      return(!from||d>=from)&&(!to||d<=to)&&(!type||x.dispenseType===type)&&(!dept||x.dept===dept)&&(!rec||String(x.recipient||'').toLowerCase().includes(rec));
    });
    var total=rows.reduce(function(s,x){var n=Number(x.qty);return s+(isFinite(n)?n:0)},0);
    var recipients=new Set(rows.map(function(x){return x.recipient}).filter(Boolean)).size;
    var depts2=new Set(rows.map(function(x){return x.dept}).filter(Boolean)).size;
    var statsEl=Q('ctl-an-inline-stats');
    if(statsEl)statsEl.innerHTML=
      '<div class="sc"><div class="sl">Transactions</div><div class="ctl-stat-number">'+rows.length+'</div></div>'+
      '<div class="sc"><div class="sl">Total quantity</div><div class="ctl-stat-number">'+total+'</div></div>'+
      '<div class="sc"><div class="sl">Recipients</div><div class="ctl-stat-number">'+recipients+'</div></div>'+
      '<div class="sc"><div class="sl">Departments</div><div class="ctl-stat-number">'+depts2+'</div></div>';
    var fmtDT=typeof fmtDateTime==='function'?fmtDateTime:function(v){return String(v||'').slice(0,16).replace('T',' ')};
    var ctlMed=typeof ctlMedicine==='function'?ctlMedicine:function(){return {}};
    var tbody=Q('ctl-an-inline-table');
    if(tbody)tbody.innerHTML=rows.slice().reverse().map(function(x){
      var m=ctlMed(x.medId)||{};
      return '<tr><td>'+fmtDT(x.at)+'</td><td>'+esc(m.name||'')+'</td><td>'+(isFinite(Number(x.qty))?Number(x.qty):0)+'</td><td>'+esc(x.source||'')+'</td><td>'+esc(x.dispenseType||'')+'</td><td>'+esc(x.deptName||'—')+'</td><td>'+esc(x.recipient||'')+'</td><td>'+esc(x.by||'')+'</td></tr>';
    }).join('')||'<tr><td colspan="8" style="text-align:center;padding:20px">No matching records</td></tr>';
  }
  window.ctlAnApply=applyFilters;

  window.ctlAnPrint=function(){
    if(typeof window.showPg==='function')window.showPg('pg-ctl-analytics');
    setTimeout(function(){if(typeof window.renderCtlAnalytics==='function')window.renderCtlAnalytics();},100);
  };

  ['ctl-an-inline-from','ctl-an-inline-to','ctl-an-inline-type','ctl-an-inline-dept','ctl-an-inline-recipient'].forEach(function(id){
    var el=Q(id);
    if(el)el.addEventListener(id.indexOf('recipient')>=0||id.indexOf('from')>=0||id.indexOf('to')>=0?'input':'change',applyFilters);
  });

  window.ctlAnApply();
}

})();

export {};
