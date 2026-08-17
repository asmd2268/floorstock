(function(){
'use strict';
/* Hijri-calendar running ledger for the controlled-medicines officer's own
   pharmacy custody (one balance per medicine, pharmacy-wide — not per
   department, confirmed with the user). Movements are never entered here
   directly: they're read straight from the existing controlled_moves log
   that ctlConfirmDispense()/ctlReceiveDelivery() already write on every real
   dispense/receipt, so this is a reporting layer, not a second bookkeeping
   system. Balance continuity survives the 1-year controlled_moves archival
   (core/controlled-moves-retention.js) because the monthly aggregate rows it
   writes to controlled_moves_summary_v1 keep exactly the fields (type,
   medId, qty, at, dispenseType, dept) this ledger needs, and that summary
   key is never pruned — so the running balance stays correct indefinitely,
   even though very old months only have monthly (not daily) resolution. */

var HIJRI_MONTHS_AR=['محرم','صفر','ربيع الأول','ربيع الآخر','جمادى الأولى','جمادى الآخرة','رجب','شعبان','رمضان','شوال','ذو القعدة','ذو الحجة'];

function hijriParts(value){
  var d=new Date(value);
  if(isNaN(d))return null;
  try{
    var parts=new Intl.DateTimeFormat('en-u-ca-islamic-umalqura',{year:'numeric',month:'numeric',day:'numeric'}).formatToParts(d);
    var o={};
    parts.forEach(function(p){if(p.type==='year')o.year=Number(p.value);if(p.type==='month')o.month=Number(p.value);if(p.type==='day')o.day=Number(p.value)});
    return (o.year&&o.month&&o.day)?o:null;
  }catch(e){return null}
}
function hijriMonthKey(value){var h=hijriParts(value);return h?h.year+'-'+String(h.month).padStart(2,'0'):null}
function hijriMonthLabel(year,month){return (HIJRI_MONTHS_AR[month-1]||month)+' '+year+' هـ'}
function hijriDateLabel(value){var h=hijriParts(value);if(!h)return '—';return h.day+' '+(HIJRI_MONTHS_AR[h.month-1]||h.month)+' '+h.year}
function currentHijri(){return hijriParts(new Date())||{year:1447,month:1,day:1}}
function isNarcoticOnly(m){return String(m&&m.classification||'narcotic')!=='psychotropic'}

/* ── period helpers: a "period" is always resolved down to an inclusive
   [startMonthKey,endMonthKey] Hijri-month range, so month/quarter/year all
   reuse the exact same balance-range math. ── */
function periodBounds(periodKey,periodType){
  if(periodType==='year'){
    var y=Number(periodKey);
    return {start:y+'-01',endIncl:y+'-12'};
  }
  if(periodType==='quarter'){
    var parts=periodKey.split('-Q'),y2=Number(parts[0]),q=Number(parts[1]),startM=(q-1)*3+1;
    return {start:y2+'-'+String(startM).padStart(2,'0'),endIncl:y2+'-'+String(startM+2).padStart(2,'0')};
  }
  return {start:periodKey,endIncl:periodKey};
}
function periodLabel(periodKey,periodType){
  if(periodType==='year')return periodKey+' هـ';
  if(periodType==='quarter'){var parts=periodKey.split('-Q');return 'Q'+parts[1]+' '+parts[0]+' هـ';}
  var m=periodKey.split('-');return hijriMonthLabel(Number(m[0]),Number(m[1]));
}

function esc2(v){return window.esc?window.esc(v):String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function isOfficerOrMaster(){
  var role=typeof window.fsEffectiveRole==='function'?window.fsEffectiveRole():String((window.CU&&window.CU.role)||'');
  return role==='controlled_pharmacy'||(typeof window.isMaster==='function'&&window.isMaster());
}
function isMasterUser(){return typeof window.isMaster==='function'&&window.isMaster()}

/* ── data source (reporting only — read straight from the real log) ── */
function ledgerRawMoves(){
  var live=(typeof window.ctlMoves==='function'?window.ctlMoves():[])||[];
  var archived=(window.S&&window.S.g?window.S.g('controlled_moves_summary_v1')||[]:[]);
  return live.concat(archived);
}
function ledgerEntries(medId){
  return ledgerRawMoves()
    .filter(function(m){return m&&(m.type==='dispense'||m.type==='receipt_accepted')&&String(m.medId)===String(medId)&&m.at})
    .map(function(m){
      return {
        id:m.id||'',
        at:m.at,
        dir:m.type==='receipt_accepted'?'in':'out',
        qty:Number(m.qty)||0,
        dept:m.dept||'',
        deptName:m.deptName||'',
        dispenseType:m.dispenseType||'',
        recipient:m.recipient||'',
        note:m.note||'',
        aggregated:!!m.__aggregated
      };
    })
    .sort(function(a,b){return String(a.at).localeCompare(String(b.at))||(a.dir==='in'?-1:1)});
}
function medicineBalanceSeries(medId){
  var running=0;
  return ledgerEntries(medId).map(function(e){
    running+=e.dir==='in'?e.qty:-e.qty;
    return Object.assign({},e,{balance:running});
  });
}

/* ── size alert (Firestore doc approaching the 1MiB limit) ── */
function checkControlledMovesSize(){
  try{
    var live=(typeof window.ctlMoves==='function'?window.ctlMoves():[])||[];
    var bytes=JSON.stringify(live).length;
    var limit=1048576,warnAt=0.65*limit;
    if(bytes>warnAt&&isMasterUser()){
      var pct=Math.round(bytes/limit*100);
      window.toast&&window.toast('controlled_moves is at '+pct+'% of the Firestore document size limit. Archive records older than 1 year from Custody Log → Archive to keep the balance intact and free up space. / سجل حركات الأدوية المخدرة اقترب من الحد الأقصى لحجم المستند — استخدم زر الأرشفة في سجل العهدة.','info');
      return {bytes:bytes,pct:pct,warn:true};
    }
    return {bytes:bytes,pct:Math.round(bytes/limit*100),warn:false};
  }catch(e){return {bytes:0,pct:0,warn:false}}
}
window.checkControlledMovesSize=checkControlledMovesSize;

/* ── modal ── */
function el(id){return document.getElementById(id)}
function createModal(){
  if(el('mhijri-ledger'))return;
  var div=document.createElement('div');div.id='mhijri-ledger';div.className='modal-bg';
  div.innerHTML=
    '<div class="modal" style="width:1150px;max-width:97vw;max-height:92vh;display:flex;flex-direction:column">'+
      '<div class="mh"><span class="mt">📜 Hijri Narcotic Ledger / السجل الهجري للأدوية المخدرة</span><button class="xbtn" type="button" data-close="mhijri-ledger">✕</button></div>'+
      '<div style="padding:14px 18px;overflow:auto;flex:1">'+
        '<div id="hjl-size-alert"></div>'+
        '<div class="fl g8" style="flex-wrap:wrap;margin-bottom:8px">'+
          '<select id="hjl-view-mode" style="min-width:220px">'+
            '<option value="single">Single medicine / دواء واحد</option>'+
            '<option value="all">All Narcotics summary (excl. psychotropic) / كل الناركوتك بدون النفسية</option>'+
          '</select>'+
          '<select id="hjl-period-type" style="min-width:130px">'+
            '<option value="month">Monthly / شهري</option>'+
            '<option value="quarter">Quarterly / ربعي</option>'+
            '<option value="year">Yearly / سنوي</option>'+
          '</select>'+
        '</div>'+
        '<div class="fl g8" style="flex-wrap:wrap;margin-bottom:12px">'+
          '<select id="hjl-med" style="min-width:220px"></select>'+
          '<select id="hjl-period" style="min-width:160px"></select>'+
          '<select id="hjl-dept" style="min-width:160px"><option value="">All departments / كل الأقسام</option><option value="outpatient">Outpatient / مريض خارجي</option></select>'+
          '<button class="btn bp bsm" type="button" id="hjl-apply">Apply / تطبيق</button>'+
          '<button class="btn bg bsm" type="button" id="hjl-export">📊 Export Excel</button>'+
          '<button class="btn bg bsm" type="button" id="hjl-print">🖨 Print</button>'+
        '</div>'+
        '<div id="hjl-summary" class="ctl-stat-row" style="margin-bottom:10px"></div>'+
        '<div id="hjl-single-view" class="card" style="margin:0"><div class="tw"><table><thead><tr>'+
          '<th>Date / التاريخ</th><th>Type / النوع</th><th>Department / القسم</th>'+
          '<th>In / وارد</th><th>Out / صادر</th><th>Balance / الرصيد</th><th></th>'+
        '</tr></thead><tbody id="hjl-rows"></tbody></table></div></div>'+
        '<div id="hjl-all-view" class="card" style="margin:0;display:none"><div class="tw"><table><thead><tr>'+
          '<th>Medicine / الدواء</th><th>Opening / افتتاحي</th><th>Received / استلام</th><th>Dispensed (total) / صرف إجمالي</th>'+
          '<th>→ Departments / للأقسام</th><th>→ Outpatients / للخارجي</th><th>Closing / ختامي</th>'+
        '</tr></thead><tbody id="hjl-all-rows"></tbody></table></div></div>'+
      '</div>'+
    '</div>';
  document.body.appendChild(div);
  div.querySelectorAll('[data-close]').forEach(function(x){x.onclick=function(){CM('mhijri-ledger')}});
  el('hjl-view-mode').onchange=function(){populatePeriodOptions();renderLedger()};
  el('hjl-period-type').onchange=function(){populatePeriodOptions();renderLedger()};
  el('hjl-apply').onclick=renderLedger;
  el('hjl-export').onclick=function(){return el('hjl-view-mode').value==='all'?exportAllMedicinesExcel():exportLedgerExcel()};
  el('hjl-print').onclick=function(){return el('hjl-view-mode').value==='all'?printAllMedicines():printLedger()};
}
function populateFilters(){
  var medSel=el('hjl-med'),cat=(typeof window.ctlCatalog==='function'?window.ctlCatalog():[])||[];
  var prevMed=medSel.value;
  medSel.innerHTML=cat.slice().sort(function(a,b){return String(a.name||'').localeCompare(String(b.name||''))})
    .map(function(m){return '<option value="'+esc2(m.id)+'">'+esc2(m.name)+'</option>'}).join('');
  if(prevMed&&cat.some(function(m){return m.id===prevMed}))medSel.value=prevMed;

  populatePeriodOptions();

  var deptSel=el('hjl-dept'),depts=(typeof window.gd==='function'?window.gd():[])||[];
  deptSel.innerHTML='<option value="">All departments / كل الأقسام</option><option value="outpatient">Outpatient / مريض خارجي</option>'+
    depts.map(function(d){return '<option value="'+esc2(d.id)+'">'+esc2(d.name)+'</option>'}).join('');
}
function populatePeriodOptions(){
  var periodType=el('hjl-period-type').value,periodSel=el('hjl-period'),h=currentHijri(),prev=periodSel.value,opts=[];
  if(periodType==='year'){
    for(var y=h.year;y>h.year-6;y--)opts.push('<option value="'+y+'">'+esc2(periodLabel(String(y),'year'))+'</option>');
  }else if(periodType==='quarter'){
    var y2=h.year,q=Math.ceil(h.month/3);
    for(var i=0;i<24;i++){
      var key=y2+'-Q'+q;
      opts.push('<option value="'+key+'">'+esc2(periodLabel(key,'quarter'))+'</option>');
      q--;if(q<1){q=4;y2--}
    }
  }else{
    var y3=h.year,m=h.month;
    for(var j=0;j<72;j++){
      var key2=y3+'-'+String(m).padStart(2,'0');
      opts.push('<option value="'+key2+'">'+esc2(periodLabel(key2,'month'))+'</option>');
      m--;if(m<1){m=12;y3--}
    }
  }
  periodSel.innerHTML=opts.join('');
  if(prev&&opts.some(function(o){return o.indexOf('value="'+prev+'"')>=0}))periodSel.value=prev;

  var isAll=el('hjl-view-mode').value==='all';
  el('hjl-med').style.display=isAll?'none':'';
  el('hjl-single-view').style.display=isAll?'none':'';
  el('hjl-all-view').style.display=isAll?'':'none';
}

function currentSelection(){
  var periodType=el('hjl-period-type').value;
  return {medId:el('hjl-med').value,periodKey:el('hjl-period').value,periodType:periodType,deptFilter:el('hjl-dept').value};
}
function ledgerForRange(medId,startKey,endKeyIncl,deptFilter){
  var series=medicineBalanceSeries(medId);
  var before=series.filter(function(e){return hijriMonthKey(e.at)<startKey});
  var opening=before.length?before[before.length-1].balance:0;
  var periodEntries=series.filter(function(e){var k=hijriMonthKey(e.at);return k>=startKey&&k<=endKeyIncl});
  var closing=periodEntries.length?periodEntries[periodEntries.length-1].balance:opening;
  var totalIn=periodEntries.filter(function(e){return e.dir==='in'}).reduce(function(s,e){return s+e.qty},0);
  var totalOut=periodEntries.filter(function(e){return e.dir==='out'}).reduce(function(s,e){return s+e.qty},0);
  var outDept=periodEntries.filter(function(e){return e.dir==='out'&&e.dispenseType!=='outpatient'}).reduce(function(s,e){return s+e.qty},0);
  var outPatient=periodEntries.filter(function(e){return e.dir==='out'&&e.dispenseType==='outpatient'}).reduce(function(s,e){return s+e.qty},0);
  var displayEntries=periodEntries.filter(function(e){
    if(!deptFilter)return true;
    if(deptFilter==='outpatient')return e.dispenseType==='outpatient';
    return String(e.dept)===String(deptFilter);
  });
  return {opening:opening,closing:closing,totalIn:totalIn,totalOut:totalOut,outDept:outDept,outPatient:outPatient,entries:displayEntries,allEntries:periodEntries};
}
function ledgerForSelection(sel){
  var bounds=periodBounds(sel.periodKey,sel.periodType);
  return ledgerForRange(sel.medId,bounds.start,bounds.endIncl,sel.deptFilter);
}
function allMedicinesSummary(periodKey,periodType,deptFilter){
  var bounds=periodBounds(periodKey,periodType);
  var cat=((typeof window.ctlCatalog==='function'?window.ctlCatalog():[])||[]).filter(isNarcoticOnly);
  return cat.slice().sort(function(a,b){return String(a.name||'').localeCompare(String(b.name||''))}).map(function(m){
    var d=ledgerForRange(m.id,bounds.start,bounds.endIncl,deptFilter);
    return {medId:m.id,name:m.name||m.id,moh:m.moh||'',nupco:m.nupco||'',opening:d.opening,totalIn:d.totalIn,totalOut:d.totalOut,outDept:d.outDept,outPatient:d.outPatient,closing:d.closing};
  });
}
function deptLabel(e){
  if(e.dispenseType==='outpatient')return 'Outpatient / مريض خارجي';
  if(e.dir==='in')return 'Pharmacy receipt / استلام الصيدلية';
  return e.deptName||e.dept||'—';
}

function renderLedger(){
  el('hjl-size-alert').innerHTML='';
  var sizeInfo=checkControlledMovesSize();
  if(sizeInfo.warn)el('hjl-size-alert').innerHTML='<div class="alert-banner" style="margin-bottom:10px">⚠️ controlled_moves is at '+sizeInfo.pct+'% of the Firestore size limit — archive records older than 1 year from Custody Log. / سجل الحركات اقترب من الحد الأقصى، يُنصح بالأرشفة.</div>';

  if(el('hjl-view-mode').value==='all')return renderAllMedicines();

  var sel=currentSelection();if(!sel.medId||!sel.periodKey)return;
  var data=ledgerForSelection(sel);
  var med=(typeof window.ctlMedicine==='function'?window.ctlMedicine(sel.medId):null)||{};

  el('hjl-summary').innerHTML=
    _statCard('Medicine / الدواء',esc2(med.name||sel.medId))+
    _statCard('Opening balance / الرصيد الافتتاحي',data.opening)+
    _statCard('Total in / إجمالي الوارد',data.totalIn)+
    _statCard('Total out / إجمالي الصادر',data.totalOut)+
    _statCard('Closing balance / الرصيد الختامي',data.closing);

  el('hjl-rows').innerHTML=data.entries.length?data.entries.map(function(e){
    return '<tr>'+
      '<td>'+esc2(hijriDateLabel(e.at))+'<div class="fhint">'+esc2(new Date(e.at).toISOString().slice(0,10))+'</div></td>'+
      '<td>'+(e.dir==='in'?'Receipt / استلام':'Dispense / صرف')+'</td>'+
      '<td>'+esc2(deptLabel(e))+'</td>'+
      '<td style="font-family:var(--mono)">'+(e.dir==='in'?e.qty:'')+'</td>'+
      '<td style="font-family:var(--mono)">'+(e.dir==='out'?e.qty:'')+'</td>'+
      '<td style="font-family:var(--mono);font-weight:700">'+e.balance+'</td>'+
      '<td>'+(isMasterUser()&&!e.aggregated&&e.id?'<button class="btn bg bxs" type="button" data-move-id="'+esc2(e.id)+'" onclick="ctlEditLedgerMove(this.dataset.moveId)">✏️ Edit</button>':(e.aggregated?'<span class="fhint">archived</span>':''))+'</td>'+
    '</tr>';
  }).join(''):'<tr><td colspan="7" style="text-align:center;padding:20px;color:var(--tx2)">No movements this month / لا توجد حركات هذا الشهر</td></tr>';
}

function allMedicinesSelection(){
  return {periodKey:el('hjl-period').value,periodType:el('hjl-period-type').value,deptFilter:el('hjl-dept').value};
}
function renderAllMedicines(){
  var sel=allMedicinesSelection();if(!sel.periodKey)return;
  var rows=allMedicinesSummary(sel.periodKey,sel.periodType,sel.deptFilter);
  var totalIn=rows.reduce(function(s,r){return s+r.totalIn},0),totalOut=rows.reduce(function(s,r){return s+r.totalOut},0);
  el('hjl-summary').innerHTML=
    _statCard('Period / الفترة',esc2(periodLabel(sel.periodKey,sel.periodType)))+
    _statCard('Medicines / عدد الأدوية',rows.length)+
    _statCard('Total received / إجمالي الاستلام',totalIn)+
    _statCard('Total dispensed / إجمالي الصرف',totalOut);
  el('hjl-all-rows').innerHTML=rows.length?rows.map(function(r){
    return '<tr><td style="text-align:left;font-weight:700">'+esc2(r.name)+'</td>'+
      '<td style="font-family:var(--mono)">'+r.opening+'</td>'+
      '<td style="font-family:var(--mono)">'+r.totalIn+'</td>'+
      '<td style="font-family:var(--mono);font-weight:700">'+r.totalOut+'</td>'+
      '<td style="font-family:var(--mono)">'+r.outDept+'</td>'+
      '<td style="font-family:var(--mono)">'+r.outPatient+'</td>'+
      '<td style="font-family:var(--mono);font-weight:700">'+r.closing+'</td></tr>';
  }).join(''):'<tr><td colspan="7" style="text-align:center;padding:20px;color:var(--tx2)">No narcotic medicines found / لا توجد أدوية مخدرة</td></tr>';
}
async function exportAllMedicinesExcel(){
  var sel=allMedicinesSelection();if(!sel.periodKey)return;
  var rows=allMedicinesSummary(sel.periodKey,sel.periodType,sel.deptFilter);
  if(typeof window.ensureXLSX!=='function')return window.toast&&window.toast('Excel export library is unavailable.','err');
  try{
    await window.ensureXLSX();
    var aoa=[
      ['Hijri Narcotic Ledger — All Medicines / سجل هجري شامل — كل الأدوية'],
      ['Period / الفترة',periodLabel(sel.periodKey,sel.periodType)],
      [],
      ['Medicine','MOH','NUPCO','Opening balance','Received','Dispensed (total)','Dispensed → Departments','Dispensed → Outpatients','Closing balance']
    ];
    rows.forEach(function(r){aoa.push([r.name,r.moh,r.nupco,r.opening,r.totalIn,r.totalOut,r.outDept,r.outPatient,r.closing])});
    var ws=XLSX.utils.aoa_to_sheet(aoa);
    var wb=XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb,ws,'Ledger');
    XLSX.writeFile(wb,'Hijri_Ledger_All_Narcotics_'+sel.periodKey+'.xlsx');
  }catch(e){
    console.error('All-medicines ledger export failed',e);
    window.toast&&window.toast(String(e&&e.message||e),'err');
  }
}
function printAllMedicines(){
  var sel=allMedicinesSelection();if(!sel.periodKey)return;
  var rows=allMedicinesSummary(sel.periodKey,sel.periodType,sel.deptFilter);
  var official=typeof window.officialPrintHeaderHTML==='function'?window.officialPrintHeaderHTML():'';
  var body=rows.map(function(r){
    return '<tr><td style="text-align:left">'+esc2(r.name)+'</td><td>'+r.opening+'</td><td>'+r.totalIn+'</td><td>'+r.totalOut+'</td><td>'+r.outDept+'</td><td>'+r.outPatient+'</td><td>'+r.closing+'</td></tr>';
  }).join('');
  var html='<!doctype html><html><head><meta charset="utf-8"><title>Hijri Ledger — All Narcotics</title><style>'+
    '@page{size:A4 landscape;margin:8mm}'+
    '*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}'+
    'html,body{width:100%;height:100%;margin:0;overflow:hidden}'+
    'body{font-family:Arial,Tahoma,sans-serif;color:#000}'+
    '.sheet{height:196mm;overflow:hidden;display:flex;flex-direction:column}'+
    '.fit{width:100%;transform-origin:top left}'+
    'h1{font-size:14pt;margin:4mm 0 1mm;text-align:center}'+
    'h2{font-size:10pt;margin:0 0 3mm;text-align:center;font-weight:400}'+
    'table{width:100%;border-collapse:collapse;font-size:8.5pt}'+
    'th,td{border:1px solid #000;padding:2mm;text-align:center}'+
    'th{background:#1f2328;color:#fff}'+
    '.footer{text-align:center;font-size:7pt;color:#555;margin-top:3mm}'+
    '</style></head><body><div class="sheet"><div class="fit">'+
    official+
    '<h1>Hijri Narcotic Ledger — All Medicines / السجل الهجري الشامل — كل الأدوية المخدرة</h1>'+
    '<h2>'+esc2(periodLabel(sel.periodKey,sel.periodType))+'</h2>'+
    '<table><thead><tr><th>Medicine / الدواء</th><th>Opening / افتتاحي</th><th>Received / استلام</th><th>Dispensed / صرف</th><th>→ Departments / أقسام</th><th>→ Outpatients / خارجي</th><th>Closing / ختامي</th></tr></thead>'+
    '<tbody>'+(body||'<tr><td colspan="7">No data / لا توجد بيانات</td></tr>')+'</tbody></table>'+
    '<div class="footer">By Ali Abudahash — Printed / تاريخ الطباعة: '+esc2(hijriDateLabel(new Date()))+'</div>'+
    '</div></div>'+
    '<script>(function(){'+
    'function over(){var s=document.querySelector(".sheet"),f=document.querySelector(".fit");return f.scrollHeight>s.clientHeight+1}'+
    'function fit(){var f=document.querySelector(".fit"),size=13,guard=0;f.style.fontSize=size+"px";'+
    'while(over()&&size>5&&guard<80){size-=0.4;f.style.fontSize=size+"px";guard++}'+
    'var s=document.querySelector(".sheet"),wr=(s.clientWidth-2)/Math.max(1,f.scrollWidth),hr=(s.clientHeight-2)/Math.max(1,f.scrollHeight),scale=Math.min(wr,hr,1);'+
    'f.style.transform="scale("+scale+")"}'+
    'window.addEventListener("load",function(){setTimeout(function(){fit();window.focus();window.print()},250)},{once:true});'+
    '})()</'+'script></body></html>';
  var blob=new Blob([html],{type:'text/html;charset=utf-8'});
  var url=URL.createObjectURL(blob);
  var w=window.open(url,'_blank');
  setTimeout(function(){URL.revokeObjectURL(url)},60000);
  if(!w)window.toast&&window.toast('Allow pop-ups to print the ledger.','err');
}

function _statCard(label,val){
  return '<div class="ctl-stat-card"><div class="ctl-stat-card-label">'+label+'</div><div class="ctl-stat-card-value">'+val+'</div></div>';
}

/* ── master edit / correct a movement (so a data-entry mistake stops
   distorting the balance instead of staying wrong in the log forever) ── */
window.ctlEditLedgerMove=async function(moveId){
  if(!isMasterUser())return;
  var all=(typeof window.ctlMoves==='function'?window.ctlMoves():[])||[];
  var move=all.find(function(m){return String(m.id)===String(moveId)});
  if(!move)return window.toast&&window.toast('Movement not found / لم يتم إيجاد الحركة','err');
  var newQty=await window.uiPrompt('Correct quantity / تصحيح الكمية',String(move.qty||0));
  if(newQty===null||newQty===undefined)return;
  var n=Number(newQty);
  if(!isFinite(n)||n<0)return window.toast&&window.toast('Invalid quantity / كمية غير صحيحة','err');
  var deleteIt=n===0&&await window.uiConfirm('Set quantity to 0 — remove this movement entirely from the log? / حذف الحركة بالكامل من السجل؟');
  var before=Object.assign({},move);
  var next=all.map(function(m){return Object.assign({},m)});
  if(deleteIt){
    next=next.filter(function(m){return String(m.id)!==String(moveId)});
  }else{
    var target=next.find(function(m){return String(m.id)===String(moveId)});
    target.qty=n;
    target.correctedAt=typeof window.nowISO==='function'?window.nowISO():new Date().toISOString();
    target.correctedBy=typeof window.actualActorName==='function'?window.actualActorName():'';
  }
  try{
    await window.S.s('controlled_moves',next);
    if(typeof window.auditAction==='function')await Promise.resolve(window.auditAction('controlled_move_manual_correction',{moveId:moveId,before:before.qty,after:deleteIt?0:n,deleted:!!deleteIt})).catch(function(){});
    window.toast&&window.toast('Movement corrected ✓','succ');
    renderLedger();
  }catch(e){
    console.error('Ledger correction failed',e);
    window.toast&&window.toast(String(e&&e.message||e),'err');
  }
};

/* ── excel export (opening balance → daily movements → closing balance) ── */
async function exportLedgerExcel(){
  var sel=currentSelection();if(!sel.medId||!sel.periodKey)return;
  var data=ledgerForSelection(sel);
  var med=(typeof window.ctlMedicine==='function'?window.ctlMedicine(sel.medId):null)||{};
  if(typeof window.ensureXLSX!=='function')return window.toast&&window.toast('Excel export library is unavailable.','err');
  try{
    await window.ensureXLSX();
    var aoa=[
      ['Hijri Narcotic Ledger / السجل الهجري للأدوية المخدرة'],
      ['Medicine / الدواء',med.name||sel.medId],
      ['Period / الفترة',periodLabel(sel.periodKey,sel.periodType)],
      ['Opening balance / الرصيد الافتتاحي',data.opening],
      [],
      ['Hijri date','Gregorian date','Type','Department','In','Out','Balance']
    ];
    data.allEntries.forEach(function(e){
      aoa.push([hijriDateLabel(e.at),new Date(e.at).toISOString().slice(0,10),e.dir==='in'?'Receipt':'Dispense',deptLabel(e),e.dir==='in'?e.qty:'',e.dir==='out'?e.qty:'',e.balance]);
    });
    aoa.push([]);
    aoa.push(['Closing balance / الرصيد الختامي','','','','','',data.closing]);
    var ws=XLSX.utils.aoa_to_sheet(aoa);
    var wb=XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb,ws,'Ledger');
    XLSX.writeFile(wb,'Hijri_Ledger_'+(med.name||sel.medId)+'_'+sel.periodKey+'.xlsx');
  }catch(e){
    console.error('Ledger export failed',e);
    window.toast&&window.toast(String(e&&e.message||e),'err');
  }
}

/* ── print (single A4 page) ── */
function printLedger(){
  var sel=currentSelection();if(!sel.medId||!sel.periodKey)return;
  var data=ledgerForSelection(sel);
  var med=(typeof window.ctlMedicine==='function'?window.ctlMedicine(sel.medId):null)||{};
  var official=typeof window.officialPrintHeaderHTML==='function'?window.officialPrintHeaderHTML():'';
  var monthLabel=periodLabel(sel.periodKey,sel.periodType);
  var rows=data.allEntries.map(function(e){
    return '<tr><td>'+esc2(hijriDateLabel(e.at))+'</td><td>'+(e.dir==='in'?'Receipt / استلام':'Dispense / صرف')+'</td>'+
      '<td>'+esc2(deptLabel(e))+'</td><td>'+(e.dir==='in'?e.qty:'')+'</td><td>'+(e.dir==='out'?e.qty:'')+'</td><td>'+e.balance+'</td></tr>';
  }).join('');
  var html='<!doctype html><html><head><meta charset="utf-8"><title>Hijri Ledger '+esc2(med.name||'')+'</title><style>'+
    '@page{size:A4 portrait;margin:8mm}'+
    '*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}'+
    'html,body{width:100%;height:100%;margin:0;overflow:hidden}'+
    'body{font-family:Arial,Tahoma,sans-serif;color:#000}'+
    '.sheet{height:281mm;overflow:hidden;display:flex;flex-direction:column}'+
    '.fit{width:100%;transform-origin:top left}'+
    'h1{font-size:14pt;margin:4mm 0 1mm;text-align:center}'+
    'h2{font-size:10pt;margin:0 0 3mm;text-align:center;font-weight:400}'+
    '.summary{display:flex;justify-content:space-around;margin-bottom:3mm;font-size:9pt}'+
    '.summary b{display:block;font-size:11pt}'+
    'table{width:100%;border-collapse:collapse;font-size:8.5pt}'+
    'th,td{border:1px solid #000;padding:2mm;text-align:center}'+
    'th{background:#1f2328;color:#fff}'+
    '.footer{text-align:center;font-size:7pt;color:#555;margin-top:3mm}'+
    '</style></head><body><div class="sheet"><div class="fit">'+
    official+
    '<h1>Hijri Narcotic Ledger / السجل الهجري للأدوية المخدرة</h1>'+
    '<h2>'+esc2(med.name||sel.medId)+' — '+esc2(monthLabel)+'</h2>'+
    '<div class="summary">'+
      '<div>Opening / الافتتاحي<b>'+data.opening+'</b></div>'+
      '<div>Total in / الوارد<b>'+data.totalIn+'</b></div>'+
      '<div>Total out / الصادر<b>'+data.totalOut+'</b></div>'+
      '<div>Closing / الختامي<b>'+data.closing+'</b></div>'+
    '</div>'+
    '<table><thead><tr><th>Date / التاريخ</th><th>Type / النوع</th><th>Department / القسم</th><th>In / وارد</th><th>Out / صادر</th><th>Balance / الرصيد</th></tr></thead>'+
    '<tbody>'+(rows||'<tr><td colspan="6">No movements / لا توجد حركات</td></tr>')+'</tbody></table>'+
    '<div class="footer">By Ali Abudahash — Printed / تاريخ الطباعة: '+esc2(hijriDateLabel(new Date()))+'</div>'+
    '</div></div>'+
    '<script>(function(){'+
    'function over(){var s=document.querySelector(".sheet"),f=document.querySelector(".fit");return f.scrollHeight>s.clientHeight+1}'+
    'function fit(){var f=document.querySelector(".fit"),size=13,guard=0;f.style.fontSize=size+"px";'+
    'while(over()&&size>5&&guard<80){size-=0.4;f.style.fontSize=size+"px";guard++}'+
    'var s=document.querySelector(".sheet"),wr=(s.clientWidth-2)/Math.max(1,f.scrollWidth),hr=(s.clientHeight-2)/Math.max(1,f.scrollHeight),scale=Math.min(wr,hr,1);'+
    'f.style.transform="scale("+scale+")"}'+
    'window.addEventListener("load",function(){setTimeout(function(){fit();window.focus();window.print()},250)},{once:true});'+
    '})()</'+'script></body></html>';
  var blob=new Blob([html],{type:'text/html;charset=utf-8'});
  var url=URL.createObjectURL(blob);
  var w=window.open(url,'_blank');
  setTimeout(function(){URL.revokeObjectURL(url)},60000);
  if(!w)window.toast&&window.toast('Allow pop-ups to print the ledger.','err');
}

window.ctlOpenHijriLedger=function(){
  if(!isOfficerOrMaster())return window.toast&&window.toast('Access restricted to the Controlled Medicines Officer or Master. / الوصول مقصور على مسؤول الأدوية المخدرة أو الماستر.','err');
  createModal();
  populateFilters();
  OM('mhijri-ledger');
  renderLedger();
};
})();
export {};
