(function(){
'use strict';
/* Custody handover/return report — for when the controlled-medicines
   officer goes on leave and hands the pharmacy custody to a temporary
   recipient, then returns and takes it back. Each event snapshots the
   CURRENT central-pharmacy stock (ctlPharmacy(), joined with the catalog)
   at the moment it's generated — narcotics and psychotropics kept as two
   separate lists so the officer can print either or both pages — and is
   saved as an immutable record in its own log (controlled_custody_handover_log_v1,
   under the controlled_.* wildcard so it needs no Firestore rules change).
   The officer types the three names (custody officer / recipient / pharmacy
   manager) fresh each time — there's no persisted signature to edit, just
   plain text under each line, matching every other print signature block
   already in the app. */

function el(id){return document.getElementById(id)}
function esc3(v){return window.esc?window.esc(v):String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function isOfficerOrMaster(){
  var role=typeof window.fsEffectiveRole==='function'?window.fsEffectiveRole():String((window.CU&&window.CU.role)||'');
  return role==='controlled_pharmacy'||(typeof window.isMaster==='function'&&window.isMaster());
}
function nowStamp(){return typeof window.nowISO==='function'?window.nowISO():new Date().toISOString()}
function actorName(){return typeof window.actualActorName==='function'?window.actualActorName():((window.CU&&(window.CU.username||window.CU.email))||'')}

function logKey(){return 'controlled_custody_handover_log_v1'}
function readLog(){return (window.S&&window.S.g?window.S.g(logKey())||[]:[])}
async function writeLog(next){return window.S.s(logKey(),next)}

/* Custody Officer / Pharmacy Manager names are entered once and reused —
   only the Recipient is retyped for every handover, since that's the one
   name that actually changes each time. */
function defaultsKey(){return 'controlled_custody_handover_defaults_v1'}
function readDefaults(){return (window.S&&window.S.g?window.S.g(defaultsKey())||{}:{})}
async function saveDefaults(officer,manager){
  try{await window.S.s(defaultsKey(),{custodyOfficer:officer,pharmacyManager:manager})}
  catch(e){console.warn('Could not save custody officer/manager defaults.',e)}
}

function buildSnapshot(){
  var cat=(typeof window.ctlCatalog==='function'?window.ctlCatalog():[])||[];
  var ph=(typeof window.ctlPharmacy==='function'?window.ctlPharmacy():{})||{};
  var narcotics=[],psychotropics=[];
  cat.forEach(function(m){
    var stock=ph[m.id]||{},qty=stock.qty!=null?Number(stock.qty):(stock.actualQty!=null?Number(stock.actualQty):0);
    var row={medId:m.id,name:m.name||m.id,moh:m.moh||'',nupco:m.nupco||'',qty:isFinite(qty)?qty:0};
    if(String(m.classification||'narcotic')==='psychotropic')psychotropics.push(row);
    else narcotics.push(row);
  });
  narcotics.sort(function(a,b){return String(a.name).localeCompare(String(b.name))});
  psychotropics.sort(function(a,b){return String(a.name).localeCompare(String(b.name))});
  return {narcotics:narcotics,psychotropics:psychotropics};
}

/* ── modal ── */
function createModal(){
  if(el('mcustody-handover'))return;
  var div=document.createElement('div');div.id='mcustody-handover';div.className='modal-bg';
  div.innerHTML=
    '<div class="modal" style="width:900px;max-width:96vw;max-height:92vh;display:flex;flex-direction:column">'+
      '<div class="mh"><span class="mt">🧾 Custody Handover / محضر تسليم واستلام العهدة</span><button class="xbtn" type="button" data-close="mcustody-handover">✕</button></div>'+
      '<div style="padding:14px 18px;overflow:auto;flex:1">'+
        '<div class="fl g8" style="margin-bottom:14px">'+
          '<button class="btn bp bsm" type="button" id="chr-tab-handover">Handover / تسليم عهدة</button>'+
          '<button class="btn bg bsm" type="button" id="chr-tab-return">Return / استلام عودة</button>'+
          '<button class="btn bg bsm" type="button" id="chr-tab-history">History / السجل</button>'+
        '</div>'+
        '<div id="chr-form-panel">'+
          '<div class="fhint" id="chr-form-hint" style="margin-bottom:10px"></div>'+
          '<div class="fg"><label>Custody Officer (outgoing) / مسؤول العهدة المُسلِّم <span class="fhint">saved — edit anytime / محفوظ، يمكن تعديله</span></label><input id="chr-officer"></div>'+
          '<div class="fg"><label>Recipient / المستلم للعهدة <span class="fhint">enter each time / يُدخل في كل مرة</span></label><input id="chr-recipient"></div>'+
          '<div class="fg"><label>Pharmacy Manager / مدير الصيدلية <span class="fhint">saved — edit anytime / محفوظ، يمكن تعديله</span></label><input id="chr-manager"></div>'+
          '<div class="fl g8" style="margin:10px 0">'+
            '<label class="fl g8" style="align-items:center"><input type="checkbox" id="chr-inc-narcotic" checked> Narcotics page / صفحة الناركوتك</label>'+
            '<label class="fl g8" style="align-items:center"><input type="checkbox" id="chr-inc-psych" checked> Psychotropics page / صفحة النفسية</label>'+
          '</div>'+
          '<button class="btn bp" type="button" id="chr-generate">🖨 Generate &amp; Print / إصدار وطباعة</button>'+
        '</div>'+
        '<div id="chr-history-panel" style="display:none">'+
          '<div class="card" style="margin:0"><div class="tw"><table><thead><tr>'+
            '<th>Date / التاريخ</th><th>Type / النوع</th><th>Custody Officer</th><th>Recipient</th><th>Pharmacy Manager</th><th></th>'+
          '</tr></thead><tbody id="chr-history-rows"></tbody></table></div></div>'+
        '</div>'+
      '</div>'+
    '</div>';
  document.body.appendChild(div);
  div.querySelectorAll('[data-close]').forEach(function(x){x.onclick=function(){CM('mcustody-handover')}});
  el('chr-tab-handover').onclick=function(){setMode('handover')};
  el('chr-tab-return').onclick=function(){setMode('return')};
  el('chr-tab-history').onclick=function(){setMode('history')};
  el('chr-generate').onclick=generateAndSave;
}
var CHR_MODE='handover';
function setMode(mode){
  CHR_MODE=mode;
  el('chr-form-panel').style.display=mode==='history'?'none':'';
  el('chr-history-panel').style.display=mode==='history'?'':'none';
  el('chr-form-hint').textContent=mode==='handover'
    ?'A snapshot of the current pharmacy stock is taken at the moment you generate this report. / يُؤخذ لقطة من رصيد الصيدلية الحالي لحظة إصدار المحضر.'
    :'A fresh snapshot of the remaining stock is taken now, for the officer to sign the custody back. / يُؤخذ لقطة جديدة من الرصيد المتبقي الآن لتوقيع استلام العهدة.';
  if(mode==='history')renderHistory();
}
function renderHistory(){
  var log=readLog().slice().sort(function(a,b){return String(b.at||'').localeCompare(String(a.at||''))});
  el('chr-history-rows').innerHTML=log.length?log.map(function(r){
    return '<tr><td>'+esc3(new Date(r.at).toLocaleString())+'</td>'+
      '<td>'+(r.type==='return'?'Return / استلام عودة':'Handover / تسليم')+'</td>'+
      '<td>'+esc3(r.custodyOfficer||'')+'</td><td>'+esc3(r.recipient||'')+'</td><td>'+esc3(r.pharmacyManager||'')+'</td>'+
      '<td><button class="btn bg bxs" type="button" data-log-id="'+esc3(r.id)+'" onclick="ctlReprintHandover(this.dataset.logId)">🖨 Reprint</button></td></tr>';
  }).join(''):'<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--tx2)">No handover/return records yet / لا توجد سجلات بعد</td></tr>';
}

async function generateAndSave(){
  var officer=el('chr-officer').value.trim(),recipient=el('chr-recipient').value.trim(),manager=el('chr-manager').value.trim();
  var incNarcotic=el('chr-inc-narcotic').checked,incPsych=el('chr-inc-psych').checked;
  if(!officer||!recipient||!manager)return window.toast&&window.toast('All three names are required. / الأسماء الثلاثة مطلوبة.','err');
  if(!incNarcotic&&!incPsych)return window.toast&&window.toast('Select at least one page to include. / اختر صفحة واحدة على الأقل.','err');
  var snapshot=buildSnapshot();
  var record={
    id:'chr_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,6),
    type:CHR_MODE==='return'?'return':'handover',
    at:nowStamp(),
    custodyOfficer:officer,recipient:recipient,pharmacyManager:manager,
    narcoticsIncluded:incNarcotic,psychotropicsIncluded:incPsych,
    snapshot:snapshot,
    createdBy:actorName()
  };
  try{
    var log=readLog().slice();log.push(record);
    await writeLog(log);
    await saveDefaults(officer,manager);
    if(typeof window.auditAction==='function')await Promise.resolve(window.auditAction('controlled_custody_'+record.type,{recordId:record.id,officer:officer,recipient:recipient})).catch(function(){});
    window.toast&&window.toast('Custody '+(record.type==='return'?'return':'handover')+' record saved ✓','succ');
    printRecord(record);
  }catch(e){
    console.error('Custody handover save failed',e);
    window.toast&&window.toast(String(e&&e.message||e),'err');
  }
}
window.ctlReprintHandover=function(logId){
  var record=readLog().find(function(r){return String(r.id)===String(logId)});
  if(!record)return window.toast&&window.toast('Record not found / لم يتم إيجاد السجل','err');
  printRecord(record);
};

function medRowsHtml(rows){
  return rows.map(function(r,i){
    return '<tr><td>'+(i+1)+'</td><td>'+esc3(r.moh||'—')+'</td><td>'+esc3(r.nupco||'—')+'</td><td style="text-align:left;font-weight:700">'+esc3(r.name)+'</td><td>'+r.qty+'</td></tr>';
  }).join('')||'<tr><td colspan="5">No medicines / لا توجد أدوية</td></tr>';
}
function signatureBlock(record){
  return '<div class="chr-sig-row">'+
    '<div class="chr-sig"><b>Custody Officer / مسؤول العهدة</b><span>'+esc3(record.custodyOfficer)+'</span></div>'+
    '<div class="chr-sig"><b>Recipient / المستلم</b><span>'+esc3(record.recipient)+'</span></div>'+
    '<div class="chr-sig"><b>Pharmacy Manager / مدير الصيدلية</b><span>'+esc3(record.pharmacyManager)+'</span></div>'+
  '</div>';
}
function pageHtml(record,kind){
  var isNarcotic=kind==='narcotic';
  var rows=isNarcotic?record.snapshot.narcotics:record.snapshot.psychotropics;
  var title=record.type==='return'?'Custody Return Report / محضر استلام عودة العهدة':'Custody Handover Report / محضر تسليم العهدة';
  var subtitle=isNarcotic?'Narcotic medicines / الأدوية المخدرة':'Psychotropic medicines / الأدوية النفسية';
  return '<section class="chr-page">'+
    '<h1>'+title+'</h1>'+
    '<h2>'+subtitle+' — '+esc3(new Date(record.at).toLocaleString())+'</h2>'+
    '<table><thead><tr><th>#</th><th>MOH</th><th>NUPCO</th><th>Medicine / الدواء</th><th>Balance / الرصيد</th></tr></thead>'+
    '<tbody>'+medRowsHtml(rows)+'</tbody></table>'+
    signatureBlock(record)+
    '<div class="chr-footer">By Ali Abudahash</div>'+
  '</section>';
}
function printRecord(record){
  var official=typeof window.officialPrintHeaderHTML==='function'?window.officialPrintHeaderHTML():'';
  var pages='';
  if(record.narcoticsIncluded)pages+=pageHtml(record,'narcotic');
  if(record.psychotropicsIncluded)pages+=pageHtml(record,'psychotropic');
  var html='<!doctype html><html><head><meta charset="utf-8"><title>Custody Handover</title><style>'+
    '@page{size:A4 portrait;margin:8mm}'+
    '*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}'+
    'body{font-family:Arial,Tahoma,sans-serif;color:#000;margin:0}'+
    '.chr-page{height:281mm;overflow:hidden;page-break-after:always;display:flex;flex-direction:column}'+
    '.chr-page:last-child{page-break-after:auto}'+
    'h1{font-size:14pt;margin:2mm 0 1mm;text-align:center}'+
    'h2{font-size:10pt;margin:0 0 4mm;text-align:center;font-weight:400}'+
    'table{width:100%;border-collapse:collapse;font-size:9pt}'+
    'th,td{border:1px solid #000;padding:2mm;text-align:center}'+
    'th{background:#1f2328;color:#fff}'+
    '.chr-sig-row{display:grid;grid-template-columns:repeat(3,1fr);gap:5mm;margin-top:auto;padding-top:6mm}'+
    '.chr-sig{border-top:1px solid #000;text-align:center;padding-top:2mm;font-size:9pt}'+
    '.chr-sig b{display:block}'+
    '.chr-footer{text-align:right;font-size:7pt;color:#555;margin-top:3mm}'+
    '</style></head><body>'+official+pages+
    '<script>(function(){var d=false;function g(){if(d)return;d=true;window.focus();window.print()}if(document.readyState==="complete")setTimeout(g,300);else window.addEventListener("load",function(){setTimeout(g,300)},{once:true})})()</'+'script></body></html>';
  var blob=new Blob([html],{type:'text/html;charset=utf-8'});
  var url=URL.createObjectURL(blob);
  var w=window.open(url,'_blank');
  setTimeout(function(){URL.revokeObjectURL(url)},60000);
  if(!w)window.toast&&window.toast('Allow pop-ups to print the custody report.','err');
}

window.ctlOpenCustodyHandover=function(){
  if(!isOfficerOrMaster())return window.toast&&window.toast('Access restricted to the Controlled Medicines Officer or Master. / الوصول مقصور على مسؤول الأدوية المخدرة أو الماستر.','err');
  createModal();
  var defaults=readDefaults();
  el('chr-officer').value=defaults.custodyOfficer||'';
  el('chr-recipient').value='';
  el('chr-manager').value=defaults.pharmacyManager||'';
  el('chr-inc-narcotic').checked=true;el('chr-inc-psych').checked=true;
  setMode('handover');
  OM('mcustody-handover');
};
})();
export {};
