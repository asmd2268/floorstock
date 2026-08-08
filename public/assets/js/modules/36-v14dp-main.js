(function(){
'use strict';
function E(id){return document.getElementById(id)}
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function n(v){var x=Number(v);return isFinite(x)?x:0}
function role(){return window.fsEffectiveRole?window.fsEffectiveRole():String((window.CU&&CU.role)||'')}
function annualReportAllowed(){var c=window.CU||{},r=role();return c.master===true||['pharmacy','pharmacy_manager','inpatient_supervisor'].indexOf(r)>=0}
function annualKey(m){var n=String((m&&m.name)||m&&m.id||'').trim(),s=String((m&&m.concentration)||(m&&m.strength)||'').trim();return n.toLowerCase().replace(/\s+/g,' ')+'|'+s.toLowerCase().replace(/\s+/g,' ')}
function setupAnnualReport(){var card=E('annual-analytics-print-card');if(!card)return;card.style.display=annualReportAllowed()?'block':'none';if(!annualReportAllowed())return;var now=new Date().getFullYear(),from=E('annual-report-from'),to=E('annual-report-to');if(!from||!to)return;if(!from.options.length){for(var y=2020;y<=now+2;y++){from.add(new Option(String(y),String(y)));to.add(new Option(String(y),String(y)))}from.value=String(now-1);to.value=String(now)}var b=E('annual-report-generate');if(b&&!b.dataset.bound){b.dataset.bound='1';b.onclick=generateAnnualReport}}
function generateAnnualReport(){if(!annualReportAllowed())return toast('This report is limited to Master, Pharmacy Director and Inpatient Supervisor.','err');var fy=Number((E('annual-report-from')||{}).value),ty=Number((E('annual-report-to')||{}).value);if(!fy||!ty||fy>ty)return toast('Choose a valid year range.','err');var deps=typeof gd==='function'?(gd()||[]):[],catalog={};deps.forEach(function(d){(getMeds(d.id)||[]).forEach(function(m){catalog[d.id+'|'+m.id]={name:m.name||m.id,key:annualKey(m),high:!!(m.high_alert||m.highAlert)}})});var rows=(typeof gr==='function'?gr():[]).concat((S.g('request_analytics_archive')||[])).filter(function(r){return r.status!=='pending'}),years=[];for(var y=fy;y<=ty;y++)years.push(y);var stats={};years.forEach(function(y){stats[y]={units:0,orders:0,meds:{},deps:{}}});rows.forEach(function(r){var dt=new Date(r.fulfilledAt||r.created||0),y=dt.getFullYear();if(!stats[y])return;stats[y].orders++;var dep=String(r.deptId||'Unknown');(r.dispensed||[]).forEach(function(x){var q=Number(x.qty)||0;if(q<=0)return;var m=catalog[r.deptId+'|'+x.medId],k=m?m.key:String(x.medName||x.name||x.medId||'').toLowerCase().replace(/\s+/g,' ')+'|';stats[y].units+=q;stats[y].meds[k]=stats[y].meds[k]||{name:m?m.name:(x.medName||x.name||x.medId),qty:0,high:m&&m.high};stats[y].meds[k].qty+=q;stats[y].meds[k].high=stats[y].meds[k].high||!!(m&&m.high);stats[y].deps[dep]=(stats[y].deps[dep]||0)+q})});var body=years.map(function(y){var s=stats[y],top=Object.keys(s.meds).map(function(k){return s.meds[k]}).sort(function(a,b){return b.qty-a.qty}).slice(0,10),high=Object.keys(s.meds).map(function(k){return s.meds[k]}).filter(function(m){return m.high}).sort(function(a,b){return b.qty-a.qty}).slice(0,5),depRows=Object.keys(s.deps).sort(function(a,b){return s.deps[b]-s.deps[a]}).map(function(d){return '<tr><td>'+esc((deps.find(function(x){return String(x.id)===d})||{}).name||d)+'</td><td>'+s.deps[d]+'</td><td>'+(s.units?Math.round(s.deps[d]/s.units*1000)/10:0)+'%</td></tr>'}).join('');return '<section><h2>'+y+'</h2><div class="summary"><b>'+s.units+'</b> dispensed units · <b>'+s.orders+'</b> fulfilled orders · <b>'+(s.orders?s.units/s.orders:0).toFixed(1)+'</b> units/order</div><h3>Top 10 dispensed</h3><ol>'+top.map(function(m){return '<li>'+esc(m.name)+' — '+m.qty+'</li>'}).join('')+'</ol><h3>Top high-alert</h3><ol>'+high.map(function(m){return '<li>'+esc(m.name)+' — '+m.qty+'</li>'}).join('')+'</ol><h3>Department share</h3><table><tr><th>Department</th><th>Units</th><th>Share</th></tr>'+depRows+'</table></section>'}).join('');var html='<!doctype html><html><head><meta charset="utf-8"><title>Annual statistical report</title><style>body{font-family:Arial,sans-serif;color:#111;margin:18px}h1{text-align:center;font-size:20px}h2{border-bottom:2px solid #333;padding-bottom:4px}h3{margin-bottom:4px}section{page-break-inside:avoid;margin-bottom:22px}.summary{background:#f1f1f1;padding:8px;margin:6px 0 12px}table{width:100%;border-collapse:collapse;font-size:11px}th,td{border:1px solid #888;padding:5px;text-align:left}th{background:#eee}@media print{section{page-break-inside:avoid}}</style></head><body><h1>Annual Pharmacy Consumption Report<br><small>التقرير الإحصائي السنوي</small></h1><p>Period: '+fy+'–'+ty+' · Generated: '+new Date().toLocaleString()+'</p>'+body+'</body></html>';var w=window.open('','_blank');if(!w)return toast('Allow pop-ups to print the report.','err');w.document.open();w.document.write(html+'<script>window.addEventListener("load",function(){setTimeout(function(){window.print()},250)})<\/script>');w.document.close()}

/* ══════════════════════════════════════════════════════════════
   2. صفحة الطباعة: عزل Fulfilled
   - الطلبات المكتملة (fulfilled) تعلو الجدول بتمييز أخضر
   - زر فلتر: الكل / Fulfilled فقط / اليوم
   - نسخ renderPrint
══════════════════════════════════════════════════════════════ */
var _v14PrintFilter='today'; /* default for all print users: fulfilled today */

window.renderPrint=function(){
  setupAnnualReport();
  /* أصل renderPrint */
  var purgeBtn=E('purge-old-orders-btn');
  if(purgeBtn)purgeBtn.style.display=(window.CU&&CU.master===true)?'inline-flex':'none';

  var allReqs=(typeof gr==='function'?gr():[]).slice().reverse();
  if((window.fsEffectiveRole?window.fsEffectiveRole():String((window.CU&&CU.role)||''))==='outpatient_pharmacy_supervisor'&&window.fsOutpatientDeptId){var opd=window.fsOutpatientDeptId();allReqs=allReqs.filter(function(r){return String(r.deptId)===String(opd)})}
  if((window.fsEffectiveRole?window.fsEffectiveRole():String((window.CU&&CU.role)||''))==='outpatient_pharmacy_supervisor'&&window.fsOutpatientDeptId){var opd=window.fsOutpatientDeptId();allReqs=allReqs.filter(function(r){return String(r.deptId)===String(opd)})}
  var fulfilled=allReqs.filter(function(r){return r.status==='fulfilled'||r.status==='partial'}).sort(function(a,b){return new Date(b.fulfilledAt||b.created||0)-new Date(a.fulfilledAt||a.created||0)});
  var pending=allReqs.filter(function(r){return r.status==='pending'}).sort(function(a,b){return new Date(b.created||0)-new Date(a.created||0)});

  var today=new Date().toISOString().slice(0,10);

  /* بناء صفوف الجدول */
  function buildRow(r,cls){
    var dept=(typeof gd==='function'?gd():[]).find(function(x){return x.id===r.deptId});
    var nn=(r.dispensed||[]).filter(function(x){return x.qty>0}).length;
    var date=typeof fmtDateTime==='function'?fmtDateTime(r.created):r.created;
    var ful=r.fulfilledAt?(typeof fmtDate==='function'?fmtDate(r.fulfilledAt):r.fulfilledAt):'—';
    return '<tr class="'+cls+'">'
      +'<td><input type="checkbox" class="pchk" data-id="'+esc(r.id)+'"></td>'
      +'<td>'+esc((dept&&dept.name)||r.deptId)+'</td>'
      +'<td>'+esc(date)+'</td>'
      +'<td>'+esc(ful)+'</td>'
      +'<td>'+nn+' items</td>'
      +'<td style="text-align:center;font-family:var(--mono)">'+(r.printCount||0)+'</td>'
      +'</tr>';
  }

  var fRows='',pRows='';
  var todayFulfilled=fulfilled.filter(function(r){return (r.fulfilledAt||r.created||'').slice(0,10)===today});

  if(_v14PrintFilter==='today'){
    fRows=todayFulfilled.map(function(r){return buildRow(r,'v14-ptbl-done')}).join('');
  } else if(_v14PrintFilter==='fulfilled'){
    fRows=fulfilled.map(function(r){return buildRow(r,'v14-ptbl-done')}).join('');
  } else {
    /* all: fulfilled أولاً ثم pending */
    fRows=fulfilled.map(function(r){return buildRow(r,'v14-ptbl-done')}).join('');
    pRows=pending.map(function(r){return buildRow(r,'v14-ptbl-pending')}).join('');
  }

  var tbl=E('ptbl');
  if(!tbl)return;

  /* إضافة شريط الفلتر فوق الجدول */
  var card=tbl.closest('.card');
  if(card){
    var existFilter=E('v14-print-filter');
    if(!existFilter){
      var filterBar=document.createElement('div');filterBar.id='v14-print-filter';
      filterBar.innerHTML=
        '<span style="font-size:12px;font-weight:700;color:var(--tx2)">Show:</span>'
        +'<button class="btn bg bsm" id="v14-pf-fulfilled" onclick="v14SetPrintFilter(\'fulfilled\')">✅ Fulfilled</button>'
        +'<button class="btn bg bsm" id="v14-pf-today" onclick="v14SetPrintFilter(\'today\')">📅 Today\'s fulfilled</button>'
        +'<button class="btn bg bsm" id="v14-pf-all" onclick="v14SetPrintFilter(\'all\')">All requests</button>'
        +'<span style="font-size:11px;color:var(--tx2);margin-inline-start:8px">'
        +'✅ Fulfilled: '+fulfilled.length+' · 📅 Today: '+todayFulfilled.length+' · ⏳ Pending: '+pending.length
        +'</span>';
      card.querySelector('.ch').insertAdjacentElement('afterend',filterBar);
    } else {
      /* حدّث الأرقام */
      var stat=existFilter.querySelector('span:last-child');
      if(stat)stat.textContent='✅ Fulfilled: '+fulfilled.length+' · 📅 Today: '+todayFulfilled.length+' · ⏳ Pending: '+pending.length;
    }
    /* أضء الزر النشط */
    ['fulfilled','today','all'].forEach(function(f){
      var btn=E('v14-pf-'+f);if(!btn)return;
      btn.classList.toggle('on',f===_v14PrintFilter);
    });
  }

  /* بناء الـ tbody */
  if(fRows||pRows){
    tbl.innerHTML=
      (fRows?'<tr id="v14-ptbl-fulfilled-head"><td colspan="6">✅ Fulfilled Requests</td></tr>'+fRows:'')
      +(pRows?'<tr id="v14-ptbl-pending-head" style="background:var(--s2)"><td colspan="6" style="padding:6px 10px;font-weight:800;font-size:12px;color:var(--tx2)">⏳ Pending Requests</td></tr>'+pRows:'');
  } else {
    tbl.innerHTML='<tr><td colspan="6" style="text-align:center;color:var(--tx2);padding:18px">No requests found</td></tr>';
  }
};

window.v14SetPrintFilter=function(f){
  _v14PrintFilter=f;
  if(typeof window.renderPrint==='function')window.renderPrint();
};


})();

export {};
